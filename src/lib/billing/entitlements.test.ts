import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/auth/approval", () => ({ requireApproved: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(), createServiceClient: vi.fn() }));
vi.mock("./env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./env")>();
  return { ...actual, getBillingEnv: vi.fn() };
});
vi.mock("./store", () => ({
  fetchMemberships: vi.fn(),
  ensureFamilyAccount: vi.fn(),
  fetchIsPlatformAdmin: vi.fn(),
  fetchPlanRows: vi.fn(),
  fetchSubscriptions: vi.fn(),
  fetchUsage: vi.fn(),
  consumeAllowance: vi.fn(),
  releaseAllowance: vi.fn(),
}));

import { requireApproved } from "@/lib/auth/approval";
import { BillingConfigError, getBillingEnv, type BillingEnv } from "./env";
import * as store from "./store";
import { resetPlanCache } from "./plans";
import {
  calendarMonth,
  currentPeriod,
  getAccountForUser,
  getEntitlement,
  releaseConsumed,
  requireEntitlement,
  requireOrgRole,
  spendAllowance,
} from "./entitlements";

const s = vi.mocked(store);
const approve = vi.mocked(requireApproved);
const envMock = vi.mocked(getBillingEnv);

const USER = { id: "11111111-1111-4111-8111-111111111111", email: "parent@example.org" };
const FAMILY = { id: "22222222-2222-4222-8222-222222222222", kind: "family" as const, name: "", ownerUserId: USER.id, seatLimit: 1 };
const ORG = { id: "33333333-3333-4333-8333-333333333333", kind: "organisation" as const, name: "School", ownerUserId: null, seatLimit: 20 };

const PLAN_ROWS = [
  {
    id: "free", name: "Free", kind: "family", is_public: true, sort_order: 0,
    price_month_eur: 0, price_year_eur: 0, price_month_usd: 0, price_year_usd: 0, per_seat: false,
    limits: { fresh_lessons: 2, chat_turns: 15, replays: 30, voice_chars: 0, models_3d: 0, learners: 1 },
    contact_only: false,
  },
  {
    id: "plus", name: "Plus", kind: "family", is_public: true, sort_order: 10,
    price_month_eur: 1099, price_year_eur: 9900, price_month_usd: 1099, price_year_usd: 9900, per_seat: false,
    limits: { fresh_lessons: 4, chat_turns: 150, replays: 100, voice_chars: 8000, models_3d: 0, learners: 3 },
    contact_only: false,
  },
];

function env(over: Partial<BillingEnv> = {}): BillingEnv {
  return {
    billingEnabled: false,
    enforceAllowance: true,
    pricesProvisional: true,
    contactEmail: null,
    graceDays: 7,
    paddle: null,
    ...over,
  };
}

const SANDBOX_PADDLE = { environment: "sandbox" as const, apiKey: "k", webhookSecret: "s", clientToken: "t" };

beforeEach(() => {
  vi.resetAllMocks();
  resetPlanCache();
  vi.spyOn(console, "error").mockImplementation(() => {});
  approve.mockResolvedValue({ user: USER as never, error: null });
  envMock.mockReturnValue(env());
  s.fetchMemberships.mockResolvedValue([{ account: FAMILY, role: "owner", createdAt: "2026-01-01" }]);
  s.fetchIsPlatformAdmin.mockResolvedValue(false);
  s.fetchPlanRows.mockResolvedValue(PLAN_ROWS);
  s.fetchSubscriptions.mockResolvedValue([]);
  s.fetchUsage.mockResolvedValue({ chat_turns: 3 });
  s.consumeAllowance.mockResolvedValue({ allowed: true, used: 4 });
  s.releaseAllowance.mockResolvedValue();
});

describe("periods", () => {
  it("free plan: UTC calendar month", () => {
    const p = calendarMonth(new Date("2026-11-30T23:59:59Z"));
    expect(p.key).toBe("2026-11-01");
    expect(p.end.toISOString()).toBe("2026-12-01T00:00:00.000Z");
  });

  it("paid plan: the subscription's billing period, calendar month when stale", () => {
    const sub = {
      currentPeriodStart: new Date("2026-11-16T10:00:00Z"),
      currentPeriodEnd: new Date("2026-12-16T10:00:00Z"),
    } as never;
    expect(currentPeriod(sub, new Date("2026-12-01T00:00:00Z")).key).toBe("2026-11-16");
    expect(currentPeriod(sub, new Date("2027-01-05T00:00:00Z")).key).toBe("2027-01-01");
  });
});

describe("getAccountForUser", () => {
  it("prefers the user's own family account", async () => {
    s.fetchMemberships.mockResolvedValue([
      { account: ORG, role: "learner", createdAt: "2025-01-01" },
      { account: FAMILY, role: "owner", createdAt: "2026-01-01" },
    ]);
    expect((await getAccountForUser(USER.id)).account.id).toBe(FAMILY.id);
  });

  it("creates the family account when the user has none", async () => {
    s.fetchMemberships.mockResolvedValueOnce([]).mockResolvedValueOnce([{ account: FAMILY, role: "owner", createdAt: "x" }]);
    expect((await getAccountForUser(USER.id)).account.id).toBe(FAMILY.id);
    expect(s.ensureFamilyAccount).toHaveBeenCalledWith(USER.id);
  });
});

describe("getEntitlement", () => {
  it("free plan when billing is off, subscriptions not consulted", async () => {
    const ent = await getEntitlement(USER.id, new Date("2026-11-16T00:00:00Z"), env());
    expect(ent.plan.id).toBe("free");
    expect(ent.limits.chat_turns).toBe(15);
    expect(ent.usage).toMatchObject({ chat_turns: 3, fresh_lessons: 0 });
    expect(s.fetchSubscriptions).not.toHaveBeenCalled();
  });

  it("paid plan from an active subscription in the configured environment", async () => {
    s.fetchSubscriptions.mockResolvedValue([
      {
        id: "x", accountId: FAMILY.id, environment: "sandbox", providerCustomerId: "ctm_1", providerSubscriptionId: "sub_1",
        planId: "plus", status: "active", billingInterval: "month", seats: 1,
        currentPeriodStart: new Date("2026-11-10T00:00:00Z"), currentPeriodEnd: new Date("2026-12-10T00:00:00Z"),
        cancelAtPeriodEnd: false, pastDueSince: null,
      },
    ]);
    const ent = await getEntitlement(USER.id, new Date("2026-11-16T00:00:00Z"), env({ billingEnabled: true, paddle: SANDBOX_PADDLE }));
    expect(s.fetchSubscriptions).toHaveBeenCalledWith(FAMILY.id, "sandbox");
    expect(ent.plan.id).toBe("plus");
    expect(ent.limits.chat_turns).toBe(150);
    expect(ent.period.key).toBe("2026-11-10");
    expect(s.fetchUsage).toHaveBeenCalledWith(FAMILY.id, "2026-11-10");
  });

  it("a missing free row grants nothing", async () => {
    s.fetchPlanRows.mockResolvedValue([]);
    const ent = await getEntitlement(USER.id, new Date(), env());
    expect(ent.limits.fresh_lessons).toBe(0);
  });
});

describe("requireEntitlement", () => {
  it("returns the approval error untouched", async () => {
    const pending = NextResponse.json({ error: "Account pending approval" }, { status: 403 });
    approve.mockResolvedValue({ user: null, error: pending });
    const guard = await requireEntitlement({ metric: "chat_turns" });
    expect(guard.error).toBe(pending);
    expect(s.consumeAllowance).not.toHaveBeenCalled();
  });

  it("does not consume when enforcement is off", async () => {
    envMock.mockReturnValue(env({ enforceAllowance: false }));
    const guard = await requireEntitlement({ metric: "chat_turns" });
    expect(guard.error).toBeNull();
    expect(guard.consumed).toBeNull();
    expect(guard.account?.id).toBe(FAMILY.id);
    expect(s.consumeAllowance).not.toHaveBeenCalled();
  });

  it("lets the request through like requireApproved when not enforcing and the lookup fails", async () => {
    envMock.mockReturnValue(env({ enforceAllowance: false }));
    s.fetchMemberships.mockRejectedValue(new Error("relation does not exist"));
    const guard = await requireEntitlement({ metric: "chat_turns" });
    expect(guard.error).toBeNull();
    expect(guard.account).toBeNull();
    expect(guard.plan?.id).toBe("free");
  });

  it("fails closed with 503 when enforcing and the lookup fails", async () => {
    s.fetchMemberships.mockRejectedValue(new Error("down"));
    const guard = await requireEntitlement({ metric: "chat_turns" });
    expect(guard.error?.status).toBe(503);
  });

  it("answers 503 on a billing configuration error", async () => {
    envMock.mockImplementation(() => {
      throw new BillingConfigError("PADDLE_ENVIRONMENT missing");
    });
    expect((await requireEntitlement()).error?.status).toBe(503);
  });

  it("consumes the amount against the plan limit for the period", async () => {
    const guard = await requireEntitlement({ metric: "chat_turns" });
    expect(guard.error).toBeNull();
    expect(s.consumeAllowance).toHaveBeenCalledWith({
      accountId: FAMILY.id,
      periodStart: calendarMonth(new Date()).key,
      metric: "chat_turns",
      amount: 1,
      limit: 15,
    });
    expect(guard.consumed).toMatchObject({ accountId: FAMILY.id, metric: "chat_turns", amount: 1 });
  });

  it("answers 402 with the documented body when the allowance is used up", async () => {
    s.consumeAllowance.mockResolvedValue({ allowed: false, used: 2 });
    const guard = await requireEntitlement({ metric: "fresh_lessons" });
    expect(guard.error?.status).toBe(402);
    const body = await guard.error!.json();
    expect(body).toEqual({
      error: "allowance_exhausted",
      metric: "fresh_lessons",
      limit: 2,
      resetsAt: calendarMonth(new Date()).end.toISOString(),
      canUpgrade: false,
    });
  });

  it("offers an upgrade on 402 only to an owner while billing is on", async () => {
    envMock.mockReturnValue(env({ billingEnabled: true, paddle: SANDBOX_PADDLE }));
    s.consumeAllowance.mockResolvedValue({ allowed: false, used: 2 });
    expect((await (await requireEntitlement({ metric: "fresh_lessons" })).error!.json()).canUpgrade).toBe(true);

    s.fetchMemberships.mockResolvedValue([{ account: ORG, role: "learner", createdAt: "x" }]);
    expect((await (await requireEntitlement({ metric: "fresh_lessons" })).error!.json()).canUpgrade).toBe(false);
  });

  it("platform admins bypass allowances", async () => {
    s.fetchIsPlatformAdmin.mockResolvedValue(true);
    const guard = await requireEntitlement({ metric: "models_3d" });
    expect(guard.error).toBeNull();
    expect(s.consumeAllowance).not.toHaveBeenCalled();
  });

  it("fails closed with 503 when the counter cannot be written", async () => {
    s.consumeAllowance.mockRejectedValue(new Error("down"));
    expect((await requireEntitlement({ metric: "chat_turns" })).error?.status).toBe(503);
  });

  it("spendAllowance consumes later on a resolved entitlement, and release gives it back", async () => {
    const guard = await requireEntitlement();
    expect(s.consumeAllowance).not.toHaveBeenCalled();
    const spent = await spendAllowance(guard.entitlement, "fresh_lessons", 1, env());
    expect(spent.error).toBeNull();
    await releaseConsumed(spent.consumed);
    expect(s.releaseAllowance).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: FAMILY.id, metric: "fresh_lessons", amount: 1 }),
    );
  });

  it("rejects a non-positive amount as a programming error", async () => {
    await expect(requireEntitlement({ metric: "voice_chars", amount: 0 })).rejects.toThrow();
  });
});

describe("requireOrgRole", () => {
  it("allows a matching role in that organisation only", async () => {
    s.fetchMemberships.mockResolvedValue([{ account: ORG, role: "org_admin", createdAt: "x" }]);
    expect((await requireOrgRole(ORG.id, ["org_admin"])).error).toBeNull();
    expect((await requireOrgRole(ORG.id, ["owner"])).error?.status).toBe(403);
    expect((await requireOrgRole(FAMILY.id, ["org_admin"])).error?.status).toBe(403);
  });

  it("is not satisfied by a family account or by platform admin", async () => {
    s.fetchIsPlatformAdmin.mockResolvedValue(true);
    expect((await requireOrgRole(FAMILY.id, ["owner"])).error?.status).toBe(403);
  });

  it("returns the approval error untouched", async () => {
    const pending = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    approve.mockResolvedValue({ user: null, error: pending });
    expect((await requireOrgRole(ORG.id, ["org_admin"])).error).toBe(pending);
  });
});
