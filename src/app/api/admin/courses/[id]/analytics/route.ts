/**
 * GET /api/admin/courses/[id]/analytics
 *
 * Returns:
 *   - enrolled, completed, in_progress, paused counts
 *   - completion %
 *   - module dropoff (where do learners stall?)
 *   - mastery distribution histogram across the course's concepts
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient }       from "@/lib/supabase/server";
import { verifyAdmin }               from "@/lib/admin/auth";

interface Lesson { id: string; title: string; concept_ids: string[] }
interface Module { id: string; title: string; description: string; lessons: Lesson[] }
interface Structure { modules: Module[] }

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const service = createServiceClient();

  const { data: course } = await service
    .from("courses")
    .select("id, domain, title, structure, is_published, created_at")
    .eq("id", id)
    .single();

  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const structure = (course.structure ?? { modules: [] }) as Structure;
  const allConceptIds = structure.modules.flatMap((m) => m.lessons.flatMap((l) => l.concept_ids));

  const [
    { data: progress },
    { data: masteryRows },
  ] = await Promise.all([
    service.from("user_course_progress")
      .select("user_id, status, current_module_id, current_lesson_id, current_concept_id, started_at, last_activity")
      .eq("course_id", id),
    service.from("user_concept_mastery")
      .select("user_id, concept_id, mastery_score")
      .in("concept_id", allConceptIds.length ? allConceptIds : ["__none__"]),
  ]);

  const progressRows = (progress ?? []) as Array<{
    user_id: string; status: string; current_module_id: string | null;
    current_lesson_id: string | null; current_concept_id: string | null;
    started_at: string; last_activity: string;
  }>;
  const mastery = (masteryRows ?? []) as Array<{
    user_id: string; concept_id: string; mastery_score: number;
  }>;

  // ── Status counts ──────────────────────────────────────────────────────────
  const status_counts = {
    in_progress: 0,
    completed:   0,
    paused:      0,
  };
  for (const p of progressRows) {
    if (p.status === "in_progress") status_counts.in_progress++;
    else if (p.status === "completed") status_counts.completed++;
    else if (p.status === "paused")    status_counts.paused++;
  }
  const enrolled = progressRows.length;
  const completion_pct = enrolled > 0
    ? +((status_counts.completed / enrolled) * 100).toFixed(1)
    : 0;

  // ── Module dropoff (count of learners stalled at each module) ──────────────
  const moduleDropoff = structure.modules.map((m) => ({
    module_id:    m.id,
    module_title: m.title,
    stalled:      progressRows.filter(
      (p) => p.current_module_id === m.id && p.status !== "completed"
    ).length,
  }));

  // ── Mastery distribution across the course's concepts ──────────────────────
  // Bucket mastery into 10 bins of 0.1
  const masteryBuckets = Array.from({ length: 10 }, (_, i) => ({
    bucket: `${(i / 10).toFixed(1)}–${((i + 1) / 10).toFixed(1)}`,
    min:    i / 10,
    max:    (i + 1) / 10,
    count:  0,
  }));
  for (const m of mastery) {
    const idx = Math.min(9, Math.max(0, Math.floor(m.mastery_score * 10)));
    masteryBuckets[idx].count++;
  }

  // Average mastery per concept (for the lesson-level dropoff visual)
  const perConcept = new Map<string, { sum: number; n: number }>();
  for (const m of mastery) {
    const cur = perConcept.get(m.concept_id) ?? { sum: 0, n: 0 };
    cur.sum += m.mastery_score;
    cur.n++;
    perConcept.set(m.concept_id, cur);
  }
  const conceptStats = Array.from(perConcept.entries()).map(([cid, { sum, n }]) => ({
    concept_id:   cid,
    avg_mastery:  +((sum / n) * 100).toFixed(1),
    learner_count: n,
  }));

  return NextResponse.json({
    course: {
      id:           course.id,
      domain:       course.domain,
      title:        course.title,
      is_published: course.is_published,
      created_at:   course.created_at,
    },
    enrolled,
    status_counts,
    completion_pct,
    moduleDropoff,
    masteryDistribution: masteryBuckets,
    conceptStats:        conceptStats.sort((a, b) => a.avg_mastery - b.avg_mastery),
  });
}
