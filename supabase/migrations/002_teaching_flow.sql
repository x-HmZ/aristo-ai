-- ============================================================
-- Aristo AI — Migration 002: Teaching Flow
-- Adds the second learning axis (interactive vs structured)
-- and effectiveness-tracking columns.
-- ============================================================

-- Add teaching_flow to profiles (the user's assessed flow preference)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS teaching_flow TEXT
    CHECK (teaching_flow IN ('interactive', 'structured'))
    DEFAULT 'structured';

-- Counter of topics completed — used to know when to run adaptive check
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS topics_completed INT DEFAULT 0;

-- Add teaching_flow result to the style_assessments record
ALTER TABLE public.style_assessments
  ADD COLUMN IF NOT EXISTS teaching_flow TEXT
    CHECK (teaching_flow IN ('interactive', 'structured'));

-- Track which flow was active during each quiz attempt (effectiveness signal)
ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS teaching_flow_used TEXT
    CHECK (teaching_flow_used IN ('interactive', 'structured'));
