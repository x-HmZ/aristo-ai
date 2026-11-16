/**
 * Customer-portal access for POST /api/billing/portal. Only the account owner of a family or organisation
 * account may open it; the customer id comes from the account's own subscription rows, never from the request.
 * Paddle's portal is where cancellation, payment method and invoices live (merchant of record).
 */

import type { BillingEnv } from "./env";
import { getAccountForUser } from "./entitlements";
import type { BillingProvider } from "./provider";
import * as store from "./store";

export type PortalResult =
  | { status: 200; url: string }
  | { status: 403 | 404 | 502; error: string };

export async function openPortal(
  userId: string,
  env: BillingEnv,
  provider: BillingProvider,
): Promise<PortalResult> {
  if (!env.paddle) return { status: 404, error: "Not found" };
  const { account, role } = await getAccountForUser(userId);
  if (role !== "owner") return { status: 403, error: "Only the account owner can manage billing" };

  const subs = (await store.fetchSubscriptions(account.id, env.paddle.environment)).filter((s) => s.providerCustomerId);
  if (subs.length === 0) return { status: 404, error: "No subscription to manage" };

  // One Paddle customer per account in practice; take the most recently active row's customer.
  const order = { active: 0, trialing: 1, past_due: 2, paused: 3, canceled: 4 } as const;
  subs.sort((a, b) => order[a.status] - order[b.status]);
  const customerId = subs[0].providerCustomerId as string;
  const subscriptionIds = subs.filter((s) => s.providerCustomerId === customerId).map((s) => s.providerSubscriptionId);

  try {
    return { status: 200, url: await provider.createPortalSession(customerId, subscriptionIds) };
  } catch {
    console.error("[billing portal] session creation failed");
    return { status: 502, error: "Could not open the billing portal" };
  }
}
