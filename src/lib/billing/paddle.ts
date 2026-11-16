/**
 * Paddle Billing implementation of BillingProvider. No server SDK: `fetch` for the API, `node:crypto` for the
 * webhook signature. Paddle is the merchant of record: its checkout and portal carry the legal texts, tax and
 * the payment form, so this app never builds a payment form and never sees card data.
 *
 * Documentation this file relies on (read 2026-11-16):
 *   Signature:     https://developer.paddle.com/webhooks/signature-verification
 *   Events:        https://developer.paddle.com/webhooks/subscriptions/subscription-created
 *                  https://developer.paddle.com/webhooks/transactions/transaction-completed
 *                  https://developer.paddle.com/api-reference/event-types/list-event-types
 *   Custom data:   https://developer.paddle.com/build/transactions/custom-data
 *   Portal:        https://developer.paddle.com/api-reference/customer-portals/create-customer-portal-session
 *   Auth and URLs: https://developer.paddle.com/api-reference/about/authentication
 *                  https://developer.paddle.com/api-reference/about/ ("Choose a base URL")
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { PaddleConfig, PaddleEnvironment } from "./env";
import type {
  BillingProvider,
  NormalizedEvent,
  NormalizedSubscription,
  PublicCheckoutConfig,
  WebhookVerification,
} from "./provider";

// "Sandbox https://sandbox-api.paddle.com, Live https://api.paddle.com"; keys only work against their own URL.
// https://developer.paddle.com/api-reference/about/
export const PADDLE_API_BASE: Record<PaddleEnvironment, string> = {
  sandbox: "https://sandbox-api.paddle.com",
  live: "https://api.paddle.com",
};

/**
 * "The default tolerance between the timestamp and the current time is five seconds."
 * https://developer.paddle.com/webhooks/signature-verification
 * Applied in both directions (a timestamp from the future is as suspect as a stale one).
 */
export const SIGNATURE_TOLERANCE_SECONDS = 5;

// ── Signature ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Header `Paddle-Signature: ts=<unix seconds>;h1=<hex hmac>`. More than one h1 may appear while a secret is
 * rotated, so any matching h1 passes. Returns null for a malformed header.
 * https://developer.paddle.com/webhooks/signature-verification
 */
export function parseSignatureHeader(header: string): { ts: number; h1: string[] } | null {
  if (header.length > 1000) return null;
  let ts: number | null = null;
  const h1: string[] = [];
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) return null;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "ts") {
      if (ts !== null || !/^\d{1,12}$/.test(value)) return null;
      ts = Number(value);
    } else if (key === "h1") {
      if (!/^[0-9a-f]{64}$/i.test(value)) return null;
      h1.push(value.toLowerCase());
    }
    // Unknown keys are ignored (forward compatible), but every part must be key=value.
  }
  if (ts === null || h1.length === 0) return null;
  return { ts, h1 };
}

/**
 * Verifies `HMAC-SHA256(secret, ts + ":" + rawBody)` against the header with a timing-safe comparison and the
 * timestamp tolerance. The raw body must be exactly as received (no re-serialisation).
 */
export function verifyPaddleSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowMs: number = Date.now(),
  toleranceSeconds: number = SIGNATURE_TOLERANCE_SECONDS,
): boolean {
  if (!header || !secret) return false;
  const parsed = parseSignatureHeader(header);
  if (!parsed) return false;
  if (Math.abs(Math.floor(nowMs / 1000) - parsed.ts) > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret).update(`${parsed.ts}:${rawBody}`, "utf8").digest();
  let match = false;
  for (const candidate of parsed.h1) {
    const given = Buffer.from(candidate, "hex");
    // Both are 32 bytes (the header regex fixes 64 hex chars); check anyway, timingSafeEqual throws otherwise.
    if (given.length === expected.length && timingSafeEqual(given, expected)) match = true;
  }
  return match;
}

// ── Payload ────────────────────────────────────────────────────────────────────────────────────────────────

const id = (prefix: string) => z.string().max(100).regex(new RegExp(`^${prefix}_[a-z0-9]+$`));
const isoDate = z.string().max(64).refine((v) => !Number.isNaN(Date.parse(v)), "not a date");

const EnvelopeSchema = z.object({
  event_id: id("evt"),
  event_type: z.string().max(100).regex(/^[a-z_]+\.[a-z_]+$/),
  occurred_at: isoDate,
  data: z.record(z.string(), z.unknown()),
});

const CustomDataSchema = z
  .object({
    account_id: z.uuid().optional(),
    environment: z.enum(["sandbox", "live"]).optional(),
  })
  .nullable()
  .optional()
  .catch(null);

const ItemsSchema = z
  .array(
    z.object({
      price: z.object({ id: id("pri") }),
      quantity: z.number().int().min(1).max(100_000).default(1),
    }),
  )
  .max(50);

// Fields per https://developer.paddle.com/webhooks/subscriptions/subscription-created
const SubscriptionDataSchema = z.object({
  id: id("sub"),
  status: z.enum(["active", "canceled", "past_due", "paused", "trialing"]),
  customer_id: id("ctm").nullable().optional(),
  items: ItemsSchema,
  billing_cycle: z
    .object({ interval: z.enum(["day", "week", "month", "year"]), frequency: z.number().int().min(1) })
    .nullable()
    .optional(),
  current_billing_period: z.object({ starts_at: isoDate, ends_at: isoDate }).nullable().optional(),
  scheduled_change: z.object({ action: z.enum(["cancel", "pause", "resume"]) }).nullable().optional(),
  custom_data: CustomDataSchema,
});

// Fields per https://developer.paddle.com/webhooks/transactions/transaction-completed
const TransactionDataSchema = z.object({
  id: id("txn"),
  subscription_id: id("sub").nullable().optional(),
  custom_data: CustomDataSchema,
});

/** Subscription events whose payload is the full subscription entity, applied to `subscriptions`. */
export const SUBSCRIPTION_EVENTS = new Set([
  "subscription.created",
  "subscription.updated",
  "subscription.activated",
  "subscription.canceled",
  "subscription.past_due",
  "subscription.paused",
  "subscription.resumed",
  "subscription.trialing",
]);

function normalizeSubscription(d: z.infer<typeof SubscriptionDataSchema>): NormalizedSubscription {
  const cycle = d.billing_cycle;
  const interval =
    cycle && cycle.frequency === 1 && (cycle.interval === "month" || cycle.interval === "year") ? cycle.interval : null;
  return {
    subscriptionId: d.id,
    customerId: d.customer_id ?? null,
    status: d.status,
    items: d.items.map((i) => ({ priceId: i.price.id, quantity: i.quantity })),
    interval,
    // "null for paused and canceled subscriptions"
    periodStart: d.current_billing_period?.starts_at ?? null,
    periodEnd: d.current_billing_period?.ends_at ?? null,
    cancelAtPeriodEnd: d.scheduled_change?.action === "cancel",
  };
}

/** Parse a VERIFIED body into a normalised event. Returns null if it does not match the documented shape. */
export function parsePaddleEvent(rawBody: string): NormalizedEvent | null {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return null;
  }
  const env = EnvelopeSchema.safeParse(json);
  if (!env.success) return null;
  const { event_id, event_type, occurred_at, data } = env.data;

  const base: NormalizedEvent = {
    eventId: event_id,
    type: event_type,
    occurredAt: new Date(occurred_at).toISOString(),
    kind: "other",
    subscription: null,
    transactionSubscriptionId: null,
    accountId: null,
    declaredEnvironment: null,
  };

  if (SUBSCRIPTION_EVENTS.has(event_type)) {
    const sub = SubscriptionDataSchema.safeParse(data);
    if (!sub.success) return null;
    return {
      ...base,
      kind: "subscription",
      subscription: normalizeSubscription(sub.data),
      accountId: sub.data.custom_data?.account_id ?? null,
      declaredEnvironment: sub.data.custom_data?.environment ?? null,
    };
  }

  if (event_type.startsWith("transaction.")) {
    const txn = TransactionDataSchema.safeParse(data);
    if (!txn.success) return null;
    return {
      ...base,
      kind: "transaction",
      transactionSubscriptionId: txn.data.subscription_id ?? null,
      accountId: txn.data.custom_data?.account_id ?? null,
      declaredEnvironment: txn.data.custom_data?.environment ?? null,
    };
  }

  return base;
}

// ── Provider ───────────────────────────────────────────────────────────────────────────────────────────────

const PortalResponseSchema = z.object({
  data: z.object({ urls: z.object({ general: z.object({ overview: z.url() }) }) }),
});

const CUSTOMER_ID = /^ctm_[a-z\d]{26}$/;
const SUBSCRIPTION_ID = /^sub_[a-z\d]{26}$/;

export function createPaddleProvider(config: PaddleConfig, fetchImpl: typeof fetch = fetch): BillingProvider {
  return {
    verifyWebhook(rawBody: string, signatureHeader: string | null, nowMs?: number): WebhookVerification {
      if (!verifyPaddleSignature(rawBody, signatureHeader, config.webhookSecret, nowMs)) {
        return { ok: false, reason: "signature" };
      }
      const event = parsePaddleEvent(rawBody);
      return event ? { ok: true, event } : { ok: false, reason: "payload" };
    },

    /**
     * POST /customers/{customer_id}/portal-sessions with `subscription_ids`; the link is in
     * data.urls.general.overview and is temporary ("shouldn't be stored or cached").
     * https://developer.paddle.com/api-reference/customer-portals/create-customer-portal-session
     * Auth: "Authorization: Bearer <api key>" https://developer.paddle.com/api-reference/about/authentication
     */
    async createPortalSession(customerId: string, subscriptionIds: string[]): Promise<string> {
      if (!CUSTOMER_ID.test(customerId)) throw new Error("invalid customer id");
      const subs = subscriptionIds.filter((s) => SUBSCRIPTION_ID.test(s)).slice(0, 25);
      const res = await fetchImpl(`${PADDLE_API_BASE[config.environment]}/customers/${customerId}/portal-sessions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ subscription_ids: subs }),
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`portal session failed with status ${res.status}`);
      const parsed = PortalResponseSchema.safeParse(await res.json());
      if (!parsed.success) throw new Error("portal session response had an unexpected shape");
      const url = parsed.data.data.urls.general.overview;
      if (!url.startsWith("https://")) throw new Error("portal session url is not https");
      return url;
    },

    publicConfig(): PublicCheckoutConfig {
      return { environment: config.environment, clientToken: config.clientToken };
    },
  };
}
