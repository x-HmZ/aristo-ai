/**
 * Plans: types, row validation, the effective plan of a subscription, limits.
 *
 * Limits and prices are rows in `plans` (migration 021), never constants in route code, so they change without a
 * deploy. Everything here is pure except `loadPlans`, which reads through a short in-memory cache. The cache is
 * only a read cache of public data: no allowance decision depends on it being fresh to the second.
 */

import { z } from "zod";

export const PLAN_IDS = ["free", "plus", "pro", "org_edu", "org_business"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/** Metrics with a counter in `usage_counters`. `learners` is a limit, not a counter. */
export const METRICS = ["fresh_lessons", "chat_turns", "replays", "voice_chars", "models_3d"] as const;
export type Metric = (typeof METRICS)[number];

export const SUBSCRIPTION_STATUSES = ["trialing", "active", "past_due", "paused", "canceled"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

const limit = z.number().min(0).max(10_000_000).default(0);

/** Per month (per seat on per-seat plans). A missing key is 0: nothing is granted by omission. */
export const PlanLimitsSchema = z.object({
  fresh_lessons: limit,
  chat_turns: limit,
  replays: limit,
  voice_chars: limit,
  models_3d: limit,
  learners: limit,
});
export type PlanLimits = z.infer<typeof PlanLimitsSchema>;

const cents = z.number().int().min(0).nullable();

export const PlanRowSchema = z.object({
  id: z.enum(PLAN_IDS),
  name: z.string().max(200),
  kind: z.enum(["family", "organisation"]),
  is_public: z.boolean(),
  sort_order: z.number().int(),
  price_month_eur: cents,
  price_year_eur: cents,
  price_month_usd: cents,
  price_year_usd: cents,
  per_seat: z.boolean(),
  limits: z.unknown(),
  contact_only: z.boolean(),
});

export interface Plan {
  id: PlanId;
  name: string;
  kind: "family" | "organisation";
  isPublic: boolean;
  sortOrder: number;
  prices: {
    monthEur: number | null;
    yearEur: number | null;
    monthUsd: number | null;
    yearUsd: number | null;
  };
  perSeat: boolean;
  limits: PlanLimits;
  contactOnly: boolean;
}

export const ZERO_LIMITS: PlanLimits = {
  fresh_lessons: 0,
  chat_turns: 0,
  replays: 0,
  voice_chars: 0,
  models_3d: 0,
  learners: 0,
};

/** Parse one database row. A row that does not validate is dropped; malformed limits become zeros. */
export function parsePlanRow(row: unknown): Plan | null {
  const parsed = PlanRowSchema.safeParse(row);
  if (!parsed.success) return null;
  const r = parsed.data;
  const limits = PlanLimitsSchema.safeParse(r.limits);
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    isPublic: r.is_public,
    sortOrder: r.sort_order,
    prices: {
      monthEur: r.price_month_eur,
      yearEur: r.price_year_eur,
      monthUsd: r.price_month_usd,
      yearUsd: r.price_year_usd,
    },
    perSeat: r.per_seat,
    limits: limits.success ? limits.data : { ...ZERO_LIMITS },
    contactOnly: r.contact_only,
  };
}

/** The subset of a subscription row the plan decision needs. */
export interface SubscriptionLike {
  planId: PlanId;
  status: SubscriptionStatus;
  seats: number;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  pastDueSince: Date | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether a subscription currently grants its plan.
 * active and trialing do; past_due does for `graceDays` after it became past_due (Paddle keeps retrying the
 * payment meanwhile); paused and canceled do not. A cancellation at period end keeps the status `active` until
 * the scheduled change takes effect, then it becomes `canceled`, so an active row with cancel_at_period_end still
 * counts: https://developer.paddle.com/api-reference/subscriptions/cancel-subscription
 */
export function subscriptionGrants(sub: SubscriptionLike, now: Date, graceDays: number): boolean {
  switch (sub.status) {
    case "active":
    case "trialing":
      return true;
    case "past_due": {
      // Unknown start of past_due: grant nothing rather than an unbounded grace.
      if (!sub.pastDueSince) return false;
      return now.getTime() < sub.pastDueSince.getTime() + graceDays * DAY_MS;
    }
    default:
      return false;
  }
}

/** The plan an account is on: the best granting subscription, otherwise `free`. */
export function effectivePlan<S extends SubscriptionLike>(
  subscriptions: readonly S[],
  now: Date,
  graceDays: number,
): { planId: PlanId; subscription: S | null } {
  const rank: Record<PlanId, number> = { free: 0, plus: 1, pro: 2, org_edu: 3, org_business: 4 };
  let best: S | null = null;
  for (const sub of subscriptions) {
    if (!subscriptionGrants(sub, now, graceDays)) continue;
    if (!best || rank[sub.planId] > rank[best.planId]) best = sub;
  }
  return best ? { planId: best.planId, subscription: best } : { planId: "free", subscription: null };
}

/** The whole-number limit for a metric. Per-seat plans pool seats (0.5 lessons x 10 seats = 5). */
export function limitFor(plan: Plan, metric: Metric | "learners", seats: number): number {
  const perUnit = plan.limits[metric];
  const multiplier = plan.perSeat ? Math.max(1, Math.floor(seats)) : 1;
  return Math.floor(perUnit * multiplier);
}

// ── Loader with a short cache ─────────────────────────────────────────────────────────────────────────────

const CACHE_MS = 60_000;
let cache: { at: number; plans: Plan[] } | null = null;

export type PlanRowsFetcher = () => Promise<unknown[]>;

/** Every valid plan row, sorted for display. Cached for a minute per server instance. */
export async function loadPlans(fetchRows: PlanRowsFetcher, now: number = Date.now()): Promise<Plan[]> {
  if (cache && now - cache.at < CACHE_MS) return cache.plans;
  const rows = await fetchRows();
  const plans = rows
    .map(parsePlanRow)
    .filter((p): p is Plan => p !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  cache = { at: now, plans };
  return plans;
}

/** Test hook. */
export function resetPlanCache(): void {
  cache = null;
}

/** A plan that grants nothing, used if the `free` row is missing so a broken table never grants allowances. */
export const FALLBACK_FREE_PLAN: Plan = {
  id: "free",
  name: "Free",
  kind: "family",
  isPublic: true,
  sortOrder: 0,
  prices: { monthEur: 0, yearEur: 0, monthUsd: 0, yearUsd: 0 },
  perSeat: false,
  limits: { ...ZERO_LIMITS },
  contactOnly: false,
};
