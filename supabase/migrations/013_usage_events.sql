-- ============================================================
-- Aristo AI — Migration 013: LLM / API usage events
-- ============================================================
-- One row per provider API call. Powers the admin cost dashboard.
--
-- Cost is stored as cost_usd_micros (BIGINT 10^-6 USD) to avoid
-- floating-point drift over high-volume aggregations.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.usage_events (
    id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    provider               TEXT        NOT NULL,            -- "anthropic" | "openai" | "fal"
    model                  TEXT        NOT NULL,            -- "claude-sonnet-4-6" etc.
    feature                TEXT        NOT NULL,            -- "teach.lesson" | "quiz.generate" | "rag.embed" | ...
    input_tokens           INTEGER,
    output_tokens          INTEGER,
    cache_read_tokens      INTEGER,                          -- Anthropic prompt cache reads
    cache_creation_tokens  INTEGER,
    units                  NUMERIC,                          -- non-token providers (fal seconds, image count)
    cost_usd_micros        BIGINT,                           -- 10^-6 USD
    metadata               JSONB       DEFAULT '{}'::jsonb,
    created_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_created_at ON public.usage_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_user       ON public.usage_events (user_id);
CREATE INDEX IF NOT EXISTS idx_usage_feature    ON public.usage_events (feature);
CREATE INDEX IF NOT EXISTS idx_usage_provider   ON public.usage_events (provider);

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usage service all" ON public.usage_events;
CREATE POLICY "usage service all"
    ON public.usage_events
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
