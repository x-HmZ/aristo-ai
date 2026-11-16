/**
 * Applying a verified, normalised webhook event to the database.
 *
 * Rules (owner brief, L13):
 *   - The event id is the idempotency key. A replay of an event that was applied returns at once.
 *   - The plan comes ONLY from a price id through `plan_prices` for the configured environment. Plan names in the
 *     payload or in custom data are never read.
 *   - The account comes from `custom_data.account_id` set at checkout (Paddle copies a checkout's custom data to
 *     the subscription it creates: https://developer.paddle.com/build/transactions/custom-data), or, for a later
 *     event without it, from the stored subscription row. It must exist.
 *   - An event declaring another environment, or whose prices are unknown in this one, is ignored and logged.
 *   - Logs carry event ids and types only: no names, emails or addresses.
 * Subscription state is taken from subscription.* events, which carry the full entity. Transaction events are
 * recorded (so a replay is recognised) and not applied: every transaction that changes a subscription is followed
 * by a subscription event.
 */

import type { BillingEnv, PaddleEnvironment } from "./env";
import { createPaddleProvider } from "./paddle";
import type { PlanId } from "./plans";
import type { NormalizedEvent } from "./provider";
import * as store from "./store";

/** Paddle payloads are a few kilobytes; anything far larger is not from Paddle. */
export const MAX_WEBHOOK_BYTES = 256 * 1024;

/**
 * The whole POST /api/billing/webhook decision, minus the HTTP plumbing.
 *   404 billing off; 413 oversized; 401 bad or missing signature (checked BEFORE the body is parsed);
 *   400 verified but not the documented shape; 500 database error (Paddle retries); 200 otherwise, including a
 *   replay and an ignored event.
 */
export async function handleWebhookRequest(
  rawBody: string,
  signatureHeader: string | null,
  env: BillingEnv,
  nowMs: number = Date.now(),
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!env.billingEnabled || !env.paddle) return { status: 404, body: { error: "Not found" } };
  if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BYTES) return { status: 413, body: { error: "Too large" } };

  const verified = createPaddleProvider(env.paddle).verifyWebhook(rawBody, signatureHeader, nowMs);
  if (!verified.ok) {
    if (verified.reason === "signature") return { status: 401, body: { error: "Invalid signature" } };
    console.warn("[billing webhook] verified body did not match the expected shape");
    return { status: 400, body: { error: "Unexpected payload" } };
  }

  try {
    const outcome = await applyWebhookEvent(verified.event, env.paddle.environment);
    return { status: 200, body: { received: true, outcome } };
  } catch {
    console.error(`[billing webhook] ${verified.event.type} ${verified.event.eventId}: processing failed`);
    return { status: 500, body: { error: "Processing failed" } };
  }
}

export type WebhookOutcome = "replay" | "applied" | "stale" | "ignored";

function log(event: NormalizedEvent, message: string): void {
  console.warn(`[billing webhook] ${event.type} ${event.eventId}: ${message}`);
}

export async function applyWebhookEvent(event: NormalizedEvent, environment: PaddleEnvironment): Promise<WebhookOutcome> {
  const seen = await store.recordEvent({
    eventId: event.eventId,
    type: event.type,
    occurredAt: event.occurredAt,
    subscriptionId: event.subscription?.subscriptionId ?? event.transactionSubscriptionId,
  });
  if (seen === "done") return "replay";

  const ignore = async (why: string): Promise<WebhookOutcome> => {
    log(event, `ignored (${why})`);
    await store.markEvent(event.eventId, "ignored");
    return "ignored";
  };

  if (event.declaredEnvironment && event.declaredEnvironment !== environment) {
    return ignore(`environment ${event.declaredEnvironment} does not match ${environment}`);
  }

  if (event.kind !== "subscription" || !event.subscription) {
    return ignore(event.kind === "transaction" ? "transaction recorded, state comes from subscription events" : "type not used");
  }
  const sub = event.subscription;

  // Plan: the first item whose price is known in this environment.
  let match: { planId: PlanId; interval: "month" | "year"; quantity: number } | null = null;
  for (const item of sub.items) {
    const plan = await store.findPlanForPrice(environment, item.priceId);
    if (plan) {
      match = { ...plan, quantity: item.quantity };
      break;
    }
  }
  if (!match) return ignore("no price on the subscription is configured for this environment");

  // Account: a stored row wins (its account never changes); otherwise the checkout's custom data.
  const storedAccount = await store.findSubscriptionAccount(sub.subscriptionId);
  let accountId = storedAccount;
  if (!accountId) {
    if (!event.accountId) return ignore("no account id in custom data");
    if (!(await store.accountExists(event.accountId))) return ignore("account id in custom data does not exist");
    accountId = event.accountId;
  } else if (event.accountId && event.accountId !== storedAccount) {
    log(event, "custom data names a different account than the stored subscription; keeping the stored one");
  }

  const written = await store.applySubscriptionEvent({
    accountId,
    environment,
    customerId: sub.customerId,
    subscriptionId: sub.subscriptionId,
    planId: match.planId,
    status: sub.status,
    interval: sub.interval ?? match.interval,
    seats: match.quantity,
    periodStart: sub.periodStart,
    periodEnd: sub.periodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    occurredAt: event.occurredAt,
  });

  await store.markEvent(event.eventId, "applied");
  return written ? "applied" : "stale";
}
