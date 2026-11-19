import { describe, expect, it, vi } from "vitest";
import {
  createPaddleProvider,
  parsePaddleEvent,
  parseSignatureHeader,
  verifyPaddleSignature,
} from "./paddle";
import { ACCOUNT_ID, sign, subscriptionEvent, transactionEvent } from "./fixtures";

const SECRET = "pdl_ntfset_01testsecret";
const NOW_MS = 1_763_288_329_000;
const TS = Math.floor(NOW_MS / 1000);
const BODY = JSON.stringify(subscriptionEvent());

describe("verifyPaddleSignature", () => {
  it("accepts a valid signature", () => {
    expect(verifyPaddleSignature(BODY, sign(BODY, SECRET, TS), SECRET, NOW_MS)).toBe(true);
  });

  it("rejects the wrong secret", () => {
    expect(verifyPaddleSignature(BODY, sign(BODY, "another-secret", TS), SECRET, NOW_MS)).toBe(false);
  });

  it("rejects an altered body", () => {
    const header = sign(BODY, SECRET, TS);
    expect(verifyPaddleSignature(BODY.replace("active", "paused"), header, SECRET, NOW_MS)).toBe(false);
    expect(verifyPaddleSignature(`${BODY} `, header, SECRET, NOW_MS)).toBe(false);
  });

  it("rejects a stale or future timestamp beyond five seconds, accepts within", () => {
    expect(verifyPaddleSignature(BODY, sign(BODY, SECRET, TS - 6), SECRET, NOW_MS)).toBe(false);
    expect(verifyPaddleSignature(BODY, sign(BODY, SECRET, TS + 6), SECRET, NOW_MS)).toBe(false);
    expect(verifyPaddleSignature(BODY, sign(BODY, SECRET, TS - 5), SECRET, NOW_MS)).toBe(true);
  });

  it("rejects a header whose ts was changed after signing", () => {
    const header = sign(BODY, SECRET, TS - 100).replace(`ts=${TS - 100}`, `ts=${TS}`);
    expect(verifyPaddleSignature(BODY, header, SECRET, NOW_MS)).toBe(false);
  });

  it("rejects malformed headers", () => {
    const good = sign(BODY, SECRET, TS);
    const h1 = good.split("h1=")[1];
    for (const header of [
      null,
      "",
      "garbage",
      `h1=${h1}`,
      `ts=${TS}`,
      `ts=abc;h1=${h1}`,
      `ts=${TS};h1=nothex`,
      `ts=${TS};h1=${h1.slice(0, 63)}`,
      `ts=${TS};ts=${TS};h1=${h1}`,
      `ts=${TS};;h1=${h1}`,
    ]) {
      expect(verifyPaddleSignature(BODY, header, SECRET, NOW_MS)).toBe(false);
    }
  });

  it("accepts any matching h1 during secret rotation", () => {
    const good = sign(BODY, SECRET, TS);
    const h1 = good.split("h1=")[1];
    const other = "0".repeat(64);
    expect(verifyPaddleSignature(BODY, `ts=${TS};h1=${other};h1=${h1}`, SECRET, NOW_MS)).toBe(true);
    expect(parseSignatureHeader(`ts=${TS};h1=${other};h1=${h1}`)?.h1).toHaveLength(2);
  });

  it("rejects when no secret is configured", () => {
    expect(verifyPaddleSignature(BODY, sign(BODY, "", TS), "", NOW_MS)).toBe(false);
  });
});

describe("parsePaddleEvent", () => {
  it("normalises a subscription event", () => {
    const event = parsePaddleEvent(BODY);
    expect(event).toMatchObject({
      eventId: "evt_01hv8x2acma2gz7he8kg2s0hna",
      type: "subscription.created",
      kind: "subscription",
      accountId: ACCOUNT_ID,
      declaredEnvironment: "sandbox",
      subscription: {
        subscriptionId: "sub_01hv8x29kz0t586xy6zn1a62ny",
        customerId: "ctm_01hv6y1jedq4p1n0yqn5ba3ky4",
        status: "active",
        items: [{ priceId: "pri_01gsz8x8sawmvhz1pv30nge1ke", quantity: 1 }],
        interval: "month",
        cancelAtPeriodEnd: false,
      },
    });
  });

  it("reads a scheduled cancellation and a null period", () => {
    const event = parsePaddleEvent(
      JSON.stringify(
        subscriptionEvent({
          eventType: "subscription.canceled",
          status: "canceled",
          period: null,
          scheduledChange: { action: "cancel", effective_at: "2026-12-16T10:18:47Z" },
        }),
      ),
    );
    expect(event?.subscription?.cancelAtPeriodEnd).toBe(true);
    expect(event?.subscription?.periodStart).toBeNull();
  });

  it("never takes a plan from custom data, and drops a malformed account id", () => {
    const event = parsePaddleEvent(
      JSON.stringify(subscriptionEvent({ customData: { account_id: "not-a-uuid", plan: "pro" } })),
    );
    expect(event?.accountId).toBeNull();
    expect(JSON.stringify(event)).not.toContain("pro\"");
  });

  it("normalises a transaction event", () => {
    const event = parsePaddleEvent(JSON.stringify(transactionEvent()));
    expect(event).toMatchObject({
      kind: "transaction",
      transactionSubscriptionId: "sub_01hv8x29kz0t586xy6zn1a62ny",
      accountId: ACCOUNT_ID,
    });
  });

  it("passes other event types through as 'other'", () => {
    const body = JSON.stringify({ ...subscriptionEvent(), event_type: "customer.updated", data: { id: "ctm_1" } });
    expect(parsePaddleEvent(body)?.kind).toBe("other");
  });

  it("rejects bodies that do not match the documented shape", () => {
    expect(parsePaddleEvent("not json")).toBeNull();
    expect(parsePaddleEvent(JSON.stringify({ event_type: "subscription.created" }))).toBeNull();
    const bad = subscriptionEvent();
    (bad.data as { status: string }).status = "exploded";
    expect(parsePaddleEvent(JSON.stringify(bad))).toBeNull();
  });
});

describe("createPaddleProvider", () => {
  const config = {
    environment: "sandbox" as const,
    apiKey: "pdl_sdbx_apikey_test",
    webhookSecret: SECRET,
    clientToken: "test_token",
  };

  it("verifies before parsing", () => {
    const provider = createPaddleProvider(config);
    expect(provider.verifyWebhook(BODY, "ts=1;h1=" + "0".repeat(64), NOW_MS)).toEqual({ ok: false, reason: "signature" });
    expect(provider.verifyWebhook("{}", sign("{}", SECRET, TS), NOW_MS)).toEqual({ ok: false, reason: "payload" });
    const ok = provider.verifyWebhook(BODY, sign(BODY, SECRET, TS), NOW_MS);
    expect(ok.ok).toBe(true);
  });

  it("creates a portal session against the sandbox URL with a bearer key", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: {
            id: "cpls_01",
            urls: { general: { overview: "https://sandbox-customer-portal.paddle.com/cpl_01?token=x" }, subscriptions: [] },
          },
        }),
        { status: 201 },
      ),
    );
    const provider = createPaddleProvider(config, fetchMock as unknown as typeof fetch);
    const url = await provider.createPortalSession("ctm_01hv6y1jedq4p1n0yqn5ba3ky4", [
      "sub_01hv8x29kz0t586xy6zn1a62ny",
      "bad",
    ]);
    expect(url).toContain("https://");
    const [calledUrl, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(calledUrl).toBe("https://sandbox-api.paddle.com/customers/ctm_01hv6y1jedq4p1n0yqn5ba3ky4/portal-sessions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer pdl_sdbx_apikey_test");
    expect(JSON.parse(init.body as string)).toEqual({ subscription_ids: ["sub_01hv8x29kz0t586xy6zn1a62ny"] });
  });

  it("refuses a malformed customer id without calling Paddle", async () => {
    const fetchMock = vi.fn();
    const provider = createPaddleProvider(config, fetchMock as unknown as typeof fetch);
    await expect(provider.createPortalSession("ctm_x/../../evil", [])).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("exposes only the environment and the client token", () => {
    expect(createPaddleProvider(config).publicConfig()).toEqual({ environment: "sandbox", clientToken: "test_token" });
  });
});
