-- ============================================================
-- Aristo AI — Migration 009: Quiz constraints + helpers
--
-- Fixes two gaps left after migrations 006 + 008:
--
--   1. UNIQUE constraint on user_misconceptions so repeated
--      misconceptions are deduplicated rather than duplicated.
--
--   2. increment_misconception() RPC — atomically increments
--      occurrence_count on an existing row or inserts a new one.
--      Called by /api/quiz/submit.
-- ============================================================

-- ── 1. Unique constraint on user_misconceptions ──────────────────────────────
-- Allows the increment_misconception RPC below to use ON CONFLICT DO UPDATE.

ALTER TABLE public.user_misconceptions
    ADD CONSTRAINT uq_misconception_per_user_concept
    UNIQUE (user_id, concept_id, misconception);

-- Backfill: if duplicates already exist, keep only the one with the highest
-- occurrence_count before adding the constraint.
-- (Safe to run even on an empty table.)
DELETE FROM public.user_misconceptions a
    USING public.user_misconceptions b
    WHERE a.user_id       = b.user_id
      AND a.concept_id    = b.concept_id
      AND a.misconception = b.misconception
      AND a.id            < b.id;


-- ── 2. increment_misconception() RPC ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_misconception(
    p_user_id    UUID,
    p_concept_id VARCHAR(100),
    p_text       TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.user_misconceptions
        (user_id, concept_id, misconception, occurrence_count, last_detected)
    VALUES
        (p_user_id, p_concept_id, p_text, 1, NOW())
    ON CONFLICT (user_id, concept_id, misconception)
    DO UPDATE SET
        occurrence_count = user_misconceptions.occurrence_count + 1,
        last_detected    = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_misconception(UUID, VARCHAR, TEXT)
    TO authenticated;
