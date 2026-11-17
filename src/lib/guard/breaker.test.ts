import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => ({}) }));

import { breakerResponse, checkBreaker, resetBreakerCache, usdLimit, utcDayStart, type BreakerClient } from "@/lib/guard/breaker";

const NOW = new Date("2026-11-17T10:00:00Z");

function fake(opts: { global?: number; user?: number; admin?: boolean; rpcError?: { code?: string; message?: string }; rows?: number[] }) {
  const calls: Array<Record<string, unknown>> = [];
  const client: BreakerClient = {
    rpc: async (_fn, args) => {
      calls.push(args);
      if (opts.rpcError) return { data: null, error: opts.rpcError };
      return { data: args.p_user_id ? (opts.user ?? 0) : (opts.global ?? 0), error: null };
    },
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.gte = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = async () => ({ data: { is_admin: opts.admin === true }, error: null });
      chain.range = async () => ({ data: (opts.rows ?? []).map((c) => ({ cost_usd_micros: c })), error: null });
      expect(["profiles", "usage_events"]).toContain(table);
      return chain;
    },
  };
  return { client, calls };
}

beforeEach(() => {
  resetBreakerCache();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("checkBreaker", () => {
  it("passes under both ceilings", async () => {
    const { client } = fake({ global: 4_000_000, user: 900_000 });
    expect(await checkBreaker("u1", { client, now: NOW, env: {} })).toEqual({ ok: true });
  });

  it("pauses everything when the day total passes the global limit (default 5 USD)", async () => {
    const { client } = fake({ global: 5_000_000, user: 0 });
    const d = await checkBreaker("u1", { client, now: NOW, env: {} });
    expect(d).toMatchObject({ ok: false, reason: "paused_for_today" });
    const res = breakerResponse(d as never);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "paused_for_today" });
  });

  it("refuses one user at their own ceiling (default 1 USD), not others", async () => {
    const { client } = fake({ global: 1_000_000, user: 1_000_000 });
    expect(await checkBreaker("u1", { client, now: NOW, env: {} })).toMatchObject({ ok: false, reason: "daily_limit_reached" });
  });

  it("environment overrides the defaults", async () => {
    const { client } = fake({ global: 6_000_000, user: 0 });
    expect(await checkBreaker("u1", { client, now: NOW, env: { DAILY_SPEND_LIMIT_USD: "10" } })).toEqual({ ok: true });
  });

  it("platform admins bypass both", async () => {
    const { client } = fake({ global: 99_000_000, user: 99_000_000, admin: true });
    expect(await checkBreaker("admin", { client, now: NOW, env: {} })).toEqual({ ok: true });
  });

  it("caches the sums for 60 seconds, then re-reads", async () => {
    const { client, calls } = fake({ global: 0, user: 0 });
    await checkBreaker("u1", { client, now: NOW, env: {} });
    await checkBreaker("u1", { client, now: new Date(NOW.getTime() + 30_000), env: {} });
    expect(calls).toHaveLength(2); // global + user, once
    await checkBreaker("u1", { client, now: new Date(NOW.getTime() + 61_000), env: {} });
    expect(calls).toHaveLength(4);
  });

  it("falls back to summing rows when spend_since is missing", async () => {
    const { client } = fake({ rpcError: { code: "PGRST202" }, rows: [3_000_000, 2_500_000] });
    expect(await checkBreaker("u1", { client, now: NOW, env: {} })).toMatchObject({ ok: false, reason: "paused_for_today" });
  });

  it("fails closed when the sum cannot be read", async () => {
    const { client } = fake({ rpcError: { code: "57P01", message: "down" } });
    expect(await checkBreaker("u1", { client, now: NOW, env: {} })).toEqual({ ok: false, reason: "error" });
  });
});

describe("helpers", () => {
  it("usdLimit parses or falls back", () => {
    expect(usdLimit(undefined, 5)).toBe(5);
    expect(usdLimit("2.5", 5)).toBe(2.5);
    expect(usdLimit("abc", 5)).toBe(5);
    expect(usdLimit("-1", 5)).toBe(5);
    expect(usdLimit("0", 5)).toBe(0);
  });
  it("utcDayStart", () => {
    expect(utcDayStart(NOW).toISOString()).toBe("2026-11-17T00:00:00.000Z");
  });
});
