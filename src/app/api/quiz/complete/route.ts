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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      conceptId: string;
      score:     number;
      total:     number;
      context?:  "lesson" | "module_checkpoint" | "review";
    };

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
