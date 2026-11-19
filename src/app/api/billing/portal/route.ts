/**
 * POST /api/billing/portal
 *
 * Signed-in account owners only. Returns { url } for Paddle's customer portal (a temporary link: not stored).
 * 404 while BILLING_ENABLED is off or when the account has no subscription. Takes no body.
 */

import { NextResponse } from "next/server";
import { getBillingEnv } from "@/lib/billing/env";
import { getSignedInUser } from "@/lib/billing/entitlements";
import { openPortal } from "@/lib/billing/portal";
import { getBillingProvider } from "@/lib/billing/summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  let env;
  try {
    env = getBillingEnv();
  } catch {
    console.error("[billing portal] configuration error");
    return NextResponse.json({ error: "Not available" }, { status: 503 });
  }
  const provider = getBillingProvider(env);
  if (!env.billingEnabled || !provider) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await getSignedInUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await openPortal(user.id, env, provider);
    return result.status === 200
      ? NextResponse.json({ url: result.url }, { headers: { "Cache-Control": "no-store" } })
      : NextResponse.json({ error: result.error }, { status: result.status });
  } catch {
    console.error("[billing portal] lookup failed");
    return NextResponse.json({ error: "Could not open the billing portal" }, { status: 500 });
  }
}
