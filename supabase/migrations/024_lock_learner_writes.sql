-- 024_lock_learner_writes.sql
-- ============================================================================================================
-- !!  APPLY THIS ONLY AFTER THE CODE THAT WRITES THESE TABLES WITH THE SERVICE ROLE IS DEPLOYED.            !!
-- !!  The code deployed before that change writes quiz_attempts, user_concept_mastery, session_logs and      !!
-- !!  user_misconceptions with the signed-in user's own client. Once this migration is applied, those        !!
-- !!  writes are refused (permission denied) and every learner's quiz answers, mastery, SRS schedule and     !!
-- !!  session logs silently stop being saved until the new code is live.                                     !!
-- ============================================================================================================
-- Closes H6 of the 2026-11-16 audit (.claude/plans/launch/findings/security.md). Safe to run more than once.
--
-- Migration 006 gave each of these tables a "FOR ALL USING (auth.uid() = user_id)" policy, so a signed-in user
-- could write any rows they liked straight through the public REST API: forged mastery, crafted
-- quiz_attempts.misconception_detected rows that flip moderation for everyone, and unlimited rows and jsonb
-- (database flooding). The application now writes all four tables only on the server, after authenticating the
-- user, with the service role and that user's id. Reads of one's own rows stay (the SELECT policy and grant).
--
-- Table privileges are revoked rather than the policies dropped: it is the stronger lock (it holds even if a
-- policy is added back by mistake) and leaves the SELECT path of the existing "own all" policy untouched.
--
-- Not covered here on purpose: learner_profiles and user_course_progress (the app still reads them with the user
-- client and writes learner_profiles from /api/profile/session and custom-teacher with the user client), and
-- any table not listed.

-- ── 1. No client writes ──────────────────────────────────────────────────────────────────────────────────────

REVOKE INSERT, UPDATE, DELETE ON public.quiz_attempts       FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.user_concept_mastery FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.session_logs        FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.user_misconceptions FROM authenticated, anon;

-- Reads of one's own rows keep working through the existing RLS policies; make sure the grant is there.
GRANT SELECT ON public.quiz_attempts, public.user_concept_mastery, public.session_logs, public.user_misconceptions
    TO authenticated;

-- ── 2. increment_misconception(): service role only ──────────────────────────────────────────────────────────
-- 018 let `authenticated` call it for their own rows, which is still a client write path into
-- user_misconceptions (row and text flooding). The server calls it with the service role.

REVOKE EXECUTE ON FUNCTION public.increment_misconception(UUID, VARCHAR, TEXT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.increment_misconception(UUID, VARCHAR, TEXT) TO service_role;

-- ── Check after running (SQL editor) ─────────────────────────────────────────────────────────────────────────
-- SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants
--  WHERE table_name IN ('quiz_attempts','user_concept_mastery','session_logs','user_misconceptions')
--    AND grantee IN ('authenticated','anon');
--   expect: only SELECT for authenticated, nothing for anon.
-- Then, signed in as a test learner in the app: answer one quiz question; /admin shows the attempt and the
-- mastery row appears. In the browser console, a direct supabase.from('quiz_attempts').insert(...) must fail
-- with 42501.
