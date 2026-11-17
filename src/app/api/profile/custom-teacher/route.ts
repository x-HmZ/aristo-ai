// POST /api/profile/custom-teacher — persist an Avaturn GLB URL
// to learner_profiles.custom_teacher_glb_url

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { refuseUnlessAllowed } from "@/lib/account/capabilityGuard";
import { parseJsonBody } from "@/lib/guard/input";
import { z } from "zod";

const BodySchema = z.object({
  avatarUrl: z.string().max(2048).url().refine((u) => u.startsWith("https://")),
}).strict();

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // The custom (selfie) teacher is off for a guardian-held (child) account until the guardian turns it on.
    const off = await refuseUnlessAllowed(user.id, "customTeacher");
    if (off) return off;

    const parsed = await parseJsonBody(request, BodySchema);
    if (!parsed.ok) return parsed.response;
    const { avatarUrl } = parsed.data;

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
