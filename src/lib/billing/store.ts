/**
 * Every database read and write billing makes, in one place, through the service-role client.
 *
 * The tables in migration 021 are not writable by browser roles at all; these functions run on the server only.
 * Tests mock this module, so the logic in entitlements.ts and webhook.ts is tested without a database.
 * Row shapes coming back are validated with Zod before use: a malformed row is treated as missing.
 */

import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { METRICS, PLAN_IDS, SUBSCRIPTION_STATUSES, type Metric, type PlanId } from "./plans";
import type { PaddleEnvironment } from "./env";

type Service = ReturnType<typeof createServiceClient>;

let client: Service | null = null;
function db(): Service {
  if (!client) client = createServiceClient();
  return client;
}

export const ACCOUNT_ROLES = ["owner", "org_admin", "teacher", "learner"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export interface Account {
  id: string;
  kind: "family" | "organisation";
  name: string;
  ownerUserId: string | null;
  seatLimit: number;
}

export interface Membership {
  account: Account;
  role: AccountRole;
  createdAt: string;
}

export interface SubscriptionRow {
  id: string;
  accountId: string;
  environment: PaddleEnvironment;
  providerCustomerId: string | null;
  providerSubscriptionId: string;
  planId: PlanId;
  status: (typeof SUBSCRIPTION_STATUSES)[number];
  billingInterval: "month" | "year" | null;
  seats: number;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  pastDueSince: Date | null;
}

const AccountSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["family", "organisation"]),
  name: z.string().nullable(),
  owner_user_id: z.uuid().nullable(),
  seat_limit: z.number().int().min(1),
});

const MembershipSchema = z.object({
  role: z.enum(ACCOUNT_ROLES),
  created_at: z.string(),
  accounts: AccountSchema,
});

const ts = z.string().nullable().transform((v) => (v ? new Date(v) : null));

const SubscriptionSchema = z.object({
  id: z.uuid(),
  account_id: z.uuid(),
  environment: z.enum(["sandbox", "live"]),
  provider_customer_id: z.string().nullable(),
  provider_subscription_id: z.string(),
  plan_id: z.enum(PLAN_IDS),
  status: z.enum(SUBSCRIPTION_STATUSES),
  billing_interval: z.enum(["month", "year"]).nullable(),
  seats: z.number().int().min(1),
  current_period_start: ts,
  current_period_end: ts,
  cancel_at_period_end: z.boolean(),
  past_due_since: ts,
});

function toAccount(a: z.infer<typeof AccountSchema>): Account {
  return { id: a.id, kind: a.kind, name: a.name ?? "", ownerUserId: a.owner_user_id, seatLimit: a.seat_limit };
}

// ── Plans ──────────────────────────────────────────────────────────────────────────────────────────────────

export async function fetchPlanRows(): Promise<unknown[]> {
  const { data, error } = await db()
    .from("plans")
    .select(
      "id, name, kind, is_public, sort_order, price_month_eur, price_year_eur, price_month_usd, price_year_usd, per_seat, limits, contact_only",
    );
  if (error) throw new Error(`plans read failed: ${error.code ?? "unknown"}`);
  return data ?? [];
}

export interface PlanPrice {
  planId: PlanId;
  interval: "month" | "year";
  priceId: string;
}

const PlanPriceSchema = z.object({
  plan_id: z.enum(PLAN_IDS),
  billing_interval: z.enum(["month", "year"]),
  provider_price_id: z.string(),
});

/** Every Paddle price configured for one environment. */
export async function fetchPlanPrices(environment: PaddleEnvironment): Promise<PlanPrice[]> {
  const { data, error } = await db()
    .from("plan_prices")
    .select("plan_id, billing_interval, provider_price_id")
    .eq("provider", "paddle")
    .eq("environment", environment);
  if (error) throw new Error(`plan_prices read failed: ${error.code ?? "unknown"}`);
  const out: PlanPrice[] = [];
  for (const row of data ?? []) {
    const p = PlanPriceSchema.safeParse(row);
    if (p.success) out.push({ planId: p.data.plan_id, interval: p.data.billing_interval, priceId: p.data.provider_price_id });
  }
  return out;
}

/** The plan a provider price id belongs to in this environment, or null. The only source of a paid plan. */
export async function findPlanForPrice(
  environment: PaddleEnvironment,
  priceId: string,
): Promise<{ planId: PlanId; interval: "month" | "year" } | null> {
  const { data, error } = await db()
    .from("plan_prices")
    .select("plan_id, billing_interval, provider_price_id")
    .eq("provider", "paddle")
    .eq("environment", environment)
    .eq("provider_price_id", priceId)
    .maybeSingle();
  if (error) throw new Error(`plan_prices read failed: ${error.code ?? "unknown"}`);
  const p = PlanPriceSchema.safeParse(data);
  return p.success ? { planId: p.data.plan_id, interval: p.data.billing_interval } : null;
}

// ── Accounts ───────────────────────────────────────────────────────────────────────────────────────────────

export async function fetchMemberships(userId: string): Promise<Membership[]> {
  const { data, error } = await db()
    .from("account_members")
    .select("role, created_at, accounts(id, kind, name, owner_user_id, seat_limit)")
    .eq("user_id", userId);
  if (error) throw new Error(`account_members read failed: ${error.code ?? "unknown"}`);
  const out: Membership[] = [];
  for (const row of data ?? []) {
    const m = MembershipSchema.safeParse(row);
    if (m.success) out.push({ account: toAccount(m.data.accounts), role: m.data.role, createdAt: m.data.created_at });
  }
  return out;
}

/** Creates the user's family account and owner membership if missing (the trigger normally has). */
export async function ensureFamilyAccount(userId: string): Promise<void> {
  const { error } = await db().rpc("ensure_family_account", { p_user_id: userId });
  if (error) throw new Error(`ensure_family_account failed: ${error.code ?? "unknown"}`);
}

export async function accountExists(accountId: string): Promise<boolean> {
  const { data, error } = await db().from("accounts").select("id").eq("id", accountId).maybeSingle();
  if (error) throw new Error(`accounts read failed: ${error.code ?? "unknown"}`);
  return !!data;
}

export async function fetchIsPlatformAdmin(userId: string): Promise<boolean> {
  const { data } = await db().from("profiles").select("is_admin").eq("id", userId).maybeSingle();
  return data?.is_admin === true;
}

// ── Subscriptions ──────────────────────────────────────────────────────────────────────────────────────────

const SUBSCRIPTION_COLUMNS =
  "id, account_id, environment, provider_customer_id, provider_subscription_id, plan_id, status, billing_interval, seats, current_period_start, current_period_end, cancel_at_period_end, past_due_since";

function toSubscription(row: unknown): SubscriptionRow | null {
  const s = SubscriptionSchema.safeParse(row);
  if (!s.success) return null;
  const d = s.data;
  return {
    id: d.id,
    accountId: d.account_id,
    environment: d.environment,
    providerCustomerId: d.provider_customer_id,
    providerSubscriptionId: d.provider_subscription_id,
    planId: d.plan_id,
    status: d.status,
    billingInterval: d.billing_interval,
    seats: d.seats,
    currentPeriodStart: d.current_period_start,
    currentPeriodEnd: d.current_period_end,
    cancelAtPeriodEnd: d.cancel_at_period_end,
    pastDueSince: d.past_due_since,
  };
}

export async function fetchSubscriptions(accountId: string, environment: PaddleEnvironment): Promise<SubscriptionRow[]> {
  const { data, error } = await db()
    .from("subscriptions")
    .select(SUBSCRIPTION_COLUMNS)
    .eq("account_id", accountId)
    .eq("environment", environment);
  if (error) throw new Error(`subscriptions read failed: ${error.code ?? "unknown"}`);
  return (data ?? []).map(toSubscription).filter((s): s is SubscriptionRow => s !== null);
}

/** The account an existing subscription row belongs to, for events that carry no custom data. */
export async function findSubscriptionAccount(providerSubscriptionId: string): Promise<string | null> {
  const { data, error } = await db()
    .from("subscriptions")
    .select("account_id")
    .eq("provider_subscription_id", providerSubscriptionId)
    .maybeSingle();
  if (error) throw new Error(`subscriptions read failed: ${error.code ?? "unknown"}`);
  return typeof data?.account_id === "string" ? data.account_id : null;
}

export interface ApplySubscriptionInput {
  accountId: string;
  environment: PaddleEnvironment;
  customerId: string | null;
  subscriptionId: string;
  planId: PlanId;
  status: SubscriptionRow["status"];
  interval: "month" | "year" | null;
  seats: number;
  periodStart: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  occurredAt: string;
}

/** Upsert through apply_subscription_event (one statement, ignores events older than the stored one). */
export async function applySubscriptionEvent(input: ApplySubscriptionInput): Promise<boolean> {
  const { data, error } = await db().rpc("apply_subscription_event", {
    p_account_id: input.accountId,
    p_provider: "paddle",
    p_environment: input.environment,
    p_provider_customer_id: input.customerId,
    p_provider_subscription_id: input.subscriptionId,
    p_plan_id: input.planId,
    p_status: input.status,
    p_billing_interval: input.interval,
    p_seats: input.seats,
    p_period_start: input.periodStart,
    p_period_end: input.periodEnd,
    p_cancel_at_period_end: input.cancelAtPeriodEnd,
    p_occurred_at: input.occurredAt,
  });
  if (error) throw new Error(`apply_subscription_event failed: ${error.code ?? "unknown"}`);
  return data === true;
}

// ── Webhook events ─────────────────────────────────────────────────────────────────────────────────────────

export type EventOutcome = "applied" | "ignored";

/**
 * Records an event id. Returns "new" the first time, "done" if it was already processed and applied (a replay),
 * and "retry" if it was seen before but not applied (failed half-way, or ignored, e.g. a price the owner has
 * since added to plan_prices); a retry is processed again, which is safe because applying is idempotent.
 */
export async function recordEvent(input: {
  eventId: string;
  type: string;
  occurredAt: string;
  subscriptionId: string | null;
}): Promise<"new" | "done" | "retry"> {
  const { error } = await db().from("billing_events").insert({
    provider_event_id: input.eventId,
    provider: "paddle",
    type: input.type,
    occurred_at: input.occurredAt,
    provider_subscription_id: input.subscriptionId,
  });
  if (!error) return "new";
  // 23505 unique_violation: seen before.
  if (error.code !== "23505") throw new Error(`billing_events insert failed: ${error.code ?? "unknown"}`);
  const { data, error: readError } = await db()
    .from("billing_events")
    .select("outcome, processed_at")
    .eq("provider_event_id", input.eventId)
    .maybeSingle();
  if (readError) throw new Error(`billing_events read failed: ${readError.code ?? "unknown"}`);
  return data?.outcome === "applied" && data?.processed_at ? "done" : "retry";
}

export async function markEvent(eventId: string, outcome: EventOutcome): Promise<void> {
  const { error } = await db()
    .from("billing_events")
    .update({ outcome, processed_at: new Date().toISOString() })
    .eq("provider_event_id", eventId);
  if (error) throw new Error(`billing_events update failed: ${error.code ?? "unknown"}`);
}

// ── Usage ──────────────────────────────────────────────────────────────────────────────────────────────────

const UsageRowSchema = z.object({ metric: z.enum(METRICS), used: z.union([z.number(), z.string()]) });

export async function fetchUsage(accountId: string, periodStart: string): Promise<Partial<Record<Metric, number>>> {
  const { data, error } = await db()
    .from("usage_counters")
    .select("metric, used")
    .eq("account_id", accountId)
    .eq("period_start", periodStart);
  if (error) throw new Error(`usage_counters read failed: ${error.code ?? "unknown"}`);
  const out: Partial<Record<Metric, number>> = {};
  for (const row of data ?? []) {
    const r = UsageRowSchema.safeParse(row);
    if (r.success) out[r.data.metric] = Number(r.data.used) || 0;
  }
  return out;
}

const ConsumeResultSchema = z.array(
  z.object({ allowed: z.boolean(), used: z.union([z.number(), z.string()]) }),
).min(1);

export async function consumeAllowance(input: {
  accountId: string;
  periodStart: string;
  metric: Metric;
  amount: number;
  limit: number;
}): Promise<{ allowed: boolean; used: number }> {
  const { data, error } = await db().rpc("consume_allowance", {
    p_account_id: input.accountId,
    p_period_start: input.periodStart,
    p_metric: input.metric,
    p_amount: input.amount,
    p_limit: input.limit,
  });
  if (error) throw new Error(`consume_allowance failed: ${error.code ?? "unknown"}`);
  const parsed = ConsumeResultSchema.safeParse(data);
  if (!parsed.success) throw new Error("consume_allowance returned an unexpected shape");
  return { allowed: parsed.data[0].allowed, used: Number(parsed.data[0].used) || 0 };
}

export async function releaseAllowance(input: {
  accountId: string;
  periodStart: string;
  metric: Metric;
  amount: number;
}): Promise<void> {
  const { error } = await db().rpc("release_allowance", {
    p_account_id: input.accountId,
    p_period_start: input.periodStart,
    p_metric: input.metric,
    p_amount: input.amount,
  });
  if (error) throw new Error(`release_allowance failed: ${error.code ?? "unknown"}`);
}
