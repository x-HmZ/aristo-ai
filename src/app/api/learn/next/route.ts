/**
 * GET /api/learn/next
 *
 * Returns the next action for the learner:
 *  - "review"  if SRS queue has due items AND the 70/30 blend selects it
 *  - "lesson"  with the next concept ID from their active course
 *  - "done"    if the course is complete
 *
 * Phase 6 blending (spec §7.2):
 *  - 0 overdue  → always "lesson"
 *  - 1–9 overdue → 30 % chance of "review"
 *  - ≥10 overdue → 50 % chance of "review" (learning is falling behind)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApproved } from "@/lib/auth/approval";
import { getOverdueCount } from "@/lib/srs/queue";

export async function GET() {
  try {
    const guard = await requireApproved();
    if (guard.error) return guard.error;
    const { user } = guard;
    const supabase = await createClient();

    // ── 1. Check review queue ─────────────────────────────────────────────────
    const overdueCount = await getOverdueCount(user.id, supabase);

    if (overdueCount > 0) {
      const reviewProbability = overdueCount >= 10 ? 0.5 : 0.3;
      if (Math.random() < reviewProbability) {
        return NextResponse.json({ type: "review", overdueCount });
      }
    }

    // ── 2. Find next lesson concept ───────────────────────────────────────────
    const { data: progress } = await supabase
      .from("user_course_progress")
      .select("course_id, current_concept_id, domain")
      .eq("user_id", user.id)
      .eq("status", "in_progress")
      .limit(1)
      .single();

    if (!progress?.course_id) {
      return NextResponse.json({ type: "no_course", overdueCount });
    }

    const { data: course } = await supabase
      .from("courses")
      .select("structure")
      .eq("id", progress.course_id)
      .single();

    if (!course) return NextResponse.json({ type: "no_course", overdueCount });

    const allConceptIds: string[] = (course.structure?.modules ?? []).flatMap(
      (m: { lessons: Array<{ concept_ids: string[] }> }) =>
        m.lessons.flatMap((l) => l.concept_ids)
    );

    const { data: masteryRows } = await supabase
      .from("user_concept_mastery")
      .select("concept_id, mastery_score")
      .eq("user_id", user.id)
      .in("concept_id", allConceptIds);

    const masteryMap: Record<string, number> = {};
    (masteryRows ?? []).forEach((r: { concept_id: string; mastery_score: number }) => {
      masteryMap[r.concept_id] = r.mastery_score;
    });

    const nextConceptId = allConceptIds.find((id) => (masteryMap[id] ?? 0) < 0.7);

    if (!nextConceptId) {
      return NextResponse.json({ type: "done", courseId: progress.course_id, overdueCount });
    }

    return NextResponse.json({
      type:      "lesson",
      conceptId: nextConceptId,
      courseId:  progress.course_id,
      overdueCount,
    });
  } catch (err) {
    console.error("GET /api/learn/next error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
