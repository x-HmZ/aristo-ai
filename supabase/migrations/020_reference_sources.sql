-- ============================================================
-- Aristo AI — Migration 020: Reference sources (textbook ingestion)
--
-- 1. reference_sources: one row per ingested book or document, with the
--    licence and attribution the product has to show learners.
-- 2. reference_chunks: gains source_id (cascade delete), the batch that
--    wrote it (retry replaces a batch) and a page range.
-- 3. match_reference_chunks(): replaced by a version that can also filter
--    by source and page ranges. The old three-argument calls still work.
-- 4. concepts: source link, page ranges, grade level and an is_draft flag.
--    Draft concepts are invisible to learners (RLS) until a course that
--    lists them is published (trigger), so a drafted course never leaks.
--
-- Read policy chosen for reference_sources: authenticated users may read
-- rows with status = 'ready' (same audience as reference_chunks today).
-- The public /credits page reads through the service role on the server,
-- so no anonymous read policy is needed. Writes: admin or service role.
-- ============================================================

-- ── 1. reference_sources ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reference_sources (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    title            VARCHAR(255) NOT NULL,
    publisher        VARCHAR(255) NOT NULL,           -- author or publisher
    licence_id       VARCHAR(40)  NOT NULL,           -- key into src/lib/rag/licences.ts
    licence_url      TEXT,
    attribution_text TEXT,
    source_url       TEXT,
    content_hash     CHAR(64)     NOT NULL,           -- SHA-256 of the normalised full text
    domain           VARCHAR(100) NOT NULL,
    grade_min        SMALLINT,
    grade_max        SMALLINT,
    outline          JSONB        NOT NULL DEFAULT '[]',
    status           VARCHAR(12)  NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'ingesting', 'ready', 'failed')),
    error            TEXT,
    batch_count      INTEGER      NOT NULL DEFAULT 0, -- batches the client plans to send
    chunk_count      INTEGER      NOT NULL DEFAULT 0,
    token_count      INTEGER      NOT NULL DEFAULT 0,
    created_by       UUID         REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CHECK (grade_min IS NULL OR grade_max IS NULL OR grade_min <= grade_max)
);

-- One live copy of a text. A failed attempt may be retried with the same text.
CREATE UNIQUE INDEX IF NOT EXISTS uq_reference_sources_hash
    ON public.reference_sources (content_hash)
    WHERE status <> 'failed';

CREATE INDEX IF NOT EXISTS idx_reference_sources_domain
    ON public.reference_sources (domain);
CREATE INDEX IF NOT EXISTS idx_reference_sources_status
    ON public.reference_sources (status);

ALTER TABLE public.reference_sources ENABLE ROW LEVEL SECURITY;

-- Policies below need "is the caller a platform admin". Asking that with a subquery on profiles inside a
-- policy runs profiles' own policies, one of which ("profiles: admin read all", migration 005) reads profiles
-- again: Postgres can reject that as infinite recursion, which would break every learner's read of concepts.
-- A SECURITY DEFINER function reads profiles without going through its policies.
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE((SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()), false);
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin_user() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_admin_user() TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "sources: read ready" ON public.reference_sources;
CREATE POLICY "sources: read ready"
    ON public.reference_sources
    FOR SELECT
    TO authenticated
    USING (status = 'ready');

DROP POLICY IF EXISTS "sources: admin all" ON public.reference_sources;
CREATE POLICY "sources: admin all"
    ON public.reference_sources
    FOR ALL
    TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "sources: service all" ON public.reference_sources;
CREATE POLICY "sources: service all"
    ON public.reference_sources
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ── 2. reference_chunks ──────────────────────────────────────────────────────
ALTER TABLE public.reference_chunks
    ADD COLUMN IF NOT EXISTS source_id   UUID REFERENCES public.reference_sources(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS batch_index INTEGER,
    ADD COLUMN IF NOT EXISTS page_start  INTEGER,
    ADD COLUMN IF NOT EXISTS page_end    INTEGER;

CREATE INDEX IF NOT EXISTS idx_chunks_source_batch
    ON public.reference_chunks (source_id, batch_index);

-- ── 3. match_reference_chunks() with source and page filters ─────────────────
-- Return type changes, so the old function must go first. All new arguments
-- have defaults; existing calls (query_embedding, match_count, domain_filter)
-- keep working.
DROP FUNCTION IF EXISTS public.match_reference_chunks(vector, INT, VARCHAR);

CREATE OR REPLACE FUNCTION public.match_reference_chunks(
    query_embedding  vector(1536),
    match_count      INT     DEFAULT 4,
    domain_filter    VARCHAR DEFAULT NULL,
    source_filter    UUID    DEFAULT NULL,
    -- jsonb array of {"start": int, "end": int}; a chunk matches when its
    -- page range overlaps any of them. NULL or [] means no page filter.
    page_ranges      JSONB   DEFAULT NULL
)
RETURNS TABLE (
    id           UUID,
    content      TEXT,
    domain       VARCHAR(100),
    source_title VARCHAR(255),
    source_id    UUID,
    page_start   INTEGER,
    page_end     INTEGER,
    similarity   FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        rc.id,
        rc.content,
        rc.domain,
        rc.source_title,
        rc.source_id,
        rc.page_start,
        rc.page_end,
        1.0 - (rc.embedding <=> query_embedding) AS similarity
    FROM public.reference_chunks rc
    LEFT JOIN public.reference_sources s ON s.id = rc.source_id
    WHERE rc.embedding IS NOT NULL
      -- Only finished sources ground a lesson. Chunks from before the registry existed have no source row.
      AND (rc.source_id IS NULL OR s.status = 'ready')
      AND (domain_filter IS NULL OR rc.domain = domain_filter)
      AND (source_filter IS NULL OR rc.source_id = source_filter)
      AND (
            page_ranges IS NULL
         OR jsonb_array_length(page_ranges) = 0
         OR EXISTS (
              SELECT 1
              FROM jsonb_array_elements(page_ranges) r
              WHERE rc.page_start IS NOT NULL
                AND rc.page_start <= (r->>'end')::int
                AND COALESCE(rc.page_end, rc.page_start) >= (r->>'start')::int
            )
      )
    ORDER BY rc.embedding <=> query_embedding
    LIMIT LEAST(GREATEST(match_count, 1), 20);
END;
$$;

-- A new function is executable by PUBLIC (and so by the anonymous key) unless revoked. This one is
-- SECURITY DEFINER and returns book text, so it is closed to everyone but the roles named here.
REVOKE EXECUTE ON FUNCTION public.match_reference_chunks(vector, INT, VARCHAR, UUID, JSONB) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.match_reference_chunks(vector, INT, VARCHAR, UUID, JSONB)
    TO authenticated, service_role;

-- ── 4. concepts: provenance, grade level, draft flag ─────────────────────────
ALTER TABLE public.concepts
    ADD COLUMN IF NOT EXISTS source_id    UUID REFERENCES public.reference_sources(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS source_pages JSONB,       -- [{"start":12,"end":19}, ...]
    ADD COLUMN IF NOT EXISTS grade_level  SMALLINT,
    ADD COLUMN IF NOT EXISTS is_draft     BOOLEAN NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "concepts: read all" ON public.concepts;
DROP POLICY IF EXISTS "concepts: read published or admin" ON public.concepts;
CREATE POLICY "concepts: read published or admin"
    ON public.concepts
    FOR SELECT
    USING (
        is_draft = false
        OR public.is_admin_user()
    );

-- Publishing a course (from any admin screen) makes the concepts it lists
-- visible to learners. SECURITY DEFINER so it works for an admin session too.
CREATE OR REPLACE FUNCTION public.publish_course_concepts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.is_published THEN
        UPDATE public.concepts
        SET    is_draft = false
        WHERE  is_draft
          AND  id IN (
                SELECT jsonb_array_elements_text(l->'concept_ids')
                FROM   jsonb_array_elements(COALESCE(NEW.structure->'modules', '[]'::jsonb)) m,
                       jsonb_array_elements(COALESCE(m->'lessons', '[]'::jsonb)) l
          );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_publish_course_concepts ON public.courses;
CREATE TRIGGER trg_publish_course_concepts
    AFTER INSERT OR UPDATE OF is_published, structure ON public.courses
    FOR EACH ROW
    WHEN (NEW.is_published)
    EXECUTE FUNCTION public.publish_course_concepts();
