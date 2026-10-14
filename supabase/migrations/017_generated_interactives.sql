-- ============================================================
-- Aristo AI — Migration 017: Generated interactive widgets (V10)
-- ============================================================
-- One row per (concept, spec): the sandboxed page (markup, css, js) the
-- InteractiveAgent wrote for a lesson's interactive visual. The first learner
-- to reach a concept pays for the generation; everyone after is served from
-- here. Written only for KG-resolved concepts: a free-form topic is never
-- stored, so a typed topic cannot plant a page for another learner.
--
-- `disabled` is the kill switch. Generated code is shown to every learner, so an
-- admin can switch a bad widget off in SQL (the route then answers 404 and the
-- lesson carries on over its image) without waiting for a deploy.
--
-- NOTE: `concepts.id` is VARCHAR(100) (migration 005_reset_and_graph.sql).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.generated_interactives (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    spec_hash     TEXT         NOT NULL UNIQUE,   -- sha256 of concept id + normalized spec (lib/interactive/spec.ts)
    concept_id    VARCHAR(100) NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
    title         TEXT         NOT NULL,
    markup        TEXT         NOT NULL,
    css           TEXT         NOT NULL,
    js            TEXT         NOT NULL,
    source_model  TEXT,
    disabled      BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ  DEFAULT NOW(),
    CONSTRAINT generated_interactives_size CHECK (length(markup) + length(css) + length(js) <= 40000)
);

CREATE INDEX IF NOT EXISTS idx_generated_interactives_concept ON public.generated_interactives (concept_id);

ALTER TABLE public.generated_interactives ENABLE ROW LEVEL SECURITY;

-- Service role only: /api/learn/interactive is the one reader and writer.
REVOKE ALL ON public.generated_interactives FROM anon, authenticated;
DROP POLICY IF EXISTS "generated_interactives service all" ON public.generated_interactives;
CREATE POLICY "generated_interactives service all"
    ON public.generated_interactives
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
