import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => ({ rpc: async () => ({ data: true, error: null }) }) }));

import { enforceRate, isMissingFunction, rateLimitedResponse, resetRateWarning, secondsToWindowEnd, takeRate, type RateClient } from "@/lib/guard/rate";
import { RATE_LIMITS } from "@/lib/guard/limits";

function client(impl: (fn: string, args: Record<string, unknown>) => { data: unknown; error: { code?: string; message?: string } | null }): RateClient & { calls: Array<Record<string, unknown>> } {
  const calls: Array<Record<string, unknown>> = [];
  return {
    calls,
    rpc: async (fn, args) => {
      expect(fn).toBe("take_rate");
      calls.push(args);
      return impl(fn, args);
    },
  };
}

beforeEach(() => {
  resetRateWarning();
  vi.restoreAllMocks();
});

describe("takeRate", () => {
  it("passes the arguments straight to take_rate", async () => {
    const c = client(() => ({ data: true, error: null }));
    expect(await takeRate("u1", "k", 3600, 5, c)).toEqual({ ok: true });
    expect(c.calls[0]).toEqual({ p_user_id: "u1", p_key: "k", p_window_seconds: 3600, p_limit: 5 });
  });

  it("false from the database is a refusal", async () => {
    const c = client(() => ({ data: false, error: null }));
    expect(await takeRate("u1", "k", 60, 1, c)).toEqual({ ok: false, reason: "limit" });
  });

  it("anything but a literal true is a refusal (fail closed on odd answers)", async () => {
    for (const data of [null, undefined, 1, "true"]) {
      const c = client(() => ({ data, error: null }));
      expect((await takeRate("u1", "k", 60, 1, c)).ok).toBe(false);
    }
  });

  it("a missing function fails OPEN and warns once", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const c = client(() => ({ data: null, error: { code: "PGRST202", message: "Could not find the function public.take_rate" } }));
    expect(await takeRate("u1", "k", 60, 1, c)).toEqual({ ok: true, degraded: "missing" });
    expect(await takeRate("u1", "k", 60, 1, c)).toEqual({ ok: true, degraded: "missing" });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("any other database error fails CLOSED", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const c = client(() => ({ data: null, error: { code: "57P01", message: "terminating connection" } }));
    expect(await takeRate("u1", "k", 60, 1, c)).toEqual({ ok: false, reason: "error" });
  });

  it("a thrown error fails CLOSED", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const c: RateClient = { rpc: () => { throw new Error("network"); } };
    expect(await takeRate("u1", "k", 60, 1, c)).toEqual({ ok: false, reason: "error" });
  });
});

describe("isMissingFunction", () => {
  it("recognises PostgREST and Postgres wording", () => {
    expect(isMissingFunction({ code: "PGRST202" })).toBe(true);
    expect(isMissingFunction({ code: "42883" })).toBe(true);
    expect(isMissingFunction({ message: "function public.take_rate(uuid) does not exist" })).toBe(true);
    expect(isMissingFunction({ code: "23503", message: "foreign key violation" })).toBe(false);
  });
});

describe("enforceRate", () => {
  it("checks the hourly and the daily window under distinct keys", async () => {
    const c = client(() => ({ data: true, error: null }));
    expect(await enforceRate("u1", "lesson_generate", c)).toEqual({ allowed: true });
    expect(c.calls.map((a) => [a.p_key, a.p_window_seconds, a.p_limit])).toEqual(
      RATE_LIMITS.lesson_generate.map((w) => [`lesson_generate:${w.seconds}`, w.seconds, w.limit]),
    );
  });

  it("stops at the first window that refuses", async () => {
    const c = client((_, a) => ({ data: a.p_window_seconds !== 3600, error: null }));
    const d = await enforceRate("u1", "tts", c);
    expect(d).toMatchObject({ allowed: false, reason: "limit" });
    expect(c.calls).toHaveLength(1);
  });

  it("every feature has a positive hourly and daily window", () => {
    for (const [name, windows] of Object.entries(RATE_LIMITS)) {
      expect(windows.map((w) => w.seconds), name).toEqual([3600, 86400]);
      for (const w of windows) expect(w.limit).toBeGreaterThan(0);
      expect(windows[0].limit, name).toBeLessThanOrEqual(windows[1].limit);
    }
  });
});

describe("responses", () => {
  it("429 with Retry-After for a limit, 503 for an error", async () => {
    const limited = rateLimitedResponse({ allowed: false, reason: "limit", retryAfterSeconds: 120 });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("120");
    expect(await limited.json()).toEqual({ error: "rate_limited", retryAfterSeconds: 120 });
    expect(rateLimitedResponse({ allowed: false, reason: "error", retryAfterSeconds: 1 }).status).toBe(503);
  });

  it("secondsToWindowEnd counts to the next fixed boundary", () => {
    expect(secondsToWindowEnd(3600, 0)).toBe(3600);
    expect(secondsToWindowEnd(3600, 3_599_000)).toBe(1);
    expect(secondsToWindowEnd(86400, 86_400_000 + 1000)).toBe(86399);
  });
});
