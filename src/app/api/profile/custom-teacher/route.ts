// POST /api/profile/custom-teacher — persist an Avaturn GLB URL
// to learner_profiles.custom_teacher_glb_url
//
// The write uses the service client, always for the session user's own id: migration 024 stops end-user roles
// from setting this column directly, so this route (authentication, the child-safety switch, the host
// allow-list) is the only way to set it.

import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { refuseUnlessAllowed } from "@/lib/account/capabilityGuard";
import { isAllowedCustomTeacherUrl } from "@/lib/account/customTeacherUrl";
import { parseJsonBody } from "@/lib/guard/input";
import { z } from "zod";

const BodySchema = z.object({
  avatarUrl: z.string().max(2048).url().refine((u) => isAllowedCustomTeacherUrl(u)),
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

    const { error } = await createServiceClient()
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
