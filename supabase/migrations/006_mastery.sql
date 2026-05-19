-- ============================================================
-- Aristo AI — Migration 006: Learner Profile + Mastery
--
-- Adds per-user dynamic profile, per-concept mastery scores
-- with spaced-repetition fields, course progress tracking,
-- misconception log, and session behavioral logs.
-- ============================================================

-- ============================================================
-- LEARNER DYNAMIC PROFILE
-- Behaviorally inferred — never self-reported.
-- ============================================================

CREATE TABLE public.learner_profiles (
    user_id            UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    expertise_level    VARCHAR(20) DEFAULT 'beginner'  CHECK (expertise_level IN ('beginner', 'intermediate', 'advanced')),
    pace               VARCHAR(20) DEFAULT 'moderate'  CHECK (pace IN ('fast', 'moderate', 'careful')),
    explanation_depth  VARCHAR(20) DEFAULT 'moderate'  CHECK (explanation_depth IN ('concise', 'moderate', 'detailed')),
    example_preference VARCHAR(20) DEFAULT 'concrete'  CHECK (example_preference IN ('abstract', 'concrete', 'mixed')),
    engagement_pattern VARCHAR(20) DEFAULT 'steady'    CHECK (engagement_pattern IN ('steady', 'burst', 'declining')),
    weakest_bloom_level  VARCHAR(20),
    strongest_bloom_level VARCHAR(20),
    updated_at         TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.learner_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "learner_profiles: own all"
    ON public.learner_profiles FOR ALL
    USING (auth.uid() = user_id);

-- Auto-create learner_profile row alongside the profiles row
CREATE OR REPLACE FUNCTION public.handle_new_learner_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.learner_profiles (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created
    AFTER INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_learner_profile();

-- ============================================================
-- USER CONCEPT MASTERY + SPACED REPETITION
-- One row per (user, concept). Updated after every quiz answer.
-- ============================================================

CREATE TABLE public.user_concept_mastery (
    user_id                UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    concept_id             VARCHAR(100) REFERENCES public.concepts(id) ON DELETE CASCADE,
    mastery_score          NUMERIC(5,4)  DEFAULT 0.0000 CHECK (mastery_score BETWEEN 0 AND 1),
    assessment_count       INTEGER       DEFAULT 0,
    last_assessed          TIMESTAMPTZ,
    -- Spaced repetition fields (simplified FSRS)
    srs_interval_days      NUMERIC(8,2)  DEFAULT 1.0,
    srs_next_review        TIMESTAMPTZ,
    srs_stability          NUMERIC(6,2)  DEFAULT 1.0,
    srs_difficulty         NUMERIC(4,3)  DEFAULT 0.5  CHECK (srs_difficulty BETWEEN 0 AND 1),
    srs_consecutive_correct INTEGER      DEFAULT 0,
    srs_lapses             INTEGER       DEFAULT 0,
    PRIMARY KEY (user_id, concept_id)
);

CREATE INDEX idx_mastery_user   ON public.user_concept_mastery(user_id);
CREATE INDEX idx_mastery_review ON public.user_concept_mastery(user_id, srs_next_review);

ALTER TABLE public.user_concept_mastery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mastery: own all"
    ON public.user_concept_mastery FOR ALL
    USING (auth.uid() = user_id);

-- ============================================================
-- USER COURSE PROGRESS
-- Tracks which course a user is in and how far they've gotten.
-- ============================================================

CREATE TABLE public.user_course_progress (
    user_id            UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id          VARCHAR(100),                    -- FK added in migration 008
    domain             VARCHAR(100) NOT NULL,           -- e.g. 'python_programming'
    status             VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'paused')),
    current_module_id  VARCHAR(100),
    current_lesson_id  VARCHAR(100),
    current_concept_id VARCHAR(100) REFERENCES public.concepts(id) ON DELETE SET NULL,
    started_at         TIMESTAMPTZ DEFAULT NOW(),
    last_activity      TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, domain)
);

ALTER TABLE public.user_course_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "course_progress: own all"
    ON public.user_course_progress FOR ALL
    USING (auth.uid() = user_id);

-- ============================================================
-- USER MISCONCEPTIONS
-- Detected during quiz/challenge evaluation.
-- ============================================================

CREATE TABLE public.user_misconceptions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    concept_id       VARCHAR(100) REFERENCES public.concepts(id) ON DELETE CASCADE,
    misconception    TEXT NOT NULL,
    occurrence_count INTEGER DEFAULT 1,
    first_detected   TIMESTAMPTZ DEFAULT NOW(),
    last_detected    TIMESTAMPTZ DEFAULT NOW(),
    resolved         BOOLEAN DEFAULT FALSE,
    resolved_at      TIMESTAMPTZ
);

CREATE INDEX idx_misconception_user ON public.user_misconceptions(user_id, resolved);

ALTER TABLE public.user_misconceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "misconceptions: own all"
    ON public.user_misconceptions FOR ALL
    USING (auth.uid() = user_id);

-- ============================================================
-- SESSION BEHAVIORAL LOGS
-- Signals from each learning session used to update
-- the learner's dynamic profile (Phase 7 behavioral profiling).
-- ============================================================

CREATE TABLE public.session_logs (
    id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                      UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_start                TIMESTAMPTZ DEFAULT NOW(),
    session_end                  TIMESTAMPTZ,
    concepts_viewed              JSONB DEFAULT '[]',
    time_on_explanations_seconds INTEGER DEFAULT 0,
    time_on_examples_seconds     INTEGER DEFAULT 0,
    time_on_quizzes_seconds      INTEGER DEFAULT 0,
    clicked_explain_more         INTEGER DEFAULT 0,
    clicked_show_example         INTEGER DEFAULT 0,
    clicked_skip_to_quiz         INTEGER DEFAULT 0,
    quiz_accuracy                NUMERIC(3,2),
    questions_attempted          INTEGER DEFAULT 0,
    questions_correct            INTEGER DEFAULT 0
);

CREATE INDEX idx_session_user ON public.session_logs(user_id);

ALTER TABLE public.session_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_logs: own all"
    ON public.session_logs FOR ALL
    USING (auth.uid() = user_id);

-- ============================================================
-- QUIZ ATTEMPTS (spec §9 shape — replaces old table)
-- ============================================================

CREATE TABLE public.quiz_attempts (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    concept_id           VARCHAR(100) REFERENCES public.concepts(id) ON DELETE SET NULL,
    question_type        VARCHAR(30),                -- multiple_choice, short_answer, etc.
    bloom_level          VARCHAR(20),
    question             TEXT NOT NULL,
    correct_answer       TEXT NOT NULL,
    user_answer          TEXT,
    is_correct           BOOLEAN,
    score                NUMERIC(3,2),              -- 0.00–1.00 (partial credit)
    difficulty           NUMERIC(3,2),
    response_time_seconds INTEGER,
    misconception_detected VARCHAR(255),
    feedback_given       TEXT,
    context              VARCHAR(20) DEFAULT 'lesson' CHECK (context IN ('lesson', 'module_checkpoint', 'review')),
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quiz_user    ON public.quiz_attempts(user_id);
CREATE INDEX idx_quiz_concept ON public.quiz_attempts(user_id, concept_id);
CREATE INDEX idx_quiz_bloom   ON public.quiz_attempts(user_id, bloom_level);

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quiz_attempts: own all"
    ON public.quiz_attempts FOR ALL
    USING (auth.uid() = user_id);
