-- 011_custom_teacher.sql
-- Adds custom_teacher_glb_url to learner_profiles so users can persist
-- a Ready Player Me avatar URL as their personal teacher.

ALTER TABLE learner_profiles
  ADD COLUMN IF NOT EXISTS custom_teacher_glb_url text;
