-- ============================================================
-- Aristo AI — Migration 003: Learning Style Redesign
--
-- Replaces the original 4-style system (visual/simple/metaphor/technical)
-- with a model grounded in Felder-Silverman Learning Styles (FSLSM):
--
--   Processing axis  :  active  ↔  reflective
--   Understanding axis: global  ↔  sequential
--   Combined 4 profiles: explorer | builder | synthesizer | analyst
--
-- The engagement axis (interactive / structured) from migration 002 is kept.
-- ============================================================

-- ── profiles ────────────────────────────────────────────────────────────────

-- 1. Drop old constraint so the UPDATE below isn't blocked
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_learning_style_check;

-- 2. Reset any rows that still carry old values BEFORE the new constraint lands
UPDATE public.profiles
  SET learning_style = 'explorer'
  WHERE learning_style NOT IN ('explorer', 'builder', 'synthesizer', 'analyst');

-- 3. Now safe to add the new constraint and default
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_learning_style_check
    CHECK (learning_style IN ('explorer', 'builder', 'synthesizer', 'analyst'));

ALTER TABLE public.profiles
  ALTER COLUMN learning_style SET DEFAULT 'explorer';

-- ── style_assessments ────────────────────────────────────────────────────────

-- Add score columns for the new 4 profiles (keep old columns for now to
-- avoid breaking any existing data; app code only writes to the new ones)
ALTER TABLE public.style_assessments
  ADD COLUMN IF NOT EXISTS explorer    INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS builder     INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS synthesizer INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS analyst     INT DEFAULT 0;

-- Update result_style constraint
ALTER TABLE public.style_assessments
  DROP CONSTRAINT IF EXISTS style_assessments_result_style_check;

-- Reset stale rows before adding the new constraint
UPDATE public.style_assessments
  SET result_style = 'explorer'
  WHERE result_style NOT IN ('explorer', 'builder', 'synthesizer', 'analyst');

ALTER TABLE public.style_assessments
  ADD CONSTRAINT style_assessments_result_style_check
    CHECK (result_style IN ('explorer', 'builder', 'synthesizer', 'analyst'));

-- ── sessions ─────────────────────────────────────────────────────────────────

ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_active_style_check;

-- Reset stale rows before adding the new constraint
UPDATE public.sessions
  SET active_style = 'explorer'
  WHERE active_style NOT IN ('explorer', 'builder', 'synthesizer', 'analyst');

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_active_style_check
    CHECK (active_style IN ('explorer', 'builder', 'synthesizer', 'analyst'));

ALTER TABLE public.sessions
  ALTER COLUMN active_style SET DEFAULT 'explorer';

-- ── quiz_attempts ─────────────────────────────────────────────────────────────

ALTER TABLE public.quiz_attempts
  DROP CONSTRAINT IF EXISTS quiz_attempts_style_used_check;

-- Reset stale rows before adding the new constraint
UPDATE public.quiz_attempts
  SET style_used = 'explorer'
  WHERE style_used NOT IN ('explorer', 'builder', 'synthesizer', 'analyst');

ALTER TABLE public.quiz_attempts
  ADD CONSTRAINT quiz_attempts_style_used_check
    CHECK (style_used IN ('explorer', 'builder', 'synthesizer', 'analyst'));
