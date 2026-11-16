/**
 * Entitlements: which account a user acts for, what its plan allows this period, and the route guard.
 *
 * `requireEntitlement()` composes with the manual approval gate (it calls `requireApproved()` first and returns
 * its error unchanged) and has the same `{ user, error }` shape plus `account` and `plan`, so a route swaps one
 * call for the other:
 *
 *   const guard = await requireEntitlement({ metric: "fresh_lessons" });
 *   if (guard.error) return guard.error;
 *   // ... on failure after this point: await releaseConsumed(guard.consumed);
 *
 * Allowances are enforced only when ENFORCE_ALLOWANCE=true. Platform admins (profiles.is_admin) never consume.
 * Counting happens in the database (consume_allowance, migration 021), shared by every server instance.
 * Which route consumes which metric: METRICS.md next to this file.
 */

import { NextResponse } from "next/server";
import { requireApproved, type ApprovedUser } from "@/lib/auth/approval";
import { createClient } from "@/lib/supabase/server";
import { getBillingEnv, BillingConfigError, type BillingEnv } from "./env";
import {
  effectivePlan,
  FALLBACK_FREE_PLAN,
  limitFor,
  loadPlans,
  METRICS,
  type Metric,
  type Plan,
  type PlanId,
} from "./plans";
import * as store from "./store";
import type { Account, AccountRole, SubscriptionRow } from "./store";

export interface Period {
  start: Date;
  end: Date;
  /** The `usage_counters.period_start` key, YYYY-MM-DD (UTC). */
  key: string;
}

export interface Entitlement {
  account: Account;
  role: AccountRole;
  plan: Plan;
  subscription: SubscriptionRow | null;
  limits: Record<Metric | "learners", number>;
  period: Period;
  usage: Record<Metric, number>;
  isPlatformAdmin: boolean;
}

export interface Consumed {
  accountId: string;
  periodKey: string;
  metric: Metric;
  amount: number;
}

const ROLE_RANK: Record<AccountRole, number> = { owner: 0, org_admin: 1, teacher: 2, learner: 3 };

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Calendar month in UTC containing `now`. */
export function calendarMonth(now: Date): Period {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end, key: dateKey(start) };
}

/**
 * The allowance period: the subscription's billing period for a paid plan, the UTC calendar month otherwise
 * (and as the fallback when a paid row has no period or a stale one, so a missed renewal webhook cannot freeze
 * a counter forever).
 */
export function currentPeriod(subscription: SubscriptionRow | null, now: Date): Period {
  const s = subscription?.currentPeriodStart;
  const e = subscription?.currentPeriodEnd;
  if (s && e && s.getTime() <= now.getTime() && now.getTime() < e.getTime()) {
    return { start: s, end: e, key: dateKey(s) };
  }
  return calendarMonth(now);
}

/**
 * The account a user acts for. Their own family account comes first; otherwise their oldest membership, by role.
 * Organisation seats get a say once organisation routes exist (they will pass an account id explicitly).
 */
export async function getAccountForUser(userId: string): Promise<{ account: Account; role: AccountRole }> {
  let memberships = await store.fetchMemberships(userId);
  if (memberships.length === 0) {
    await store.ensureFamilyAccount(userId);
    memberships = await store.fetchMemberships(userId);
  }
  const family = memberships.find((m) => m.account.kind === "family" && m.role === "owner");
  if (family) return { account: family.account, role: family.role };
  const sorted = [...memberships].sort(
    (a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role] || a.createdAt.localeCompare(b.createdAt),
  );
  if (!sorted[0]) throw new Error("no account for user");
  return { account: sorted[0].account, role: sorted[0].role };
}

function planById(plans: Plan[], id: PlanId): Plan {
  return plans.find((p) => p.id === id) ?? (id === "free" ? FALLBACK_FREE_PLAN : plans.find((p) => p.id === "free") ?? FALLBACK_FREE_PLAN);
}

/** Account, plan, limits, period and usage for a user. Throws on a database error. */
export async function getEntitlement(userId: string, now: Date = new Date(), env: BillingEnv = getBillingEnv()): Promise<Entitlement> {
  const [{ account, role }, isPlatformAdmin, plans] = await Promise.all([
    getAccountForUser(userId),
    store.fetchIsPlatformAdmin(userId),
    loadPlans(store.fetchPlanRows),
  ]);

  // With billing off, subscriptions are not consulted: everyone is on the free plan. Only subscriptions from the
  // configured Paddle environment count, so sandbox rows never grant anything in a live configuration.
  const subscriptions = env.paddle ? await store.fetchSubscriptions(account.id, env.paddle.environment) : [];
  const chosen = effectivePlan(subscriptions, now, env.graceDays);
  const plan = planById(plans, chosen.planId);
  const seats = chosen.subscription?.seats ?? 1;

  const limits = {} as Record<Metric | "learners", number>;
  for (const m of [...METRICS, "learners"] as const) limits[m] = limitFor(plan, m, seats);

  const period = currentPeriod(chosen.subscription, now);
  const rawUsage = await store.fetchUsage(account.id, period.key);
  const usage = {} as Record<Metric, number>;
  for (const m of METRICS) usage[m] = rawUsage[m] ?? 0;

  return { account, role, plan, subscription: chosen.subscription, limits, period, usage, isPlatformAdmin };
}

/** Whether this account could move to a higher self-service plan right now. */
export function canUpgrade(ent: Pick<Entitlement, "account" | "role" | "plan">, plans: Plan[], billingEnabled: boolean): boolean {
  if (!billingEnabled || ent.role !== "owner") return false;
  return plans.some(
    (p) => p.isPublic && !p.contactOnly && p.kind === ent.account.kind && p.sortOrder > ent.plan.sortOrder,
  );
}

export interface RequireEntitlementOptions {
  /** The metric this request spends. Without it the guard only resolves the entitlement. */
  metric?: Metric;
  /** How much it spends (default 1; characters for voice_chars). */
  amount?: number;
}

export type EntitlementGuard =
  | {
      user: ApprovedUser;
      error: null;
      /**
       * Null only when ENFORCE_ALLOWANCE is off and the lookup failed (e.g. migration 021 not applied yet): the
       * guard then lets the request through exactly as requireApproved() would, so today's behaviour holds.
       */
      account: Account | null;
      /** Always set; the free plan when the entitlement could not be resolved. */
      plan: Plan;
      entitlement: Entitlement | null;
      /** What was counted, for `releaseConsumed` if the work then fails. Null when nothing was counted. */
      consumed: Consumed | null;
    }
  | { user: null; error: NextResponse; account: null; plan: null; entitlement: null; consumed: null };

function fail(error: NextResponse): EntitlementGuard {
  return { user: null, error, account: null, plan: null, entitlement: null, consumed: null };
}

const unavailable = () => NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });

/**
 * Route guard. Order: approval gate (its error returned untouched), then entitlement, then, only when
 * ENFORCE_ALLOWANCE is on, a metric is given and the caller is not a platform admin, an atomic consume.
 * Database errors fail CLOSED (503) when enforcing, since this guard exists to stop spend.
 */
export async function requireEntitlement(options: RequireEntitlementOptions = {}): Promise<EntitlementGuard> {
  const approved = await requireApproved();
  if (approved.error) return fail(approved.error);
  const user = approved.user;

  let env: BillingEnv;
  try {
    env = getBillingEnv();
  } catch (e) {
    console.error("[billing] configuration error:", e instanceof BillingConfigError ? e.message : "unknown");
    return fail(unavailable());
  }

  const amount = options.amount ?? 1;

  let ent: Entitlement | null = null;
  try {
    ent = await getEntitlement(user.id, new Date(), env);
  } catch {
    console.error("[billing] entitlement lookup failed");
    // Enforcing: fail closed. Not enforcing: behave like requireApproved() alone.
    if (env.enforceAllowance) return fail(unavailable());
  }

  const ok = (consumed: Consumed | null): EntitlementGuard => ({
    user,
    error: null,
    account: ent?.account ?? null,
    plan: ent?.plan ?? FALLBACK_FREE_PLAN,
    entitlement: ent,
    consumed,
  });

  if (!options.metric) return ok(null);
  const spent = await spendAllowance(ent, options.metric, amount, env);
  return spent.error ? fail(spent.error) : ok(spent.consumed);
}

/**
 * Spend from an entitlement already resolved by `requireEntitlement()`, for routes that only know later whether
 * the request costs anything (the lesson route consumes `fresh_lessons` on its cache-miss branch only).
 * No-op (consumed null) when ENFORCE_ALLOWANCE is off or the caller is a platform admin.
 */
export async function spendAllowance(
  ent: Entitlement | null,
  metric: Metric,
  amount: number = 1,
  env?: BillingEnv,
): Promise<{ error: NextResponse; consumed: null } | { error: null; consumed: Consumed | null }> {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("spendAllowance: amount must be a positive integer");
  let config: BillingEnv;
  try {
    config = env ?? getBillingEnv();
  } catch {
    console.error("[billing] configuration error");
    return { error: unavailable(), consumed: null };
  }
  if (!config.enforceAllowance) return { error: null, consumed: null };
  if (!ent) return { error: unavailable(), consumed: null };
  if (ent.isPlatformAdmin) return { error: null, consumed: null };

  const limit = ent.limits[metric];
  let result: { allowed: boolean; used: number };
  try {
    result = await store.consumeAllowance({ accountId: ent.account.id, periodStart: ent.period.key, metric, amount, limit });
  } catch {
    console.error("[billing] consume_allowance failed");
    return { error: unavailable(), consumed: null };
  }

  if (!result.allowed) {
    let upgrade = false;
    try {
      upgrade = canUpgrade(ent, await loadPlans(store.fetchPlanRows), config.billingEnabled);
    } catch {
      upgrade = false;
    }
    return {
      error: NextResponse.json(
        { error: "allowance_exhausted", metric, limit, resetsAt: ent.period.end.toISOString(), canUpgrade: upgrade },
        { status: 402 },
      ),
      consumed: null,
    };
  }

  return { error: null, consumed: { accountId: ent.account.id, periodKey: ent.period.key, metric, amount } };
}

/** Gives back an allowance when the paid work failed after consuming. Never throws. */
export async function releaseConsumed(consumed: Consumed | null): Promise<void> {
  if (!consumed) return;
  try {
    await store.releaseAllowance({
      accountId: consumed.accountId,
      periodStart: consumed.periodKey,
      metric: consumed.metric,
      amount: consumed.amount,
    });
  } catch {
    console.error("[billing] release_allowance failed");
  }
}

/**
 * Guard for future organisation routes (/org/*): the caller must hold one of `roles` in this organisation.
 * Separate from verifyAdmin(): a platform admin gets no organisation rights from is_admin, and an org admin gets
 * nothing outside their organisation. Also passes the approval gate first, unchanged.
 */
export async function requireOrgRole(
  accountId: string,
  roles: readonly AccountRole[],
): Promise<{ user: ApprovedUser; error: null; account: Account; role: AccountRole } | { user: null; error: NextResponse; account: null; role: null }> {
  const approved = await requireApproved();
  if (approved.error) return { user: null, error: approved.error, account: null, role: null };

  const forbidden = () => ({
    user: null,
    error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    account: null,
    role: null,
  } as const);

  let memberships: store.Membership[];
  try {
    memberships = await store.fetchMemberships(approved.user.id);
  } catch {
    return { user: null, error: unavailable(), account: null, role: null };
  }
  const m = memberships.find((x) => x.account.id === accountId);
  if (!m || m.account.kind !== "organisation" || !roles.includes(m.role)) return forbidden();
  return { user: approved.user, error: null, account: m.account, role: m.role };
}

/** Signed-in user without the approval gate, for the account summary and pages. */
export async function getSignedInUser(): Promise<{ id: string; email: string | null } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id, email: user.email ?? null } : null;
}
