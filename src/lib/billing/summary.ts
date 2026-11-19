/**
 * The account summary shown on /account and returned by GET /api/billing/summary, and the active provider.
 */

import { getBillingEnv, type BillingEnv } from "./env";
import { canUpgrade, getEntitlement } from "./entitlements";
import { createPaddleProvider } from "./paddle";
import { loadPlans, METRICS, type Metric, type PlanId } from "./plans";
import type { BillingProvider } from "./provider";
import * as store from "./store";

/** The provider for the current config, or null while billing is off. */
export function getBillingProvider(env: BillingEnv = getBillingEnv()): BillingProvider | null {
  return env.paddle ? createPaddleProvider(env.paddle) : null;
}

export interface CheckoutConfig {
  environment: "sandbox" | "live";
  clientToken: string;
  /** Only plans the account owner can buy right now, with a price configured for this environment. */
  prices: { planId: PlanId; interval: "month" | "year"; priceId: string }[];
  /** Passed to Paddle.js as customData. The webhook re-checks the account exists. */
  customData: { account_id: string; environment: "sandbox" | "live" };
  email: string | null;
}

export interface AccountSummary {
  plan: { id: PlanId; name: string };
  role: string;
  accountKind: "family" | "organisation";
  limits: Record<Metric | "learners", number>;
  usage: Record<Metric, number>;
  period: { start: string; end: string };
  subscription: {
    status: string;
    interval: "month" | "year" | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  billingEnabled: boolean;
  enforceAllowance: boolean;
  isOwner: boolean;
  canUpgrade: boolean;
  /** True when the owner can open the customer portal (a subscription with a customer id exists). */
  canManage: boolean;
  checkout: CheckoutConfig | null;
}

export async function buildAccountSummary(
  user: { id: string; email: string | null },
  env: BillingEnv = getBillingEnv(),
): Promise<AccountSummary> {
  const ent = await getEntitlement(user.id, new Date(), env);
  const plans = await loadPlans(store.fetchPlanRows);
  const isOwner = ent.role === "owner";
  const upgrade = canUpgrade(ent, plans, env.billingEnabled);

  let checkout: CheckoutConfig | null = null;
  // Only an account owner gets a checkout config; nobody does while billing is off.
  if (env.paddle && isOwner && upgrade) {
    const buyable = new Set(
      plans
        .filter((p) => p.isPublic && !p.contactOnly && p.kind === ent.account.kind && p.sortOrder > ent.plan.sortOrder)
        .map((p) => p.id),
    );
    const prices = (await store.fetchPlanPrices(env.paddle.environment)).filter((p) => buyable.has(p.planId));
    checkout = {
      environment: env.paddle.environment,
      clientToken: env.paddle.clientToken,
      prices,
      customData: { account_id: ent.account.id, environment: env.paddle.environment },
      email: user.email,
    };
  }

  // The portal also serves paused and canceled subscriptions, so look at every row, not only the granting one.
  const canManage =
    !!env.paddle &&
    isOwner &&
    (await store.fetchSubscriptions(ent.account.id, env.paddle.environment)).some((s) => !!s.providerCustomerId);

  const usage = {} as Record<Metric, number>;
  for (const m of METRICS) usage[m] = ent.usage[m];

  return {
    plan: { id: ent.plan.id, name: ent.plan.name },
    role: ent.role,
    accountKind: ent.account.kind,
    limits: ent.limits,
    usage,
    period: { start: ent.period.start.toISOString(), end: ent.period.end.toISOString() },
    subscription: ent.subscription
      ? {
          status: ent.subscription.status,
          interval: ent.subscription.billingInterval,
          currentPeriodEnd: ent.subscription.currentPeriodEnd?.toISOString() ?? null,
          cancelAtPeriodEnd: ent.subscription.cancelAtPeriodEnd,
        }
      : null,
    billingEnabled: env.billingEnabled,
    enforceAllowance: env.enforceAllowance,
    isOwner,
    canUpgrade: upgrade,
    canManage,
    checkout,
  };
}
