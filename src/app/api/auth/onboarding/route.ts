// POST /api/auth/onboarding
// Saves the 3-question onboarding answers and creates the initial
// learner_profile + user_course_progress rows.
//
// Body: { goal, daily_time_minutes, domain }
//   goal: "learn_from_scratch" | "fill_gaps" | "exam_prep" | "refresher"
//   daily_time_minutes: 10 | 20 | 45 | 60
//   domain: "python_programming" (or any seeded domain)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

import { isOfferedDomain, onboardingBodySchema, subjectsFromCourses, type Subject } from "@/lib/onboarding/subjects";

const VALID_GOALS = ["learn_from_scratch", "fill_gaps", "exam_prep", "refresher"] as const;

async function loadSubjects(supabase: Awaited<ReturnType<typeof createClient>>): Promise<Subject[]> {
  const { data } = await supabase
    .from("courses")
    .select("domain, title, structure")
    .eq("is_published", true)
    .order("created_at", { ascending: false });
  return subjectsFromCourses(data ?? []);
}

// GET /api/auth/onboarding: the subjects a learner can pick (published courses).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ subjects: await loadSubjects(supabase) });
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsedBody = onboardingBodySchema.safeParse(await req.json().catch(() => null));
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: `goal must be one of: ${VALID_GOALS.join(", ")}; domain is required` },
        { status: 400 }
      );
    }
    const { goal, domain, daily_time_minutes: timeMinutes } = parsedBody.data;

    // Only subjects with published content can be chosen.
    const subjects = await loadSubjects(supabase);
    if (!isOfferedDomain(domain, subjects)) {
      return NextResponse.json({ error: "That subject is not available." }, { status: 400 });
    }

    // Update static profile
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ goal, daily_time_minutes: timeMinutes })
      .eq("id", user.id);

    if (profileError) throw profileError;

    // Ensure learner_profile row exists (trigger may have created it already)
    const { error: lpError } = await supabase
      .from("learner_profiles")
      .upsert({ user_id: user.id }, { onConflict: "user_id" });

    if (lpError) throw lpError;

    // Create initial course progress row for this domain
    const { error: cpError } = await supabase
      .from("user_course_progress")
      .upsert(
        { user_id: user.id, domain, status: "in_progress", last_activity: new Date().toISOString() },
        { onConflict: "user_id,domain" }
      );

    if (cpError) throw cpError;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/auth/onboarding]", err);
    return NextResponse.json({ error: "Onboarding failed" }, { status: 500 });
  }
}
