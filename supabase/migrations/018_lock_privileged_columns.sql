-- 018_lock_privileged_columns.sql
-- Closes two holes found in the 2026-11-16 security audit (.claude/plans/launch/findings/security.md, C1 and H5).
-- Safe to run more than once.
--
-- 1. profiles: the "own update" policy lets a signed-in user update their own row, and nothing limited WHICH
--    columns. With the public anon key a user could set is_admin = true or approval_status = 'approved' on
--    themselves from the browser. Every legitimate write to those columns goes through the service role
--    (admin routes, the sign-up email marker), so end-user roles lose the ability to change them.
-- 2. increment_misconception(): SECURITY DEFINER with a caller-chosen user id and no ownership check, so any
--    signed-in user could write rows for another user.

-- ── 1. profiles: privileged columns are read-only for end-user roles ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    -- PostgREST runs browser requests as "authenticated" or "anon". The service role, the SQL editor and
    -- SECURITY DEFINER functions run as other roles and are not restricted here.
    IF current_user IN ('authenticated', 'anon') AND (
           NEW.id                IS DISTINCT FROM OLD.id
        OR NEW.is_admin          IS DISTINCT FROM OLD.is_admin
        OR NEW.approval_status   IS DISTINCT FROM OLD.approval_status
        OR NEW.approved_at       IS DISTINCT FROM OLD.approved_at
        OR NEW.approved_by       IS DISTINCT FROM OLD.approved_by
        OR NEW.admin_notified_at IS DISTINCT FROM OLD.admin_notified_at
    ) THEN
        RAISE EXCEPTION 'profiles: this column cannot be changed by the account owner'
            USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_privileged ON public.profiles;
CREATE TRIGGER profiles_guard_privileged
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_columns();

-- State the row check explicitly instead of relying on USING being reused for the new row.
ALTER POLICY "profiles: own update" ON public.profiles
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ── 2. increment_misconception(): only for the caller's own rows ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_misconception(
    p_user_id    UUID,
    p_concept_id VARCHAR(100),
    p_text       TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- auth.role() reads the request's JWT, so it still names the real caller inside a SECURITY DEFINER function.
    IF COALESCE(auth.role(), '') <> 'service_role'
       AND (auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid()) THEN
        RAISE EXCEPTION 'increment_misconception: not your row'
            USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.user_misconceptions
        (user_id, concept_id, misconception, occurrence_count, last_detected)
    VALUES
        (p_user_id, p_concept_id, LEFT(p_text, 500), 1, NOW())
    ON CONFLICT (user_id, concept_id, misconception)
    DO UPDATE SET
        occurrence_count = user_misconceptions.occurrence_count + 1,
        last_detected    = NOW();
END;
$$;

-- Functions are executable by PUBLIC unless revoked; only signed-in users and the service role need this one.
REVOKE EXECUTE ON FUNCTION public.increment_misconception(UUID, VARCHAR, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.increment_misconception(UUID, VARCHAR, TEXT) TO authenticated, service_role;

-- ── Check after running (SQL editor) ────────────────────────────────────────────────────────────────────────
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.profiles'::regclass AND NOT tgisinternal;
--   expect: profiles_guard_privileged, profiles_updated_at
-- Then, signed in as a NON-admin test account in the browser console of the app:
--   an update of your own profile's is_admin must fail with code 42501, and an update of goal must succeed.
