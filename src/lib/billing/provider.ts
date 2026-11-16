/**
 * Provider-agnostic billing interface. Paddle (paddle.ts) is the only implementation; another merchant of
 * record would implement the same three things and the routes would not change.
 */

import type { PaddleEnvironment } from "./env";
import type { SubscriptionStatus } from "./plans";

/** A subscription change, normalised. Plan names are deliberately absent: the plan comes from `priceIds`. */
export interface NormalizedSubscription {
  subscriptionId: string;
  customerId: string | null;
  status: SubscriptionStatus;
  /** Every price id on the subscription with its quantity, in payload order. */
  items: { priceId: string; quantity: number }[];
  interval: "month" | "year" | null;
  periodStart: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface NormalizedEvent {
  eventId: string;
  type: string;
  occurredAt: string;
  /** `subscription` for subscription.* events we apply; `transaction` for transaction.*; `other` otherwise. */
  kind: "subscription" | "transaction" | "other";
  subscription: NormalizedSubscription | null;
  /** The subscription a transaction belongs to, if any. */
  transactionSubscriptionId: string | null;
  /** From the checkout's custom data. Untrusted beyond "which account was the buyer looking at". */
  accountId: string | null;
  /** The environment the checkout said it ran in (custom data), if present. */
  declaredEnvironment: PaddleEnvironment | null;
}

export type WebhookVerification =
  | { ok: true; event: NormalizedEvent }
  | { ok: false; reason: "signature" | "payload" };

export interface PublicCheckoutConfig {
  environment: PaddleEnvironment;
  clientToken: string;
}

export interface BillingProvider {
  /** Verify the raw body against the signature header, then parse it. Never parses an unverified body. */
  verifyWebhook(rawBody: string, signatureHeader: string | null, nowMs?: number): WebhookVerification;
  /** A short-lived customer-portal URL for a customer. */
  createPortalSession(customerId: string, subscriptionIds: string[]): Promise<string>;
  /** What the browser needs to open checkout. Contains no secret. */
  publicConfig(): PublicCheckoutConfig;
}
