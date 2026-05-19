-- ============================================================
-- Aristo AI — Migration 008: Courses (KG-driven structure)
--
-- Drops the old topic_list-based courses + curricula tables.
-- Replaces with a single `courses` table whose `structure`
-- column holds the full module/lesson/concept_ids hierarchy.
-- Also wires the course_id FK on user_course_progress.
-- ============================================================

-- Drop old tables (CASCADE removes dependent FKs)
DROP TABLE IF EXISTS public.courses   CASCADE;
DROP TABLE IF EXISTS public.curricula CASCADE;

-- ============================================================
-- COURSES  (spec §9)
-- ============================================================

CREATE TABLE public.courses (
    id              VARCHAR(100) PRIMARY KEY,
    domain          VARCHAR(100) NOT NULL,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,

    -- Full course hierarchy:
    -- {
    --   "modules": [
    --     { "id": "mod_1", "title": "...", "description": "...",
    --       "lessons": [
    --         { "id": "lesson_1_1", "title": "...", "concept_ids": ["..."] }
    --       ]
    --     }
    --   ]
    -- }
    structure       JSONB NOT NULL DEFAULT '{"modules":[]}',

    estimated_hours NUMERIC(5,1),
    is_published    BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_courses_domain     ON public.courses(domain);
CREATE INDEX idx_courses_published  ON public.courses(is_published);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read published courses
CREATE POLICY "courses: read published"
    ON public.courses FOR SELECT
    USING (is_published = true OR auth.uid() IN (
        SELECT id FROM public.profiles WHERE is_admin = true
    ));

-- Only admins can write
CREATE POLICY "courses: admin write"
    ON public.courses FOR INSERT
    WITH CHECK (auth.uid() IN (
        SELECT id FROM public.profiles WHERE is_admin = true
    ));

CREATE POLICY "courses: admin update"
    ON public.courses FOR UPDATE
    USING (auth.uid() IN (
        SELECT id FROM public.profiles WHERE is_admin = true
    ));

-- ============================================================
-- Wire course_id FK onto user_course_progress
-- (The column was added as plain VARCHAR(100) in migration 006;
--  now we add the FK constraint pointing at the new table.)
-- ============================================================

ALTER TABLE public.user_course_progress
    ADD COLUMN IF NOT EXISTS course_id VARCHAR(100)
    REFERENCES public.courses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ucp_course ON public.user_course_progress(course_id);
