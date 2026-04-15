import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/courses
 * Returns all published courses for the student course picker.
 * Requires authentication (middleware protects /learn which calls this).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, description, topic_list")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  return NextResponse.json({ courses: courses ?? [] });
}
