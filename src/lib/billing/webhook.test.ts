import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./store", () => ({
  recordEvent: vi.fn(),
  markEvent: vi.fn(),
  findPlanForPrice: vi.fn(),
  findSubscriptionAccount: vi.fn(),
  accountExists: vi.fn(),
  applySubscriptionEvent: vi.fn(),
}));

import * as store from "./store";
import { applyWebhookEvent } from "./webhook";
import { parsePaddleEvent } from "./paddle";
import { ACCOUNT_ID, SANDBOX_PRICE, subscriptionEvent, transactionEvent } from "./fixtures";

const s = vi.mocked(store);

function event(over: Parameters<typeof subscriptionEvent>[0] = {}) {
  const e = parsePaddleEvent(JSON.stringify(subscriptionEvent(over)));
  if (!e) throw new Error("fixture did not parse");
  return e;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  s.recordEvent.mockResolvedValue("new");
  s.markEvent.mockResolvedValue();
  s.findPlanForPrice.mockImplementation(async (env, priceId) =>
    env === "sandbox" && priceId === SANDBOX_PRICE ? { planId: "plus", interval: "month" } : null,
  );
  s.findSubscriptionAccount.mockResolvedValue(null);
  s.accountExists.mockImplementation(async (id) => id === ACCOUNT_ID);
  s.applySubscriptionEvent.mockResolvedValue(true);
});

describe("applyWebhookEvent", () => {
  it("maps a subscription event onto a row, plan from the price id", async () => {
    expect(await applyWebhookEvent(event(), "sandbox")).toBe("applied");
    expect(s.applySubscriptionEvent).toHaveBeenCalledWith({
      accountId: ACCOUNT_ID,
      environment: "sandbox",
      customerId: "ctm_01hv6y1jedq4p1n0yqn5ba3ky4",
      subscriptionId: "sub_01hv8x29kz0t586xy6zn1a62ny",
      planId: "plus",
      status: "active",
      interval: "month",
      seats: 1,
      periodStart: "2026-11-16T10:18:47.635628Z",
      periodEnd: "2026-12-16T10:18:47.635628Z",
      cancelAtPeriodEnd: false,
      occurredAt: "2026-11-16T10:18:49.621Z",
    });
    expect(s.markEvent).toHaveBeenCalledWith("evt_01hv8x2acma2gz7he8kg2s0hna", "applied");
  });

  it("returns at once for a replay of an applied event", async () => {
    s.recordEvent.mockResolvedValue("done");
    expect(await applyWebhookEvent(event(), "sandbox")).toBe("replay");
    expect(s.applySubscriptionEvent).not.toHaveBeenCalled();
    expect(s.markEvent).not.toHaveBeenCalled();
  });

  it("re-processes an event seen before but not applied", async () => {
    s.recordEvent.mockResolvedValue("retry");
    expect(await applyWebhookEvent(event(), "sandbox")).toBe("applied");
  });

  it("ignores an event declaring another environment", async () => {
    expect(await applyWebhookEvent(event({ customData: { account_id: ACCOUNT_ID, environment: "live" } }), "sandbox")).toBe(
      "ignored",
    );
    expect(s.applySubscriptionEvent).not.toHaveBeenCalled();
    expect(s.markEvent).toHaveBeenCalledWith(expect.any(String), "ignored");
  });

  it("ignores a price unknown in the configured environment (a sandbox price under live)", async () => {
    expect(await applyWebhookEvent(event({ customData: { account_id: ACCOUNT_ID } }), "live")).toBe("ignored");
    expect(s.findPlanForPrice).toHaveBeenCalledWith("live", SANDBOX_PRICE);
    expect(s.applySubscriptionEvent).not.toHaveBeenCalled();
  });

  it("ignores an unknown price even when custom data names a plan", async () => {
    const e = event({ priceId: "pri_01unknown", customData: { account_id: ACCOUNT_ID, plan: "pro" } });
    expect(await applyWebhookEvent(e, "sandbox")).toBe("ignored");
  });

  it("ignores an event without an account, or with an account that does not exist", async () => {
    expect(await applyWebhookEvent(event({ customData: null }), "sandbox")).toBe("ignored");
    const other = "00000000-0000-4000-8000-000000000000";
    expect(await applyWebhookEvent(event({ customData: { account_id: other } }), "sandbox")).toBe("ignored");
    expect(s.applySubscriptionEvent).not.toHaveBeenCalled();
  });

  it("uses the stored account for a later event without custom data", async () => {
    s.findSubscriptionAccount.mockResolvedValue(ACCOUNT_ID);
    expect(await applyWebhookEvent(event({ eventType: "subscription.updated", customData: null }), "sandbox")).toBe("applied");
    expect(s.applySubscriptionEvent.mock.calls[0][0].accountId).toBe(ACCOUNT_ID);
  });

  it("keeps the stored account when custom data names another one", async () => {
    s.findSubscriptionAccount.mockResolvedValue(ACCOUNT_ID);
    const other = "00000000-0000-4000-8000-000000000000";
    await applyWebhookEvent(event({ customData: { account_id: other } }), "sandbox");
    expect(s.applySubscriptionEvent.mock.calls[0][0].accountId).toBe(ACCOUNT_ID);
  });

  it("maps status, seats and a scheduled cancellation", async () => {
    await applyWebhookEvent(
      event({
        eventType: "subscription.past_due",
        status: "past_due",
        quantity: 12,
        scheduledChange: { action: "cancel", effective_at: "2026-12-16T00:00:00Z" },
      }),
      "sandbox",
    );
    expect(s.applySubscriptionEvent.mock.calls[0][0]).toMatchObject({ status: "past_due", seats: 12, cancelAtPeriodEnd: true });
  });

  it("reports an older event that the database did not apply as stale", async () => {
    s.applySubscriptionEvent.mockResolvedValue(false);
    expect(await applyWebhookEvent(event(), "sandbox")).toBe("stale");
  });

  it("records transaction events without touching subscriptions", async () => {
    const e = parsePaddleEvent(JSON.stringify(transactionEvent()))!;
    expect(await applyWebhookEvent(e, "sandbox")).toBe("ignored");
    expect(s.recordEvent).toHaveBeenCalledWith(expect.objectContaining({ subscriptionId: "sub_01hv8x29kz0t586xy6zn1a62ny" }));
    expect(s.applySubscriptionEvent).not.toHaveBeenCalled();
  });

  it("lets a database error propagate (the route answers 500 so Paddle retries)", async () => {
    s.applySubscriptionEvent.mockRejectedValue(new Error("db down"));
    await expect(applyWebhookEvent(event(), "sandbox")).rejects.toThrow("db down");
    expect(s.markEvent).not.toHaveBeenCalled();
  });

  it("never logs custom data or customer details", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await applyWebhookEvent(event({ customData: { account_id: ACCOUNT_ID, environment: "live" } }), "sandbox");
    const logged = warn.mock.calls.flat().join(" ");
    expect(logged).not.toContain(ACCOUNT_ID);
    expect(logged).not.toContain("ctm_");
  });
});
