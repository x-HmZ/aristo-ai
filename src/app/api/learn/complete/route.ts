/**
 * POST /api/learn/complete
 *
 * Marks a lesson as viewed (not mastered — quiz does that).
 * Updates user_course_progress.current_concept_id and last_activity.
 *
 * Body: { conceptId }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@/lib/supabase/server";
import { requireApproved }           from "@/lib/auth/approval";
import { conceptIdSchema, parseJsonBody } from "@/lib/guard/input";
import { z }                       from "zod";

const BodySchema = z.object({ conceptId: conceptIdSchema }).strict();

export async function POST(req: NextRequest) {
  try {
    const guard = await requireApproved();
    if (guard.error) return guard.error;
    const parsed = await parseJsonBody(req, BodySchema);
    if (!parsed.ok) return parsed.response;
    const { conceptId } = parsed.data;
    const { user } = guard;
    const supabase = await createClient();

    // Update last_activity on any active course progress rows
    await supabase
      .from("user_course_progress")
      .update({
        current_concept_id: conceptId,
        last_activity:      new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("status", "in_progress");

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/learn/complete error:", err);
    return NextResponse.json({ error: "Failed to mark lesson complete" }, { status: 500 });
  }
}
