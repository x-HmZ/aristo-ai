-- ============================================================
-- Aristo AI — Migration 005: Full Reset + Knowledge Graph
--
-- Drops all previous app tables and rebuilds the schema per
-- AI_TEACHER_APP_SPEC.md. Supabase auth.users is untouched.
--
-- Drop order respects FK constraints:
--   quiz_attempts → sessions → courses → curricula
--   → style_assessments → profiles
-- ============================================================

-- ── Drop old tables ──────────────────────────────────────────

DROP TABLE IF EXISTS public.quiz_attempts    CASCADE;
DROP TABLE IF EXISTS public.sessions         CASCADE;
DROP TABLE IF EXISTS public.courses          CASCADE;
DROP TABLE IF EXISTS public.curricula        CASCADE;
DROP TABLE IF EXISTS public.style_assessments CASCADE;
DROP TABLE IF EXISTS public.profiles         CASCADE;

-- Drop old functions/triggers that referenced the old schema.
-- Note: triggers on app tables were already removed by CASCADE above.
-- We only need to explicitly drop the trigger on auth.users (not dropped above)
-- and then drop the functions.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.set_updated_at();

-- ============================================================
-- PROFILES (rebuilt — no FSLSM columns)
-- Thin extension of auth.users for app-specific settings.
-- ============================================================

CREATE TABLE public.profiles (
    id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name          TEXT,
    goal               TEXT CHECK (goal IN (
                           'learn_from_scratch', 'fill_gaps', 'exam_prep', 'refresher'
                       )),
    daily_time_minutes INTEGER DEFAULT 20,
    is_admin           BOOLEAN NOT NULL DEFAULT FALSE,
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile row when a Supabase user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated-at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: own read"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "profiles: own update"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Admins can read any profile (admin routes use service role, but belt-and-suspenders)
CREATE POLICY "profiles: admin read all"
    ON public.profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.is_admin = TRUE
        )
    );

-- ============================================================
-- KNOWLEDGE GRAPH: CONCEPTS
-- One row per teachable unit. Prerequisites stored separately.
-- ============================================================

CREATE TABLE public.concepts (
    id                     VARCHAR(100) PRIMARY KEY,   -- snake_case e.g. python_loops_for
    domain                 VARCHAR(100) NOT NULL,      -- e.g. python_programming
    name                   VARCHAR(255) NOT NULL,
    description            TEXT,
    difficulty             SMALLINT CHECK (difficulty BETWEEN 1 AND 5),
    bloom_level            VARCHAR(20)  CHECK (bloom_level IN (
                               'remember', 'understand', 'apply',
                               'analyze',  'evaluate',   'create'
                           )),
    estimated_minutes      SMALLINT,
    key_terms              JSONB DEFAULT '[]',
    learning_objectives    JSONB DEFAULT '[]',
    common_misconceptions  JSONB DEFAULT '[]',
    tags                   JSONB DEFAULT '[]',
    created_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_concept_domain ON public.concepts(domain);

-- ============================================================
-- KNOWLEDGE GRAPH: PREREQUISITES
-- Directed edge: concept_id requires prerequisite_id first.
-- ============================================================

CREATE TABLE public.concept_prerequisites (
    concept_id      VARCHAR(100) REFERENCES public.concepts(id) ON DELETE CASCADE,
    prerequisite_id VARCHAR(100) REFERENCES public.concepts(id) ON DELETE CASCADE,
    PRIMARY KEY (concept_id, prerequisite_id),
    CHECK (concept_id != prerequisite_id)
);

CREATE INDEX idx_prereq_concept  ON public.concept_prerequisites(concept_id);
CREATE INDEX idx_prereq_prereq   ON public.concept_prerequisites(prerequisite_id);

-- RLS: concepts are world-readable; only service role / admins may write
ALTER TABLE public.concepts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concept_prerequisites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "concepts: read all"
    ON public.concepts FOR SELECT USING (TRUE);

CREATE POLICY "concept_prerequisites: read all"
    ON public.concept_prerequisites FOR SELECT USING (TRUE);

-- ============================================================
-- HELPER VIEW: transitive prerequisites via recursive CTE
-- Usage:  SELECT * FROM concept_all_prerequisites WHERE concept_id = 'X';
-- ============================================================

CREATE OR REPLACE VIEW public.concept_all_prerequisites AS
WITH RECURSIVE prereqs AS (
    -- Direct prerequisites
    SELECT
        cp.concept_id   AS root_concept_id,
        cp.prerequisite_id,
        1               AS depth
    FROM public.concept_prerequisites cp

    UNION ALL

    -- Transitively walk up the graph
    SELECT
        p.root_concept_id,
        cp.prerequisite_id,
        p.depth + 1
    FROM public.concept_prerequisites cp
    JOIN prereqs p ON cp.concept_id = p.prerequisite_id
)
SELECT DISTINCT root_concept_id AS concept_id, prerequisite_id, depth
FROM prereqs;
