/**
 * Database-backed rate limits: `take_rate()` (migration 023) counts atomically across every server instance.
 *
 * Failure policy, deliberate:
 *   - the function is missing (migration 023 not applied yet): FAIL OPEN, logged once, so deploying this code
 *     before the migration does not take the product down;
 *   - any other error (database down, bad arguments): FAIL CLOSED, because this guard exists to stop spend.
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { RATE_LIMITS, type GuardFeature } from "./limits";

/** The slice of the Supabase client used here, so tests can pass a fake. */
export interface RateClient {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
}

export type TakeResult =
  | { ok: true; degraded?: "missing" }
  | { ok: false; reason: "limit" | "error" };

let warnedMissing = false;
/** Test hook. */
export function resetRateWarning(): void {
  warnedMissing = false;
}

/** PostgREST answers PGRST202 for an unknown function; Postgres itself uses 42883 (undefined_function). */
export function isMissingFunction(error: { code?: string; message?: string }): boolean {
  if (error.code === "PGRST202" || error.code === "42883") return true;
  return /could not find the function|function .* does not exist/i.test(error.message ?? "");
}

/**
 * Count one call for (user, key) in a fixed window. `ok` is true when the call is within the limit.
 * Never throws.
 */
export async function takeRate(
  userId: string,
  key: string,
  windowSeconds: number,
  limit: number,
  client?: RateClient,
): Promise<TakeResult> {
  try {
    const db = client ?? (createServiceClient() as unknown as RateClient);
    const { data, error } = await db.rpc("take_rate", {
      p_user_id:        userId,
      p_key:            key,
      p_window_seconds: windowSeconds,
      p_limit:          limit,
    });
    if (error) {
      if (isMissingFunction(error)) {
        if (!warnedMissing) {
          warnedMissing = true;
          console.warn("[guard] take_rate() is missing: apply migration 023_spend_guard.sql. Rate limits are OFF until then.");
        }
        return { ok: true, degraded: "missing" };
      }
      console.error("[guard] take_rate failed, refusing the call");
      return { ok: false, reason: "error" };
    }
    return data === true ? { ok: true } : { ok: false, reason: "limit" };
  } catch {
    console.error("[guard] take_rate threw, refusing the call");
    return { ok: false, reason: "error" };
  }
}

export type RateDecision =
  | { allowed: true }
  | { allowed: false; reason: "limit" | "error"; retryAfterSeconds: number };

/** Seconds until the current fixed window of `windowSeconds` ends. */
export function secondsToWindowEnd(windowSeconds: number, nowMs: number = Date.now()): number {
  const w = windowSeconds * 1000;
  return Math.max(1, Math.ceil((w - (nowMs % w)) / 1000));
}

/** Every window of the feature (hourly and daily) must pass. Stops at the first that does not. */
export async function enforceRate(userId: string, feature: GuardFeature, client?: RateClient): Promise<RateDecision> {
  for (const w of RATE_LIMITS[feature]) {
    const r = await takeRate(userId, `${feature}:${w.seconds}`, w.seconds, w.limit, client);
    if (!r.ok) return { allowed: false, reason: r.reason, retryAfterSeconds: secondsToWindowEnd(w.seconds) };
  }
  return { allowed: true };
}

export function rateLimitedResponse(d: Extract<RateDecision, { allowed: false }>): NextResponse {
  if (d.reason === "error") {
    return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
  }
  return NextResponse.json(
    { error: "rate_limited", retryAfterSeconds: d.retryAfterSeconds },
    { status: 429, headers: { "Retry-After": String(d.retryAfterSeconds) } },
  );
}
