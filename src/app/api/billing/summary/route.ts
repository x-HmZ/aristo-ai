/**
 * GET /api/billing/summary
 *
 * Signed-in users only. Plan, limits, usage, period end, subscription status and, for an account owner while
 * billing is on, the public checkout config (client-side token, price ids for the configured environment, the
 * custom data Paddle.js passes along). Contains no secret. 404 while BILLING_ENABLED is off (the /account page
 * renders the same data server-side, so it does not depend on this route).
 */

import { NextResponse } from "next/server";
import { getBillingEnv } from "@/lib/billing/env";
import { getSignedInUser } from "@/lib/billing/entitlements";
import { buildAccountSummary } from "@/lib/billing/summary";

export const dynamic = "force-dynamic";

export async function GET() {
  let env;
  try {
    env = getBillingEnv();
  } catch {
    console.error("[billing summary] configuration error");
    return NextResponse.json({ error: "Not available" }, { status: 503 });
  }
  if (!env.billingEnabled) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await getSignedInUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const summary = await buildAccountSummary(user, env);
    return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("[billing summary] lookup failed");
    return NextResponse.json({ error: "Could not load the account" }, { status: 500 });
  }
}
