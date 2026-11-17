-- 025_account_lifecycle.sql
-- Account lifecycle for public sign-up. Launch brief L06 (.claude/plans/launch/README.md); requirements and legal
-- reasons in .claude/plans/launch/findings/compliance.md (account and age model, must-have items 4, 5, 6, 12, 13).
-- Safe to run more than once.
--
-- Model for launch: ONE learner per account. Someone under 16 never holds credentials: a parent or guardian creates
-- and owns the account and gives the learner's nickname and school grade. So the learner fields live on profiles,
-- and no learner table is keyed by a new learner id (several learners per account come later).
--
-- What is stored, and what is deliberately not:
--   * account_holder  'self' (the person signing in is the learner, 16 or older) or 'guardian' (a parent or legal
--                     guardian signs in on behalf of a learner under 16).
--   * learner_age_band 'under_13' | '13_15' | '16_plus'. A band, not a date of birth. No IP address anywhere.
--   * learner_nickname, learner_grade: a nickname (never a full name) and the school grade the parent gives.
--   * allow_voice_input, allow_free_chat, allow_custom_teacher: child-safety switches (compliance.md section 6,
--     point 7). Off for a guardian-held account until the guardian turns them on; the guardian CAN change them.
--   * deleted_at: set as the first step of a self-service deletion, so a deletion that stops half-way leaves a
--     marker the access gate respects.
--   * consents: one row per document the user accepted, with the document version and the time.
--
-- Rows that already exist get: account_holder 'self', learner_age_band '16_plus', all three switches TRUE, no
-- nickname, no grade, deleted_at NULL. Existing users therefore keep exactly what they have today. They have no
-- consents rows: with ACCESS_MODE=open they would need to accept the documents once (the app asks); with the
-- default ACCESS_MODE=approval nothing changes for them.
--
-- Rows created AFTER this migration start restrictive: account_holder 'guardian', learner_age_band 'under_13' and
-- the three switches FALSE. The sign-up server action then sets the real values with the service role. If that
-- step ever fails, the half-created account stays at the safest setting and has no consents rows, so it cannot
-- start lessons when ACCESS_MODE=open.

-- ── 1. profiles: new columns ────────────────────────────────────────────────────────────────────────────────

-- ADD COLUMN with a default fills existing rows with that default (the values for existing users, above).
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS account_holder        TEXT        NOT NULL DEFAULT 'self'
        CHECK (account_holder IN ('self', 'guardian')),
    ADD COLUMN IF NOT EXISTS learner_nickname      TEXT
        CHECK (learner_nickname IS NULL OR char_length(learner_nickname) BETWEEN 1 AND 40),
    ADD COLUMN IF NOT EXISTS learner_grade         TEXT
        CHECK (learner_grade IS NULL OR learner_grade IN ('6', '7', '8', 'other')),
    ADD COLUMN IF NOT EXISTS learner_age_band      TEXT        NOT NULL DEFAULT '16_plus'
        CHECK (learner_age_band IN ('under_13', '13_15', '16_plus')),
    ADD COLUMN IF NOT EXISTS allow_voice_input     BOOLEAN     NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS allow_free_chat       BOOLEAN     NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS allow_custom_teacher  BOOLEAN     NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS deleted_at            TIMESTAMPTZ;

-- Existing rows are filled; from now on a new row (created by the auth trigger) starts at the safest setting.
ALTER TABLE public.profiles
    ALTER COLUMN account_holder       SET DEFAULT 'guardian',
    ALTER COLUMN learner_age_band     SET DEFAULT 'under_13',
    ALTER COLUMN allow_voice_input    SET DEFAULT FALSE,
    ALTER COLUMN allow_free_chat      SET DEFAULT FALSE,
    ALTER COLUMN allow_custom_teacher SET DEFAULT FALSE;

-- ── 2. profiles: protect account_holder, learner_age_band and deleted_at ────────────────────────────────────
-- Same trigger as 018 with three more columns. The age rule must not be editable from the browser with the public
-- anon key: only the server (service role) sets account_holder and learner_age_band, at sign-up. The three
-- allow_* switches and the nickname and grade are deliberately NOT in this list: the guardian changes them from
-- /account through the normal profile update.

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') AND (
           NEW.id                IS DISTINCT FROM OLD.id
        OR NEW.is_admin          IS DISTINCT FROM OLD.is_admin
        OR NEW.approval_status   IS DISTINCT FROM OLD.approval_status
        OR NEW.approved_at       IS DISTINCT FROM OLD.approved_at
        OR NEW.approved_by       IS DISTINCT FROM OLD.approved_by
        OR NEW.admin_notified_at IS DISTINCT FROM OLD.admin_notified_at
        OR NEW.account_holder    IS DISTINCT FROM OLD.account_holder
        OR NEW.learner_age_band  IS DISTINCT FROM OLD.learner_age_band
        OR NEW.deleted_at        IS DISTINCT FROM OLD.deleted_at
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

-- ── 3. consents: what the user accepted, and when ───────────────────────────────────────────────────────────
-- kind 'terms' and 'privacy': the user accepted that document version. 'guardian_declaration': the person who
-- created the account declared they are the learner's parent or legal guardian and 18 or older. The row proves
-- the declaration was made and when; it is not identity verification. Evidence is the version and the time only:
-- no IP address, no user agent, no date of birth.
-- Insert-only: browser roles can read their own rows and nothing else; only the service role writes. A trigger
-- refuses UPDATE for everyone, so a consent record is never edited, only added to. It disappears with the
-- account (ON DELETE CASCADE) because deleting the account deletes the user's data.

CREATE TABLE IF NOT EXISTS public.consents (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kind             TEXT        NOT NULL CHECK (kind IN ('terms', 'privacy', 'guardian_declaration')),
    document_version TEXT        NOT NULL CHECK (char_length(document_version) BETWEEN 1 AND 40),
    granted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, kind, document_version)
);

CREATE INDEX IF NOT EXISTS consents_user_idx ON public.consents (user_id);

ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;

-- Supabase grants ALL on new public tables to anon and authenticated; take it back (same pattern as 021).
REVOKE ALL ON public.consents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.consents TO authenticated;
GRANT ALL    ON public.consents TO service_role;

DROP POLICY IF EXISTS "consents: read own" ON public.consents;
CREATE POLICY "consents: read own" ON public.consents
    FOR SELECT USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.consents_refuse_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    RAISE EXCEPTION 'consents: a consent record is never updated, add a new row instead'
        USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS consents_no_update ON public.consents;
CREATE TRIGGER consents_no_update
    BEFORE UPDATE ON public.consents
    FOR EACH ROW EXECUTE FUNCTION public.consents_refuse_update();

-- ── Check after running (SQL editor) ────────────────────────────────────────────────────────────────────────
-- 1. Existing users kept today's behaviour (expect 0 rows):
--      SELECT id FROM public.profiles
--      WHERE created_at < (SELECT MIN(created_at) FROM public.consents)   -- or any date before sign-ups opened
--        AND (account_holder <> 'self' OR learner_age_band <> '16_plus'
--             OR NOT (allow_voice_input AND allow_free_chat AND allow_custom_teacher));
--    (if consents is still empty, replace the subquery by the date you applied this migration)
-- 2. The trigger lists the new columns: SELECT prosrc FROM pg_proc WHERE proname = 'guard_profile_privileged_columns';
-- 3. Signed in as a NON-admin test account in the browser console of the app:
--      an update of your own profile's account_holder or learner_age_band must fail with code 42501;
--      an update of allow_voice_input or learner_nickname must succeed;
--      an insert into consents must fail (permission denied); a select of your own consents must work.
