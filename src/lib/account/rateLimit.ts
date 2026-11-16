/**
 * A simple per-key rate limit for the account routes and sign-up actions.
 *
 * Instance-local and best effort, like src/lib/interactive/throttle.ts: a serverless instance forgets, so this
 * slows a script down but does not stop one. It keeps keys in memory only (nothing is written anywhere), so an
 * IP address used as a key is never stored. The real abuse brakes are confirmed email, Turnstile and the
 * provider's own limits (Supabase Auth rate limits).
 */

import { createThrottle, type Throttle } from "@/lib/interactive/throttle";

const buckets = new Map<string, Throttle>();

/** True when this call is within `limit` calls per `windowMs` for `key` in `bucket`. */
export function allowCall(bucket: string, key: string, limit: number, windowMs: number, now?: number): boolean {
  const id = `${bucket}:${limit}:${windowMs}`;
  let t = buckets.get(id);
  if (!t) {
    t = createThrottle(limit, windowMs);
    buckets.set(id, t);
  }
  return t.take(key, now);
}

/** Test helper. */
export function resetRateLimits(): void {
  buckets.clear();
}

/** First address of x-forwarded-for, or "unknown". Used only as an in-memory key. */
export function clientKey(headers: { get(name: string): string | null }): string {
  const fwd = headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
