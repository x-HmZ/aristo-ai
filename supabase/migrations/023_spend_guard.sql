-- 023_spend_guard.sql
-- Database-backed rate limits and spend sums for the spend guard (src/lib/guard/).
-- Safe to run more than once, and safe to run BEFORE the code that uses it is deployed: nothing here changes
-- existing behaviour. Until it is applied the application logs once and lets rate-limited requests through
-- (the per-user and global spend ceilings fall back to reading usage_events directly).
--
-- 1. rate_counters + take_rate(): a fixed-window counter per (user, key). One statement, so concurrent calls
--    cannot both pass the limit. Replaces the per-server-instance in-memory throttles, which do nothing on
--    serverless because every instance starts with an empty counter.
-- 2. spend_since(): SUM(cost_usd_micros) over usage_events, for the global daily circuit breaker and the
--    per-user daily ceiling. Cheaper than pulling rows through PostgREST.
-- Both functions are executable by the service role only; the application calls them with the service client
-- after it has authenticated the user.

-- ── 1. Rate counters ─────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rate_counters (
    user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    key           TEXT        NOT NULL,
    window_start  TIMESTAMPTZ NOT NULL,
    count         INTEGER     NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, key, window_start)
);

-- Old windows are dead weight; this lets prune_rate_counters() find them without a scan.
CREATE INDEX IF NOT EXISTS idx_rate_counters_window ON public.rate_counters (window_start);

-- RLS on and NO policy: no client role can read or write it. Only the service role (which bypasses RLS) and the
-- SECURITY DEFINER functions below touch it.
ALTER TABLE public.rate_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_counters FROM PUBLIC, anon, authenticated;

-- take_rate is ONE statement: an INSERT ... ON CONFLICT DO UPDATE whose update carries the limit in its WHERE
-- clause (the same trick as consume_allowance in 021_accounts_billing.sql).
--   * The window is fixed: window_start is `now()` rounded down to a multiple of p_window_seconds since the epoch,
--     so every caller in the same window addresses the same row.
--   * Two concurrent calls for the same row: ON CONFLICT DO UPDATE takes a row lock, the second waits for the
--     first to commit, then re-evaluates its WHERE against the new row version (count < p_limit). The count can
--     therefore never pass p_limit, whatever the interleaving.
--   * A call that is over the limit updates nothing, RETURNING yields no row, and the function answers FALSE
--     without incrementing, so a flood does not inflate the counter.
-- Returns TRUE when the call is within the limit (and has been counted), FALSE when it is not.
CREATE OR REPLACE FUNCTION public.take_rate(
    p_user_id        UUID,
    p_key            TEXT,
    p_window_seconds INTEGER,
    p_limit          INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_window_start TIMESTAMPTZ;
    v_count        INTEGER;
BEGIN
    IF p_user_id IS NULL OR p_key IS NULL OR p_window_seconds IS NULL OR p_window_seconds <= 0 THEN
        RAISE EXCEPTION 'take_rate: bad arguments' USING ERRCODE = '22023';
    END IF;
    IF p_limit IS NULL OR p_limit <= 0 THEN
        RETURN FALSE;
    END IF;

    v_window_start := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);

    INSERT INTO public.rate_counters AS rc (user_id, key, window_start, count)
    VALUES (p_user_id, p_key, v_window_start, 1)
    ON CONFLICT (user_id, key, window_start) DO UPDATE
        SET count = rc.count + 1
        WHERE rc.count < p_limit
    RETURNING rc.count INTO v_count;

    RETURN v_count IS NOT NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.take_rate(UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.take_rate(UUID, TEXT, INTEGER, INTEGER) TO service_role;

-- Housekeeping: counters older than a few days are never read again. Call from a scheduled job or by hand:
--   SELECT public.prune_rate_counters();
CREATE OR REPLACE FUNCTION public.prune_rate_counters(p_older_than INTERVAL DEFAULT INTERVAL '3 days')
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted BIGINT;
BEGIN
    DELETE FROM public.rate_counters WHERE window_start < now() - p_older_than;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prune_rate_counters(INTERVAL) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.prune_rate_counters(INTERVAL) TO service_role;

-- ── 2. Spend sums ────────────────────────────────────────────────────────────────────────────────────────────

-- Total cost in micro-dollars since p_since: every user when p_user_id is NULL, otherwise that user's rows.
CREATE OR REPLACE FUNCTION public.spend_since(p_since TIMESTAMPTZ, p_user_id UUID DEFAULT NULL)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(SUM(cost_usd_micros), 0)::BIGINT
      FROM public.usage_events
     WHERE created_at >= p_since
       AND (p_user_id IS NULL OR user_id = p_user_id);
$$;

REVOKE EXECUTE ON FUNCTION public.spend_since(TIMESTAMPTZ, UUID) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.spend_since(TIMESTAMPTZ, UUID) TO service_role;

-- ── Check after running (SQL editor, as postgres; rolls back) ────────────────────────────────────────────────
-- 1. The limit holds (use any existing auth user id):
--      BEGIN;
--      SELECT public.take_rate((SELECT id FROM auth.users LIMIT 1), 'test', 3600, 2);   -- t
--      SELECT public.take_rate((SELECT id FROM auth.users LIMIT 1), 'test', 3600, 2);   -- t
--      SELECT public.take_rate((SELECT id FROM auth.users LIMIT 1), 'test', 3600, 2);   -- f
--      ROLLBACK;
-- 2. No client role can call it:
--      SELECT has_function_privilege('authenticated', 'public.take_rate(uuid, text, integer, integer)', 'EXECUTE');  -- false
--      SELECT has_function_privilege('anon',          'public.spend_since(timestamptz, uuid)', 'EXECUTE');           -- false
-- 3. SELECT public.spend_since(date_trunc('day', now()));   -- today's spend in micro-dollars
