import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(), createServiceClient: vi.fn() }));
vi.mock("@/lib/auth/approval", () => ({ requireApproved: vi.fn() }));
vi.mock("@/lib/billing/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/billing/env")>();
  return { ...actual, getBillingEnv: vi.fn() };
});
vi.mock("@/lib/billing/store", () => ({
  recordEvent: vi.fn(),
  markEvent: vi.fn(),
  findPlanForPrice: vi.fn(),
  findSubscriptionAccount: vi.fn(),
  accountExists: vi.fn(),
  applySubscriptionEvent: vi.fn(),
  fetchMemberships: vi.fn(),
  ensureFamilyAccount: vi.fn(),
  fetchSubscriptions: vi.fn(),
}));

import { getBillingEnv, type BillingEnv } from "@/lib/billing/env";
import * as store from "@/lib/billing/store";
import { handleWebhookRequest, MAX_WEBHOOK_BYTES } from "@/lib/billing/webhook";
import { openPortal } from "@/lib/billing/portal";
import type { BillingProvider } from "@/lib/billing/provider";
import { ACCOUNT_ID, SANDBOX_PRICE, sign, subscriptionEvent } from "@/lib/billing/fixtures";
import { POST as webhookPOST } from "./webhook/route";
import { GET as summaryGET } from "./summary/route";
import { POST as portalPOST } from "./portal/route";

const s = vi.mocked(store);
const envMock = vi.mocked(getBillingEnv);
const SECRET = "pdl_ntfset_secret";
const NOW = 1_763_288_329_000;
const TS = Math.floor(NOW / 1000);

const OFF: BillingEnv = {
  billingEnabled: false,
  enforceAllowance: false,
  pricesProvisional: true,
  contactEmail: null,
  graceDays: 7,
  paddle: null,
};
const ON: BillingEnv = {
  ...OFF,
  billingEnabled: true,
  paddle: { environment: "sandbox", apiKey: "pdl_sdbx_apikey_x", webhookSecret: SECRET, clientToken: "test_x" },
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  s.recordEvent.mockResolvedValue("new");
  s.markEvent.mockResolvedValue();
  s.findPlanForPrice.mockImplementation(async (_e, p) => (p === SANDBOX_PRICE ? { planId: "plus", interval: "month" } : null));
  s.findSubscriptionAccount.mockResolvedValue(null);
  s.accountExists.mockResolvedValue(true);
  s.applySubscriptionEvent.mockResolvedValue(true);
});

describe("routes answer 404 while billing is off", () => {
  beforeEach(() => envMock.mockReturnValue(OFF));

  it("webhook", async () => {
    const req = new NextRequest("http://localhost/api/billing/webhook", { method: "POST", body: "{}" });
    expect((await webhookPOST(req)).status).toBe(404);
    expect(s.recordEvent).not.toHaveBeenCalled();
  });

  it("summary", async () => {
    expect((await summaryGET()).status).toBe(404);
  });

  it("portal", async () => {
    expect((await portalPOST()).status).toBe(404);
  });
});

describe("handleWebhookRequest", () => {
  const body = JSON.stringify(subscriptionEvent());

  it("401 before parsing when the signature is wrong or missing", async () => {
    expect((await handleWebhookRequest(body, null, ON, NOW)).status).toBe(401);
    expect((await handleWebhookRequest(body, sign(body, "wrong", TS), ON, NOW)).status).toBe(401);
    expect((await handleWebhookRequest("not json", sign("x", SECRET, TS), ON, NOW)).status).toBe(401);
    expect(s.recordEvent).not.toHaveBeenCalled();
  });

  it("401 for a stale timestamp", async () => {
    expect((await handleWebhookRequest(body, sign(body, SECRET, TS - 60), ON, NOW)).status).toBe(401);
  });

  it("200 and applies a valid event", async () => {
    const res = await handleWebhookRequest(body, sign(body, SECRET, TS), ON, NOW);
    expect(res).toEqual({ status: 200, body: { received: true, outcome: "applied" } });
    expect(s.applySubscriptionEvent).toHaveBeenCalledWith(expect.objectContaining({ accountId: ACCOUNT_ID, planId: "plus" }));
  });

  it("200 at once for a replay", async () => {
    s.recordEvent.mockResolvedValue("done");
    const res = await handleWebhookRequest(body, sign(body, SECRET, TS), ON, NOW);
    expect(res.body.outcome).toBe("replay");
    expect(s.applySubscriptionEvent).not.toHaveBeenCalled();
  });

  it("400 for a verified body of the wrong shape", async () => {
    const odd = JSON.stringify({ event_id: "evt_1", event_type: "subscription.created", occurred_at: "2026-11-16T00:00:00Z", data: { id: "nope" } });
    expect((await handleWebhookRequest(odd, sign(odd, SECRET, TS), ON, NOW)).status).toBe(400);
  });

  it("413 for an oversized body", async () => {
    const big = "x".repeat(MAX_WEBHOOK_BYTES + 1);
    expect((await handleWebhookRequest(big, sign(big, SECRET, TS), ON, NOW)).status).toBe(413);
  });

  it("500 on a database error so Paddle retries", async () => {
    s.applySubscriptionEvent.mockRejectedValue(new Error("down"));
    expect((await handleWebhookRequest(body, sign(body, SECRET, TS), ON, NOW)).status).toBe(500);
  });
});

describe("openPortal", () => {
  const FAMILY = { id: ACCOUNT_ID, kind: "family" as const, name: "", ownerUserId: "u", seatLimit: 1 };
  const provider: BillingProvider = {
    verifyWebhook: vi.fn(),
    createPortalSession: vi.fn(async () => "https://sandbox-customer-portal.paddle.com/x"),
    publicConfig: vi.fn(),
  };
  const row = {
    id: "r", accountId: ACCOUNT_ID, environment: "sandbox" as const, providerCustomerId: "ctm_01hv6y1jedq4p1n0yqn5ba3ky4",
    providerSubscriptionId: "sub_01hv8x29kz0t586xy6zn1a62ny", planId: "plus" as const, status: "canceled" as const,
    billingInterval: "month" as const, seats: 1, currentPeriodStart: null, currentPeriodEnd: null,
    cancelAtPeriodEnd: false, pastDueSince: null,
  };

  it("refuses anyone but the account owner", async () => {
    s.fetchMemberships.mockResolvedValue([{ account: { ...FAMILY, kind: "organisation" }, role: "learner", createdAt: "x" }]);
    expect((await openPortal("u", ON, provider)).status).toBe(403);
  });

  it("404 without a subscription", async () => {
    s.fetchMemberships.mockResolvedValue([{ account: FAMILY, role: "owner", createdAt: "x" }]);
    s.fetchSubscriptions.mockResolvedValue([]);
    expect((await openPortal("u", ON, provider)).status).toBe(404);
  });

  it("opens the portal for the account's own customer, including a canceled subscription", async () => {
    s.fetchMemberships.mockResolvedValue([{ account: FAMILY, role: "owner", createdAt: "x" }]);
    s.fetchSubscriptions.mockResolvedValue([row]);
    const res = await openPortal("u", ON, provider);
    expect(res).toEqual({ status: 200, url: "https://sandbox-customer-portal.paddle.com/x" });
    expect(provider.createPortalSession).toHaveBeenCalledWith(row.providerCustomerId, [row.providerSubscriptionId]);
    expect(s.fetchSubscriptions).toHaveBeenCalledWith(ACCOUNT_ID, "sandbox");
  });
});
