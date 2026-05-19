// GET /api/profile — returns the learner's static + dynamic profile

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [profileRes, dynamicRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, goal, daily_time_minutes, is_admin, created_at")
        .eq("id", user.id)
        .single(),
      supabase
        .from("learner_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (profileRes.error) throw profileRes.error;

    return NextResponse.json({
      profile: profileRes.data,
      dynamic_profile: dynamicRes.data ?? null,
    });
  } catch (err) {
    console.error("[GET /api/profile]", err);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}
