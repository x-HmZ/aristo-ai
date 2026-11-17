import { describe, expect, it, vi } from "vitest";
import { turnstileEnabled, verifyTurnstile } from "./turnstile";

describe("turnstile", () => {
  it("is off unless both keys are set", () => {
    expect(turnstileEnabled({})).toBe(false);
    expect(turnstileEnabled({ siteKey: "s" })).toBe(false);
    expect(turnstileEnabled({ secretKey: "k" })).toBe(false);
    expect(turnstileEnabled({ siteKey: "s", secretKey: "k" })).toBe(true);
  });

  it("makes no request and allows everyone when off", async () => {
    const fetchImpl = vi.fn();
    expect(await verifyTurnstile(undefined, {}, fetchImpl)).toBe(true);
    expect(await verifyTurnstile("anything", { siteKey: "s" }, fetchImpl)).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails closed without a token, on a network error and on a failed check", async () => {
    const env = { siteKey: "s", secretKey: "k" };
    const fetchImpl = vi.fn();
    expect(await verifyTurnstile(undefined, env, fetchImpl)).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(await verifyTurnstile("t", env, vi.fn().mockRejectedValue(new Error("down")))).toBe(false);
    expect(await verifyTurnstile("t", env, vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: false }) }))).toBe(false);
    expect(await verifyTurnstile("t", env, vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))).toBe(false);
  });

  it("passes when Cloudflare says success, without sending an IP", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    expect(await verifyTurnstile("t", { siteKey: "s", secretKey: "k" }, fetchImpl)).toBe(true);
    const body = fetchImpl.mock.calls[0][1].body as URLSearchParams;
    expect([...body.keys()].sort()).toEqual(["response", "secret"]);
  });
});
