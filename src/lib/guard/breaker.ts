/**
 * Spend ceilings, read from what was actually spent (`usage_events.cost_usd_micros`).
 *
 *   - Global circuit breaker: when today's total (UTC day, every user) passes DAILY_SPEND_LIMIT_USD (default 5),
 *     every call that would start a paid generation is answered 503 { error: "paused_for_today" }. Cached
 *     lessons, replays and everything free keep working, because the guard is only consulted on paid branches.
 *   - Per-user ceiling: the same from one user's rows, USER_DAILY_SPEND_LIMIT_USD (default 1), answered 429
 *     { error: "daily_limit_reached" }.
 * Platform admins (profiles.is_admin) bypass both.
 *
 * Sums are cached in memory for 60 seconds per instance, so this adds at most a couple of cheap queries a minute.
 * That also means a ceiling can be overshot by what is spent inside one cache window and by calls in flight
 * (usage is logged after a call succeeds); the rate limits (rate.ts) bound that, this is the second net.
 *
 * Failure policy: if the sum cannot be read and there is no earlier value to fall back on, the call is refused
 * (503), because this guard exists to stop spend. A missing `spend_since()` (migration 023 not applied) falls
 * back to summing usage_events rows directly.
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isMissingFunction } from "./rate";
import { DEFAULT_DAILY_SPEND_LIMIT_USD, DEFAULT_USER_DAILY_SPEND_LIMIT_USD } from "./limits";

const CACHE_MS = 60_000;
/** Pages of 1000 rows the fallback reads at most (50 000 rows a day is far beyond this product's size). */
const FALLBACK_PAGE = 1000;
const FALLBACK_MAX_PAGES = 50;

/** The slice of the Supabase client used here, so tests can pass a fake. */
export interface BreakerClient {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
  from(table: string): any;
}

export type BreakerDecision =
  | { ok: true }
  | { ok: false; reason: "paused_for_today" | "daily_limit_reached" | "error"; retryAfterSeconds?: number };

interface Cached<T> { value: T; at: number }
const sums  = new Map<string, Cached<number>>();
const admins = new Map<string, Cached<boolean>>();

/** Test hook. */
export function resetBreakerCache(): void {
  sums.clear();
  admins.clear();
}

/** A positive-or-zero number from the environment, else the default. 0 pauses paid generation entirely. */
export function usdLimit(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function utcDayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function secondsToUtcMidnight(now: Date): number {
  return Math.max(1, Math.ceil((utcDayStart(now).getTime() + 86_400_000 - now.getTime()) / 1000));
}

async function sumFromRows(client: BreakerClient, since: string, userId: string | null): Promise<number> {
  let total = 0;
  for (let page = 0; page < FALLBACK_MAX_PAGES; page++) {
    let q = client.from("usage_events").select("cost_usd_micros").gte("created_at", since);
    if (userId) q = q.eq("user_id", userId);
    const { data, error } = await q.range(page * FALLBACK_PAGE, (page + 1) * FALLBACK_PAGE - 1);
    if (error) throw new Error("usage_events read failed");
    const rows = (data ?? []) as Array<{ cost_usd_micros: number | null }>;
    for (const r of rows) total += Number(r.cost_usd_micros ?? 0);
    if (rows.length < FALLBACK_PAGE) break;
  }
  return total;
}

/** Micro-dollars spent since the start of the UTC day, all users (userId null) or one. Cached 60 s. */
export async function spentTodayMicros(client: BreakerClient, userId: string | null, now: Date = new Date()): Promise<number> {
  const key = userId ?? "*";
  const hit = sums.get(key);
  if (hit && now.getTime() - hit.at < CACHE_MS && utcDayStart(new Date(hit.at)).getTime() === utcDayStart(now).getTime()) {
    return hit.value;
  }
  const since = utcDayStart(now).toISOString();
  try {
    const { data, error } = await client.rpc("spend_since", { p_since: since, p_user_id: userId });
    let value: number;
    if (error) {
      if (!isMissingFunction(error)) throw new Error("spend_since failed");
      value = await sumFromRows(client, since, userId);
    } else {
      value = Number(data ?? 0);
      if (!Number.isFinite(value)) throw new Error("spend_since returned a non-number");
    }
    sums.set(key, { value, at: now.getTime() });
    return value;
  } catch (err) {
    // An old value from today is better than none; from another day it is not.
    if (hit && utcDayStart(new Date(hit.at)).getTime() === utcDayStart(now).getTime()) return hit.value;
    throw err;
  }
}

async function isPlatformAdmin(client: BreakerClient, userId: string, now: Date): Promise<boolean> {
  const hit = admins.get(userId);
  if (hit && now.getTime() - hit.at < CACHE_MS) return hit.value;
  try {
    const { data, error } = await client.from("profiles").select("is_admin").eq("id", userId).maybeSingle();
    if (error) return false;
    const value = data?.is_admin === true;
    admins.set(userId, { value, at: now.getTime() });
    return value;
  } catch {
    return false;
  }
}

export interface BreakerOptions {
  client?: BreakerClient;
  now?: Date;
  env?: { DAILY_SPEND_LIMIT_USD?: string; USER_DAILY_SPEND_LIMIT_USD?: string };
}

/** Decide whether `userId` may start a paid generation right now. Never throws. */
export async function checkBreaker(userId: string, opts: BreakerOptions = {}): Promise<BreakerDecision> {
  const now = opts.now ?? new Date();
  const env = opts.env ?? process.env;
  try {
    const client = opts.client ?? (createServiceClient() as unknown as BreakerClient);
    if (await isPlatformAdmin(client, userId, now)) return { ok: true };

    const globalLimit = usdLimit(env.DAILY_SPEND_LIMIT_USD, DEFAULT_DAILY_SPEND_LIMIT_USD) * 1_000_000;
    if ((await spentTodayMicros(client, null, now)) >= globalLimit) {
      return { ok: false, reason: "paused_for_today", retryAfterSeconds: secondsToUtcMidnight(now) };
    }

    const userLimit = usdLimit(env.USER_DAILY_SPEND_LIMIT_USD, DEFAULT_USER_DAILY_SPEND_LIMIT_USD) * 1_000_000;
    if ((await spentTodayMicros(client, userId, now)) >= userLimit) {
      return { ok: false, reason: "daily_limit_reached", retryAfterSeconds: secondsToUtcMidnight(now) };
    }
    return { ok: true };
  } catch {
    console.error("[guard] spend check failed, refusing the call");
    return { ok: false, reason: "error" };
  }
}

export function breakerResponse(d: Extract<BreakerDecision, { ok: false }>): NextResponse {
  const headers = d.retryAfterSeconds ? { "Retry-After": String(d.retryAfterSeconds) } : undefined;
  if (d.reason === "paused_for_today") {
    return NextResponse.json({ error: "paused_for_today" }, { status: 503, headers });
  }
  if (d.reason === "daily_limit_reached") {
    return NextResponse.json({ error: "daily_limit_reached" }, { status: 429, headers });
  }
  return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
}
