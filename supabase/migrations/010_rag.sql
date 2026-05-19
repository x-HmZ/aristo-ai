-- ============================================================
-- Aristo AI — Migration 010: RAG Pipeline
--
-- Enables pgvector and creates the reference_chunks table used
-- by the Phase 8 Retrieval-Augmented Generation pipeline.
--
-- Also creates:
--   match_reference_chunks() RPC  — cosine similarity search
--   HNSW index                    — fast approximate NN lookup
-- ============================================================

-- ── 1. Enable pgvector extension ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ── 2. reference_chunks table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reference_chunks (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    domain       VARCHAR(100) NOT NULL,
    source_title VARCHAR(255),
    content      TEXT        NOT NULL,
    embedding    vector(1536),          -- OpenAI text-embedding-3-small
    metadata     JSONB       DEFAULT '{}',
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chunks_domain
    ON public.reference_chunks (domain);

-- HNSW index for approximate nearest-neighbour search using cosine distance.
-- Works on empty tables (unlike IVFFlat which needs training data).
-- ef_construction=64 is a good balance between build speed and recall quality.
CREATE INDEX IF NOT EXISTS idx_chunks_embedding
    ON public.reference_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ── 3. RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.reference_chunks ENABLE ROW LEVEL SECURITY;

-- Only authenticated users may read chunks (lessons call this server-side)
CREATE POLICY "authenticated read"
    ON public.reference_chunks
    FOR SELECT
    TO authenticated
    USING (true);

-- Only service_role (admin routes) may insert/update/delete
CREATE POLICY "service write"
    ON public.reference_chunks
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ── 4. match_reference_chunks() RPC ──────────────────────────────────────────
-- Called by the RAG retrieve module via supabase.rpc().
-- Returns top-k chunks ordered by cosine similarity to the query embedding.

CREATE OR REPLACE FUNCTION public.match_reference_chunks(
    query_embedding  vector(1536),
    match_count      INT     DEFAULT 4,
    domain_filter    VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    id           UUID,
    content      TEXT,
    domain       VARCHAR(100),
    source_title VARCHAR(255),
    similarity   FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        rc.id,
        rc.content,
        rc.domain,
        rc.source_title,
        1.0 - (rc.embedding <=> query_embedding) AS similarity
    FROM public.reference_chunks rc
    WHERE rc.embedding IS NOT NULL
      AND (domain_filter IS NULL OR rc.domain = domain_filter)
    ORDER BY rc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_reference_chunks(vector, INT, VARCHAR)
    TO authenticated, service_role;
