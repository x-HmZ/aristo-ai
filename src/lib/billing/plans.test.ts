import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  effectivePlan,
  limitFor,
  loadPlans,
  parsePlanRow,
  resetPlanCache,
  subscriptionGrants,
  type SubscriptionLike,
} from "./plans";

const NOW = new Date("2026-11-16T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function sub(over: Partial<SubscriptionLike> = {}): SubscriptionLike {
  return {
    planId: "plus",
    status: "active",
    seats: 1,
    currentPeriodStart: new Date("2026-11-01T00:00:00Z"),
    currentPeriodEnd: new Date("2026-12-01T00:00:00Z"),
    pastDueSince: null,
    ...over,
  };
}

const ROW = {
  id: "plus",
  name: "Plus",
  kind: "family",
  is_public: true,
  sort_order: 10,
  price_month_eur: 1099,
  price_year_eur: 9900,
  price_month_usd: 1099,
  price_year_usd: 9900,
  per_seat: false,
  limits: { fresh_lessons: 4, chat_turns: 150, replays: 100, voice_chars: 8000, models_3d: 0, learners: 3 },
  contact_only: false,
};

describe("subscriptionGrants / effectivePlan", () => {
  it("active and trialing grant their plan", () => {
    expect(subscriptionGrants(sub(), NOW, 7)).toBe(true);
    expect(subscriptionGrants(sub({ status: "trialing" }), NOW, 7)).toBe(true);
  });

  it("paused and canceled do not", () => {
    expect(subscriptionGrants(sub({ status: "paused" }), NOW, 7)).toBe(false);
    expect(subscriptionGrants(sub({ status: "canceled" }), NOW, 7)).toBe(false);
  });

  it("past_due grants only inside the grace period", () => {
    const inside = sub({ status: "past_due", pastDueSince: new Date(NOW.getTime() - 6 * DAY) });
    const outside = sub({ status: "past_due", pastDueSince: new Date(NOW.getTime() - 7 * DAY) });
    expect(subscriptionGrants(inside, NOW, 7)).toBe(true);
    expect(subscriptionGrants(outside, NOW, 7)).toBe(false);
    expect(subscriptionGrants(inside, NOW, 0)).toBe(false);
  });

  it("past_due with no start date grants nothing", () => {
    expect(subscriptionGrants(sub({ status: "past_due", pastDueSince: null }), NOW, 7)).toBe(false);
  });

  it("falls back to free with no granting subscription", () => {
    expect(effectivePlan([], NOW, 7)).toEqual({ planId: "free", subscription: null });
    expect(effectivePlan([sub({ status: "canceled" })], NOW, 7).planId).toBe("free");
  });

  it("picks the best granting subscription", () => {
    const plus = sub();
    const pro = sub({ planId: "pro" });
    const canceledPro = sub({ planId: "pro", status: "canceled" });
    expect(effectivePlan([plus, pro], NOW, 7).subscription).toBe(pro);
    expect(effectivePlan([canceledPro, plus], NOW, 7).subscription).toBe(plus);
  });
});

describe("parsePlanRow / limitFor", () => {
  it("parses a valid row", () => {
    const plan = parsePlanRow(ROW);
    expect(plan?.id).toBe("plus");
    expect(plan?.limits.chat_turns).toBe(150);
  });

  it("drops a row with an unknown id and zeroes malformed limits", () => {
    expect(parsePlanRow({ ...ROW, id: "gold" })).toBeNull();
    const broken = parsePlanRow({ ...ROW, limits: { chat_turns: -5 } });
    expect(broken?.limits.chat_turns).toBe(0);
    expect(broken?.limits.fresh_lessons).toBe(0);
  });

  it("missing limit keys are zero, never unlimited", () => {
    const plan = parsePlanRow({ ...ROW, limits: { chat_turns: 10 } });
    expect(plan?.limits.models_3d).toBe(0);
  });

  it("pools per-seat limits and floors them", () => {
    const org = parsePlanRow({
      ...ROW,
      id: "org_edu",
      kind: "organisation",
      per_seat: true,
      limits: { fresh_lessons: 0.5, chat_turns: 100 },
    })!;
    expect(limitFor(org, "fresh_lessons", 10)).toBe(5);
    expect(limitFor(org, "fresh_lessons", 3)).toBe(1);
    expect(limitFor(org, "chat_turns", 12)).toBe(1200);
    const plus = parsePlanRow(ROW)!;
    expect(limitFor(plus, "chat_turns", 5)).toBe(150);
  });
});

describe("loadPlans", () => {
  beforeEach(() => resetPlanCache());

  it("caches for a minute and sorts", async () => {
    const fetchRows = vi.fn(async () => [ROW, { ...ROW, id: "free", name: "Free", sort_order: 0 }]);
    const first = await loadPlans(fetchRows, 1_000);
    expect(first.map((p) => p.id)).toEqual(["free", "plus"]);
    await loadPlans(fetchRows, 30_000);
    expect(fetchRows).toHaveBeenCalledTimes(1);
    await loadPlans(fetchRows, 62_000);
    expect(fetchRows).toHaveBeenCalledTimes(2);
  });
});
