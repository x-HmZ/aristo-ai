-- ============================================================
-- Aristo AI — Migration 014: Lesson cache + moderation
-- ============================================================
-- Persists generated LessonPayloads keyed by (concept_id, profile_signature).
-- Lesson route can now serve approved rows directly, skipping the
-- TeachingAgent LLM call. Admin can review pending rows before they ship.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cached_lessons (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    concept_id          VARCHAR(100) NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
    profile_signature   TEXT         NOT NULL,                  -- hash of DynamicProfile + version
    payload             JSONB        NOT NULL,                  -- full LessonPayload
    generated_by_model  TEXT,
    rag_chunks_used     JSONB,                                  -- chunk IDs/sources for traceability
    moderation_status   TEXT         NOT NULL DEFAULT 'pending',-- pending|approved|rejected|auto_approved
    moderator_id        UUID         REFERENCES public.profiles(id) ON DELETE SET NULL,
    moderator_notes     TEXT,
    flagged_reason      TEXT,                                   -- "new_concept" | "high_misconception_rate" | "manual"
    generated_at        TIMESTAMPTZ  DEFAULT NOW(),
    approved_at         TIMESTAMPTZ,
    usage_count         INTEGER      DEFAULT 0,
    UNIQUE (concept_id, profile_signature)
);

CREATE INDEX IF NOT EXISTS idx_cached_concept   ON public.cached_lessons (concept_id);
CREATE INDEX IF NOT EXISTS idx_cached_status    ON public.cached_lessons (moderation_status);
CREATE INDEX IF NOT EXISTS idx_cached_generated ON public.cached_lessons (generated_at DESC);

ALTER TABLE public.cached_lessons ENABLE ROW LEVEL SECURITY;

-- Approved rows are readable by any authenticated learner; everything else
-- is service-role only (admin reads via /api/admin/*).
DROP POLICY IF EXISTS "cache auth read approved" ON public.cached_lessons;
CREATE POLICY "cache auth read approved"
    ON public.cached_lessons
    FOR SELECT
    TO authenticated
    USING (moderation_status IN ('approved', 'auto_approved'));

DROP POLICY IF EXISTS "cache service all" ON public.cached_lessons;
CREATE POLICY "cache service all"
    ON public.cached_lessons
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Atomic `increment usage_count` helper. Used by the lesson route on cache
-- hits so we can sort by popularity without a read-then-update race.
CREATE OR REPLACE FUNCTION public.increment_cached_lesson_usage(p_id UUID)
RETURNS VOID
LANGUAGE SQL
AS $$
  UPDATE public.cached_lessons
  SET    usage_count = usage_count + 1
  WHERE  id = p_id;
$$;
