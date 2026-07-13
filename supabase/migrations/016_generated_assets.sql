-- ============================================================
-- Aristo AI — Migration 016: Persistent generation cache
-- ============================================================
-- Backs the Supabase Storage layer added in banana.ts (T06). All fal.ai
-- outputs (Nano Banana Pro infographics, FLUX Schnell 3D-source images,
-- TripoSR GLBs) were previously cached only in-memory per Fluid Compute
-- instance — cold instances regenerated everything at full fal.ai cost.
--
-- This table records the durable Supabase Storage location for each
-- generation, keyed by the same (kind, prompt_hash) the in-memory cache
-- already computes, so the first student to view a concept pays once and
-- every subsequent student/instance inherits the asset from storage.
--
-- NOTE: `concepts.id` is VARCHAR(100) (migration 005_reset_and_graph.sql),
-- not UUID — concept_id below matches that type rather than the `uuid`
-- type sketched in the T06 planning doc.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.generated_assets (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    kind              TEXT         NOT NULL CHECK (kind IN ('infographic', 'flux_source', 'model_3d')),
    prompt_hash       TEXT         NOT NULL,
    concept_id        VARCHAR(100) REFERENCES public.concepts(id) ON DELETE SET NULL,
    storage_path      TEXT         NOT NULL,
    source_model      TEXT,                      -- e.g. "fal-ai/nano-banana-pro", "fal-ai/triposr"
    bytes             INTEGER,
    created_at        TIMESTAMPTZ  DEFAULT NOW(),
    UNIQUE (kind, prompt_hash)
);

CREATE INDEX IF NOT EXISTS idx_generated_assets_concept ON public.generated_assets (concept_id);
CREATE INDEX IF NOT EXISTS idx_generated_assets_created  ON public.generated_assets (created_at DESC);

ALTER TABLE public.generated_assets ENABLE ROW LEVEL SECURITY;

-- Any authenticated learner can read (needed so client-visible lookups —
-- if ever done outside the service-role server routes — aren't blocked).
DROP POLICY IF EXISTS "generated_assets auth read" ON public.generated_assets;
CREATE POLICY "generated_assets auth read"
    ON public.generated_assets
    FOR SELECT
    TO authenticated
    USING (true);

-- Inserts/updates only via service-role (server routes running banana.ts).
DROP POLICY IF EXISTS "generated_assets service all" ON public.generated_assets;
CREATE POLICY "generated_assets service all"
    ON public.generated_assets
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
