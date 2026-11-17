/**
 * POST /api/learn/explain-more
 *
 * Returns a deeper explanation of a specific lesson phase (Haiku).
 * Called when the student taps "Explain more" on any phase card.
 *
 * Body: { phase, phaseContent, conceptName, profile? }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireEntitlement, spendAllowance, releaseConsumed, type Consumed } from "@/lib/billing/entitlements";
import { explainMore }               from "@/lib/agents/teaching";
import { guardSpend }                from "@/lib/guard";
import { parseJsonBody, profileSchema, text } from "@/lib/guard/input";
import { z }                       from "zod";

const BodySchema = z.object({
  phase:        z.enum(["activate", "explain", "demonstrate", "challenge", "connect"]),
  phaseContent: text(4000),
  conceptName:  text(200),
  profile:      profileSchema.optional(),
}).strict();

export async function POST(req: NextRequest) {
  let consumed: Consumed | null = null;
  try {
    const guard = await requireEntitlement();
    if (guard.error) return guard.error;

    const parsed = await parseJsonBody(req, BodySchema);
    if (!parsed.ok) return parsed.response;
    const { phase, phaseContent, conceptName, profile } = parsed.data;

    const blocked = await guardSpend(guard.user.id, "explain_more");
    if (blocked) return blocked;
    const spent = await spendAllowance(guard.entitlement, "chat_turns");
    if (spent.error) return spent.error;
    consumed = spent.consumed;

    const explanation = await explainMore(phase, phaseContent, conceptName, profile ?? null, guard.user.id);

    return NextResponse.json({ explanation });
  } catch (err) {
    await releaseConsumed(consumed);
    console.error("POST /api/learn/explain-more error:", err);
    return NextResponse.json({ error: "Failed to generate explanation" }, { status: 500 });
  }
}
