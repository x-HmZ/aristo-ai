/**
 * GET /api/courses
 *
 * Returns all published courses for the course picker.
 * Each course includes its structure so the client can count concepts
 * and flatten into a topic list without a second fetch.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: courses } = await supabase
    .from("courses")
    .select("id, domain, title, description, structure, estimated_hours")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  return NextResponse.json({ courses: courses ?? [] });
}
