/**
 * POST /api/courses/generate
 *
 * Generates a personalized course from the knowledge graph using the
 * CurriculumAgent (Claude Sonnet, spec §8.5), persists it, and returns
 * the full course including its structure.
 *
 * Body: { domain, goal? }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@/lib/supabase/server";
import { createServiceClient }       from "@/lib/supabase/server";
import { requireApproved }           from "@/lib/auth/approval";
import { generateCourse }            from "@/lib/agents/curriculum";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { domain, goal }: { domain: string; goal?: string } = await req.json();

    if (!domain) {
      return NextResponse.json({ error: "domain is required" }, { status: 400 });
    }

    const guard = await requireApproved();
    if (guard.error) return guard.error;
    const { user } = guard;
    const supabase = await createClient();

    // Get user's goal from profile if not provided
    let effectiveGoal: string = goal ?? "";
    if (!effectiveGoal) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("goal")
        .eq("id", user.id)
        .single();
      effectiveGoal = profile?.goal ?? "Learn from scratch";
    }

    // Generate the course structure via CurriculumAgent
    const generated = await generateCourse(domain, effectiveGoal, user.id, supabase);

    // Persist to DB (service client to bypass RLS — user-generated courses are
    // saved as unpublished; admins can publish them later)
    const service = createServiceClient();
    const { data: saved, error } = await service
      .from("courses")
      .insert({
        id:              generated.id,
        domain:          generated.domain,
        title:           generated.title,
        description:     generated.description,
        structure:       generated.structure,
        estimated_hours: generated.estimated_hours,
        is_published:    false,
      })
      .select("id, domain, title, description, structure, estimated_hours")
      .single();

    if (error) throw error;

    // Upsert user_course_progress row
    await supabase
      .from("user_course_progress")
      .upsert(
        {
          user_id:   user.id,
          domain,
          course_id: saved.id,
          status:    "in_progress",
        },
        { onConflict: "user_id,domain" }
      );

    return NextResponse.json({ course: saved });
  } catch (err) {
    console.error("POST /api/courses/generate error:", err);
    return NextResponse.json({ error: "Course generation failed" }, { status: 500 });
  }
}
