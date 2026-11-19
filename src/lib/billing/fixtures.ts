/**
 * Webhook payloads for tests, trimmed from the examples in Paddle's docs:
 *   https://developer.paddle.com/webhooks/subscriptions/subscription-created
 *   https://developer.paddle.com/webhooks/transactions/transaction-completed
 * Personal data (names, emails, addresses) is not in these entities' fields we read; the real payloads carry ids
 * that point at it.
 */

import { createHmac } from "node:crypto";

export const ACCOUNT_ID = "6f1c2a4e-8b3d-4c5e-9f00-112233445566";
export const SANDBOX_PRICE = "pri_01gsz8x8sawmvhz1pv30nge1ke";

export function subscriptionEvent(over: {
  eventType?: string;
  eventId?: string;
  occurredAt?: string;
  status?: string;
  priceId?: string;
  quantity?: number;
  customData?: Record<string, unknown> | null;
  scheduledChange?: { action: string; effective_at: string } | null;
  period?: { starts_at: string; ends_at: string } | null;
} = {}) {
  return {
    event_id: over.eventId ?? "evt_01hv8x2acma2gz7he8kg2s0hna",
    event_type: over.eventType ?? "subscription.created",
    occurred_at: over.occurredAt ?? "2026-11-16T10:18:49.621022Z",
    notification_id: "ntf_01hv8x2af22vrrz7k67g06x1kq",
    data: {
      id: "sub_01hv8x29kz0t586xy6zn1a62ny",
      status: over.status ?? "active",
      customer_id: "ctm_01hv6y1jedq4p1n0yqn5ba3ky4",
      address_id: "add_01hv8gq3318ktkfengj2r75gfx",
      business_id: null,
      currency_code: "EUR",
      items: [
        {
          status: "active",
          quantity: over.quantity ?? 1,
          recurring: true,
          price: { id: over.priceId ?? SANDBOX_PRICE, product_id: "pro_01gsz4t5hdjse780zja8vvr7jg" },
        },
      ],
      billing_cycle: { interval: "month", frequency: 1 },
      current_billing_period:
        over.period === undefined
          ? { starts_at: "2026-11-16T10:18:47.635628Z", ends_at: "2026-12-16T10:18:47.635628Z" }
          : over.period,
      scheduled_change: over.scheduledChange ?? null,
      custom_data: over.customData === undefined ? { account_id: ACCOUNT_ID, environment: "sandbox" } : over.customData,
      canceled_at: null,
      paused_at: null,
    },
  };
}

export function transactionEvent() {
  return {
    event_id: "evt_01hv8wt7xyz00000000000000a",
    event_type: "transaction.completed",
    occurred_at: "2026-11-16T10:18:50.000000Z",
    notification_id: "ntf_01hv8wt7xyz00000000000000a",
    data: {
      id: "txn_01hv8wptq8987qeep44cyrewp9",
      status: "completed",
      customer_id: "ctm_01hv6y1jedq4p1n0yqn5ba3ky4",
      subscription_id: "sub_01hv8x29kz0t586xy6zn1a62ny",
      origin: "web",
      custom_data: { account_id: ACCOUNT_ID, environment: "sandbox" },
      items: [{ price: { id: SANDBOX_PRICE }, quantity: 1 }],
      billing_period: { starts_at: "2026-11-16T10:18:47.635628Z", ends_at: "2026-12-16T10:18:47.635628Z" },
    },
  };
}

/** Builds a Paddle-Signature header the way Paddle documents it. */
export function sign(body: string, secret: string, tsSeconds: number): string {
  const h1 = createHmac("sha256", secret).update(`${tsSeconds}:${body}`).digest("hex");
  return `ts=${tsSeconds};h1=${h1}`;
}
