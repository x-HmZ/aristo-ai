-- ============================================================
-- Aristo AI — Migration 004: Admin Role
--
-- Adds is_admin flag to profiles.
-- Admin API routes use the Supabase service-role key (bypasses
-- RLS entirely), so no extra RLS policies are required.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
