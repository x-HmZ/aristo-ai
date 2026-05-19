/**
 * GET /api/courses/:id
 *
 * Returns the full course structure (modules/lessons/concept_ids).
 * Also merges the user's mastery scores so the frontend can colour
 * each concept node.
 */

import { NextRequest, NextResponse }          from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use service client so both published and user-generated (unpublished) courses
    // are accessible — auth is already verified above.
    const service = createServiceClient();
    const { data: course, error } = await service
      .from("courses")
      .select("id, domain, title, description, structure, estimated_hours")
      .eq("id", id)
      .single();

    if (error || !course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Collect all concept IDs in this course
    const allConceptIds: string[] = (course.structure?.modules ?? []).flatMap(
      (m: { lessons: Array<{ concept_ids: string[] }> }) =>
        m.lessons.flatMap((l) => l.concept_ids)
    );

    // Load user mastery for those concepts
    const { data: masteryRows } = await supabase
      .from("user_concept_mastery")
      .select("concept_id, mastery_score")
      .eq("user_id", user.id)
      .in("concept_id", allConceptIds);

    const masteryMap: Record<string, number> = {};
    (masteryRows ?? []).forEach((r: { concept_id: string; mastery_score: number }) => {
      masteryMap[r.concept_id] = r.mastery_score;
    });

    // Load concept names for the map
    const { data: conceptRows } = await supabase
      .from("concepts")
      .select("id, name, difficulty")
      .in("id", allConceptIds);

    const conceptMeta: Record<string, { name: string; difficulty: number }> = {};
    (conceptRows ?? []).forEach((c: { id: string; name: string; difficulty: number }) => {
      conceptMeta[c.id] = { name: c.name, difficulty: c.difficulty };
    });

    return NextResponse.json({ course, masteryMap, conceptMeta });
  } catch (err) {
    console.error("GET /api/courses/:id error:", err);
    return NextResponse.json({ error: "Failed to load course" }, { status: 500 });
  }
}
