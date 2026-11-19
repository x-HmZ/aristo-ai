/**
 * POST /api/quiz/complete
 *
 * Finalises a quiz session — updates user_course_progress.last_activity.
 * Per-question rows were already written to quiz_attempts by /api/quiz/submit.
 *
 * Body: { conceptId, score, total, context? }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@/lib/supabase/server";
import { conceptIdSchema, parseJsonBody } from "@/lib/guard/input";
import { requireApproved }          from "@/lib/auth/approval";
import { enforceRate, rateLimitedResponse } from "@/lib/guard/rate";
import { z }                       from "zod";

const BodySchema = z.object({
  conceptId: conceptIdSchema,
  score:     z.number().min(0).max(1000),
  total:     z.number().min(0).max(1000),
  context:   z.enum(["lesson", "module_checkpoint", "review"]).optional(),
}).strict();

export async function POST(req: NextRequest) {
  try {
    const guard = await requireApproved();
    if (guard.error) return guard.error;
    const { user } = guard;
    const supabase = await createClient();
    const parsed = await parseJsonBody(req, BodySchema);
    if (!parsed.ok) return parsed.response;
    const decision = await enforceRate(user.id, "quiz_complete");
    if (!decision.allowed) return rateLimitedResponse(decision);
    const body = parsed.data;

    const passed = body.total > 0 && body.score / body.total >= 0.6;

    // Mark the concept as last-visited in the user's course progress
    await supabase
      .from("user_course_progress")
      .update({
        current_concept_id: body.conceptId,
        last_activity:      new Date().toISOString(),
      })
      .eq("user_id", user.id);

    return NextResponse.json({ ok: true, passed });
  } catch (err) {
    console.error("POST /api/quiz/complete error:", err);
    return NextResponse.json({ error: "Failed to record quiz completion" }, { status: 500 });
  }
}
