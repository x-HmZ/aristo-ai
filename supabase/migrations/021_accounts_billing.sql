-- 021_accounts_billing.sql
-- Accounts, plans, usage allowances and (sandbox) subscriptions. Launch brief L07 and L13
-- (.claude/plans/launch/README.md); plan table from .claude/plans/launch/findings/pricing.md Part C.
-- Safe to run more than once.
--
-- Security shape (the mistakes from findings/security.md C1, C3, H1, H6 are not repeated here):
--   * Every table has RLS on. Browser roles (anon, authenticated) get SELECT at most, through narrow policies;
--     INSERT / UPDATE / DELETE are revoked from them on every table, so there is no client-writable column to
--     protect with a trigger: nothing here is client-writable at all.
--   * All writes go through the service role (server routes) or the SECURITY DEFINER functions below, each with
--     SET search_path = public and EXECUTE revoked from PUBLIC, anon and authenticated.
--   * Allowances are counted in the database (usage_counters, one atomic statement per consume), never in memory,
--     and every counter row is attributed to an account.
--   * billing_events stores no webhook payload (payloads carry names, emails and addresses): only ids and times.
--
-- Three kinds of admin stay separate: profiles.is_admin is the platform admin (owner only, never sold);
-- account_members.role 'owner' holds a family or organisation account; 'org_admin' administers one
-- organisation and nothing else.

-- ── 1. plans: what can be bought, with limits and display prices as data ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.plans (
    id                  TEXT PRIMARY KEY
                        CHECK (id IN ('free', 'plus', 'pro', 'org_edu', 'org_business')),
    name                TEXT        NOT NULL,
    kind                TEXT        NOT NULL CHECK (kind IN ('family', 'organisation')),
    is_public           BOOLEAN     NOT NULL DEFAULT TRUE,
    sort_order          INTEGER     NOT NULL DEFAULT 0,
    -- Display prices in cents. EUR is VAT-inclusive, USD before sales tax (pricing.md C1). NULL = not offered in
    -- that currency or interval. For per-seat plans the price is per seat. Paddle's own prices are what is charged;
    -- these are only what the pricing page shows.
    price_month_eur     INTEGER     CHECK (price_month_eur IS NULL OR price_month_eur >= 0),
    price_year_eur      INTEGER     CHECK (price_year_eur  IS NULL OR price_year_eur  >= 0),
    price_month_usd     INTEGER     CHECK (price_month_usd IS NULL OR price_month_usd >= 0),
    price_year_usd      INTEGER     CHECK (price_year_usd  IS NULL OR price_year_usd  >= 0),
    per_seat            BOOLEAN     NOT NULL DEFAULT FALSE,
    -- Per month (per seat when per_seat): fresh_lessons, chat_turns, replays, voice_chars, models_3d, learners.
    -- Validated again by the app (src/lib/billing/plans.ts); a malformed row is treated as all zeros.
    limits              JSONB       NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(limits) = 'object'),
    contact_only        BOOLEAN     NOT NULL DEFAULT FALSE,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed once. ON CONFLICT DO NOTHING so a rerun never overwrites numbers the owner has since changed.
-- Numbers are pricing.md Part C, not yet confirmed by the owner (README D11).
INSERT INTO public.plans
    (id, name, kind, is_public, sort_order,
     price_month_eur, price_year_eur, price_month_usd, price_year_usd,
     per_seat, limits, contact_only)
VALUES
    ('free', 'Free', 'family', TRUE, 0,
     0, 0, 0, 0, FALSE,
     '{"fresh_lessons": 2, "chat_turns": 15, "replays": 30, "voice_chars": 0, "models_3d": 0, "learners": 1}', FALSE),
    ('plus', 'Plus', 'family', TRUE, 10,
     1099, 9900, 1099, 9900, FALSE,
     '{"fresh_lessons": 4, "chat_turns": 150, "replays": 100, "voice_chars": 8000, "models_3d": 0, "learners": 3}', FALSE),
    ('pro', 'Pro', 'family', TRUE, 20,
     1999, 19900, 1999, 19900, FALSE,
     '{"fresh_lessons": 8, "chat_turns": 300, "replays": 150, "voice_chars": 15000, "models_3d": 3, "learners": 5}', TRUE),
    -- Organisation prices are the smallest tier (10 to 49 education seats, 5 to 49 business seats), USD only.
    ('org_edu', 'Schools', 'organisation', TRUE, 30,
     NULL, NULL, 500, 6000, TRUE,
     '{"fresh_lessons": 0.5, "chat_turns": 100, "replays": 40, "voice_chars": 0, "models_3d": 0, "learners": 1}', TRUE),
    ('org_business', 'Companies and universities', 'organisation', TRUE, 40,
     NULL, NULL, 1200, 14400, TRUE,
     '{"fresh_lessons": 0.5, "chat_turns": 100, "replays": 40, "voice_chars": 0, "models_3d": 0, "learners": 1}', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ── 2. plan_prices: provider price id -> plan, per environment ──────────────────────────────────────────────
-- The webhook derives a subscription's plan ONLY from this table (never from names in the payload or custom
-- data). Empty until the owner creates sandbox prices in Paddle and adds one row per price.

CREATE TABLE IF NOT EXISTS public.plan_prices (
    provider            TEXT    NOT NULL CHECK (provider IN ('paddle')),
    environment         TEXT    NOT NULL CHECK (environment IN ('sandbox', 'live')),
    provider_price_id   TEXT    NOT NULL CHECK (char_length(provider_price_id) BETWEEN 1 AND 100),
    plan_id             TEXT    NOT NULL REFERENCES public.plans(id),
    billing_interval    TEXT    NOT NULL CHECK (billing_interval IN ('month', 'year')),
    PRIMARY KEY (provider, environment, provider_price_id)
);

-- ── 3. accounts and account_members ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.accounts (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    kind            TEXT        NOT NULL CHECK (kind IN ('family', 'organisation')),
    name            TEXT        NOT NULL DEFAULT '' CHECK (char_length(name) <= 200),
    -- SET NULL, not CASCADE: an organisation must survive its creator's account deletion, and the subscription
    -- history of a deleted family account is kept for accounting. Deletion policy proper is brief L06.
    owner_user_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    seat_limit      INTEGER     NOT NULL DEFAULT 1 CHECK (seat_limit >= 1),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One family account per user.
CREATE UNIQUE INDEX IF NOT EXISTS accounts_one_family_per_owner
    ON public.accounts (owner_user_id) WHERE kind = 'family';

CREATE TABLE IF NOT EXISTS public.account_members (
    account_id  UUID        NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role        TEXT        NOT NULL CHECK (role IN ('owner', 'org_admin', 'teacher', 'learner')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (account_id, user_id)
);

CREATE INDEX IF NOT EXISTS account_members_user_idx ON public.account_members (user_id);

-- ── 4. subscriptions ────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id                  UUID        NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    provider                    TEXT        NOT NULL CHECK (provider IN ('paddle')),
    environment                 TEXT        NOT NULL CHECK (environment IN ('sandbox', 'live')),
    provider_customer_id        TEXT        CHECK (char_length(provider_customer_id) <= 100),
    provider_subscription_id    TEXT        NOT NULL UNIQUE CHECK (char_length(provider_subscription_id) <= 100),
    plan_id                     TEXT        NOT NULL REFERENCES public.plans(id),
    status                      TEXT        NOT NULL
                                CHECK (status IN ('trialing', 'active', 'past_due', 'paused', 'canceled')),
    billing_interval            TEXT        CHECK (billing_interval IN ('month', 'year')),
    seats                       INTEGER     NOT NULL DEFAULT 1 CHECK (seats >= 1),
    current_period_start        TIMESTAMPTZ,
    current_period_end          TIMESTAMPTZ,
    cancel_at_period_end        BOOLEAN     NOT NULL DEFAULT FALSE,
    -- occurred_at of the newest provider event applied; older events arriving late are not applied over it.
    last_event_at               TIMESTAMPTZ NOT NULL,
    -- When the row first became past_due (the grace period counts from here); NULL in every other status.
    past_due_since              TIMESTAMPTZ,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS subscriptions_account_idx ON public.subscriptions (account_id);

-- ── 5. billing_events: the webhook idempotency key, no payload ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.billing_events (
    provider_event_id   TEXT        PRIMARY KEY CHECK (char_length(provider_event_id) BETWEEN 1 AND 100),
    provider            TEXT        NOT NULL CHECK (provider IN ('paddle')),
    type                TEXT        NOT NULL CHECK (char_length(type) <= 100),
    occurred_at         TIMESTAMPTZ NOT NULL,
    received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at        TIMESTAMPTZ,
    -- applied: changed a subscription row; ignored: recorded on purpose and not applied (unknown price,
    -- other environment, unknown account, event type not used). A replay of an applied event is skipped.
    outcome             TEXT        CHECK (outcome IN ('applied', 'ignored')),
    provider_subscription_id TEXT   CHECK (char_length(provider_subscription_id) <= 100)
);

-- ── 6. usage_counters ───────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.usage_counters (
    account_id      UUID    NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    period_start    DATE    NOT NULL,
    metric          TEXT    NOT NULL
                    CHECK (metric IN ('fresh_lessons', 'chat_turns', 'replays', 'voice_chars', 'models_3d')),
    used            BIGINT  NOT NULL DEFAULT 0 CHECK (used >= 0),
    PRIMARY KEY (account_id, period_start, metric)
);

-- ── 7. Row level security and grants ────────────────────────────────────────────────────────────────────────

ALTER TABLE public.plans            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_prices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_counters   ENABLE ROW LEVEL SECURITY;

-- Supabase grants ALL on new public tables to anon and authenticated by default. Take everything back, then give
-- SELECT where a policy allows reading. RLS alone would already refuse writes (no write policy exists); the
-- revoke makes that hold even if someone later adds a careless FOR ALL policy.
REVOKE ALL ON public.plans, public.plan_prices, public.accounts, public.account_members,
              public.subscriptions, public.billing_events, public.usage_counters
    FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.plans, public.plan_prices TO anon, authenticated;
GRANT SELECT ON public.accounts, public.account_members, public.subscriptions, public.usage_counters
    TO authenticated;
-- billing_events: no grant at all to browser roles.

GRANT ALL ON public.plans, public.plan_prices, public.accounts, public.account_members,
             public.subscriptions, public.billing_events, public.usage_counters
    TO service_role;

DROP POLICY IF EXISTS "plans: read all" ON public.plans;
CREATE POLICY "plans: read all" ON public.plans FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "plan_prices: read all" ON public.plan_prices;
CREATE POLICY "plan_prices: read all" ON public.plan_prices FOR SELECT USING (TRUE);

-- A member reads their own membership rows. This policy reads no other table, so the policies below that
-- consult account_members cannot recurse.
DROP POLICY IF EXISTS "account_members: read own" ON public.account_members;
CREATE POLICY "account_members: read own" ON public.account_members
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "accounts: members read" ON public.accounts;
CREATE POLICY "accounts: members read" ON public.accounts
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.account_members m
        WHERE m.account_id = accounts.id AND m.user_id = auth.uid()
    ));

-- Billing details are for the people who manage the account, not for a learner seat in an organisation.
DROP POLICY IF EXISTS "subscriptions: managers read" ON public.subscriptions;
CREATE POLICY "subscriptions: managers read" ON public.subscriptions
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.account_members m
        WHERE m.account_id = subscriptions.account_id AND m.user_id = auth.uid()
          AND m.role IN ('owner', 'org_admin')
    ));

DROP POLICY IF EXISTS "usage_counters: members read" ON public.usage_counters;
CREATE POLICY "usage_counters: members read" ON public.usage_counters
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.account_members m
        WHERE m.account_id = usage_counters.account_id AND m.user_id = auth.uid()
    ));

-- ── 8. A family account for every user ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ensure_family_account(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_account UUID;
BEGIN
    SELECT id INTO v_account FROM public.accounts
    WHERE owner_user_id = p_user_id AND kind = 'family';

    IF v_account IS NULL THEN
        INSERT INTO public.accounts (kind, owner_user_id, seat_limit)
        VALUES ('family', p_user_id, 1)
        ON CONFLICT (owner_user_id) WHERE kind = 'family' DO NOTHING
        RETURNING id INTO v_account;

        -- Lost a race with a concurrent call: read the winner's row.
        IF v_account IS NULL THEN
            SELECT id INTO v_account FROM public.accounts
            WHERE owner_user_id = p_user_id AND kind = 'family';
        END IF;
    END IF;

    INSERT INTO public.account_members (account_id, user_id, role)
    VALUES (v_account, p_user_id, 'owner')
    ON CONFLICT (account_id, user_id) DO NOTHING;

    RETURN v_account;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_family_account(UUID) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.ensure_family_account(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.ensure_family_account(NEW.id);
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user_account() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created_account ON auth.users;
CREATE TRIGGER on_auth_user_created_account
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_account();

-- Backfill: every existing user gets their family account (idempotent through ensure_family_account).
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM auth.users LOOP
        PERFORM public.ensure_family_account(r.id);
    END LOOP;
END;
$$;

-- ── 9. Allowances: consume and release ──────────────────────────────────────────────────────────────────────
--
-- consume_allowance is ONE statement: an INSERT ... ON CONFLICT DO UPDATE whose update carries the limit in its
-- WHERE clause. Two concurrent calls for the same (account, period, metric), each asking for 1 with used = 1 of 2:
--   * Both try the insert, both hit the existing row. ON CONFLICT DO UPDATE takes a row lock, so call B blocks
--     until call A commits (used becomes 2).
--   * Under READ COMMITTED, B then re-evaluates its update against the NEW row version (EvalPlanQual):
--     2 + 1 <= 2 is false, so B updates nothing, RETURNING yields no row, and B reports allowed = false.
--   * If no row existed yet, the first insert wins and the second waits on its speculative insertion, then takes
--     the update path with the same re-check. A first request larger than the limit inserts nothing at all.
-- So `used` can never pass `p_limit`, whatever the interleaving. Under SERIALIZABLE, B would instead fail with a
-- serialization error (40001), which the caller treats as "not allowed"; it still never overshoots.
-- The trailing SELECT only reports the current total for the 402 message; it decides nothing.

CREATE OR REPLACE FUNCTION public.consume_allowance(
    p_account_id    UUID,
    p_period_start  DATE,
    p_metric        TEXT,
    p_amount        BIGINT,
    p_limit         BIGINT
)
RETURNS TABLE (allowed BOOLEAN, used BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- The output column "used" shares its name with the table column; every reference below is qualified, and this
-- makes any unqualified one mean the column rather than the output variable.
#variable_conflict use_column
DECLARE
    v_used BIGINT;
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 OR p_limit IS NULL OR p_limit < 0 THEN
        RAISE EXCEPTION 'consume_allowance: amount must be positive and limit non-negative'
            USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.usage_counters AS c (account_id, period_start, metric, used)
    SELECT p_account_id, p_period_start, p_metric, p_amount
    WHERE p_amount <= p_limit
    ON CONFLICT (account_id, period_start, metric) DO UPDATE
        SET used = c.used + EXCLUDED.used
        WHERE c.used + EXCLUDED.used <= p_limit
    RETURNING c.used INTO v_used;

    IF v_used IS NOT NULL THEN
        RETURN QUERY SELECT TRUE, v_used;
        RETURN;
    END IF;

    SELECT c.used INTO v_used FROM public.usage_counters c
    WHERE c.account_id = p_account_id AND c.period_start = p_period_start AND c.metric = p_metric;

    RETURN QUERY SELECT FALSE, COALESCE(v_used, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_allowance(UUID, DATE, TEXT, BIGINT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.consume_allowance(UUID, DATE, TEXT, BIGINT, BIGINT) TO service_role;

-- Gives back what a failed generation consumed. Never goes below zero; a release for a period with no row is a
-- no-op. Also a single statement, so it serialises with consume_allowance on the same row lock.
CREATE OR REPLACE FUNCTION public.release_allowance(
    p_account_id    UUID,
    p_period_start  DATE,
    p_metric        TEXT,
    p_amount        BIGINT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_used BIGINT;
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'release_allowance: amount must be positive' USING ERRCODE = '22023';
    END IF;

    UPDATE public.usage_counters c
       SET used = GREATEST(c.used - p_amount, 0)
     WHERE c.account_id = p_account_id AND c.period_start = p_period_start AND c.metric = p_metric
    RETURNING c.used INTO v_used;

    RETURN COALESCE(v_used, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.release_allowance(UUID, DATE, TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.release_allowance(UUID, DATE, TEXT, BIGINT) TO service_role;

-- ── 10. Applying a provider subscription event ──────────────────────────────────────────────────────────────
-- One statement, so the ordering check and the write cannot interleave with a concurrent delivery. A row is only
-- updated by an event at least as new as the last one applied (Paddle does not guarantee delivery order). The
-- account of an existing row never changes. Returns TRUE if a row was written.

CREATE OR REPLACE FUNCTION public.apply_subscription_event(
    p_account_id                UUID,
    p_provider                  TEXT,
    p_environment               TEXT,
    p_provider_customer_id      TEXT,
    p_provider_subscription_id  TEXT,
    p_plan_id                   TEXT,
    p_status                    TEXT,
    p_billing_interval          TEXT,
    p_seats                     INTEGER,
    p_period_start              TIMESTAMPTZ,
    p_period_end                TIMESTAMPTZ,
    p_cancel_at_period_end      BOOLEAN,
    p_occurred_at               TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.subscriptions AS s
        (account_id, provider, environment, provider_customer_id, provider_subscription_id, plan_id, status,
         billing_interval, seats, current_period_start, current_period_end, cancel_at_period_end,
         last_event_at, past_due_since, updated_at)
    VALUES
        (p_account_id, p_provider, p_environment, p_provider_customer_id, p_provider_subscription_id, p_plan_id,
         p_status, p_billing_interval, GREATEST(COALESCE(p_seats, 1), 1), p_period_start, p_period_end,
         COALESCE(p_cancel_at_period_end, FALSE), p_occurred_at,
         CASE WHEN p_status = 'past_due' THEN p_occurred_at END, NOW())
    ON CONFLICT (provider_subscription_id) DO UPDATE
        SET provider_customer_id = COALESCE(EXCLUDED.provider_customer_id, s.provider_customer_id),
            plan_id              = EXCLUDED.plan_id,
            status               = EXCLUDED.status,
            billing_interval     = EXCLUDED.billing_interval,
            seats                = EXCLUDED.seats,
            current_period_start = EXCLUDED.current_period_start,
            current_period_end   = EXCLUDED.current_period_end,
            cancel_at_period_end = EXCLUDED.cancel_at_period_end,
            last_event_at        = EXCLUDED.last_event_at,
            past_due_since       = CASE
                                     WHEN EXCLUDED.status <> 'past_due' THEN NULL
                                     ELSE COALESCE(s.past_due_since, EXCLUDED.last_event_at)
                                   END,
            updated_at           = NOW()
        WHERE s.last_event_at <= EXCLUDED.last_event_at
          AND s.provider    = EXCLUDED.provider
          AND s.environment = EXCLUDED.environment
    RETURNING s.id INTO v_id;

    RETURN v_id IS NOT NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_subscription_event(
    UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_subscription_event(
    UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, TIMESTAMPTZ
) TO service_role;

-- ── Check after running (SQL editor) ────────────────────────────────────────────────────────────────────────
-- 1. Every user has exactly one family account with an owner membership (expect 0 rows):
--      SELECT u.id FROM auth.users u
--      LEFT JOIN public.accounts a ON a.owner_user_id = u.id AND a.kind = 'family'
--      LEFT JOIN public.account_members m ON m.account_id = a.id AND m.user_id = u.id AND m.role = 'owner'
--      WHERE m.user_id IS NULL;
-- 2. No browser role can write or call the functions (expect only SELECT rows, none for billing_events):
--      SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants
--      WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
--        AND table_name IN ('plans','plan_prices','accounts','account_members','subscriptions',
--                           'billing_events','usage_counters');
--      SELECT has_function_privilege('authenticated',
--             'public.consume_allowance(uuid, date, text, bigint, bigint)', 'EXECUTE');   -- expect false
-- 3. The limit holds (run as postgres; rolls back):
--      BEGIN;
--      SELECT * FROM public.consume_allowance((SELECT id FROM public.accounts LIMIT 1), '2000-01-01', 'chat_turns', 2, 2); -- t, 2
--      SELECT * FROM public.consume_allowance((SELECT id FROM public.accounts LIMIT 1), '2000-01-01', 'chat_turns', 1, 2); -- f, 2
--      ROLLBACK;
