/**
 * POST /api/billing/webhook
 *
 * Paddle notification destination. 404 while BILLING_ENABLED is off. The raw body is read as text and verified
 * (Paddle-Signature, HMAC-SHA256, timing-safe, 5 s tolerance) before anything parses it; logic and status codes
 * are in src/lib/billing/webhook.ts (handleWebhookRequest). No personal data is logged or stored.
 */

import { NextRequest, NextResponse } from "next/server";
import { getBillingEnv, BillingConfigError } from "@/lib/billing/env";
import { handleWebhookRequest, MAX_WEBHOOK_BYTES } from "@/lib/billing/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let env;
  try {
    env = getBillingEnv();
  } catch (e) {
    console.error("[billing webhook] configuration error:", e instanceof BillingConfigError ? e.message : "unknown");
    return NextResponse.json({ error: "Not available" }, { status: 503 });
  }
  if (!env.billingEnabled) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ error: "Too large" }, { status: 413 });
  }

  const rawBody = await req.text();
  const result = await handleWebhookRequest(rawBody, req.headers.get("paddle-signature"), env);
  return NextResponse.json(result.body, { status: result.status });
}
