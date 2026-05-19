// POST /api/profile/custom-teacher — persist an Avaturn GLB URL
// to learner_profiles.custom_teacher_glb_url

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { avatarUrl } = body as { avatarUrl?: string };

    if (!avatarUrl || !avatarUrl.startsWith("https://")) {
      return NextResponse.json({ error: "Invalid avatarUrl" }, { status: 400 });
    }

    const { error } = await supabase
      .from("learner_profiles")
      .upsert(
        { user_id: user.id, custom_teacher_glb_url: avatarUrl },
        { onConflict: "user_id" }
      );

    if (error) throw error;

    return NextResponse.json({ ok: true, avatarUrl });
  } catch (err) {
    console.error("POST /api/profile/custom-teacher:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
