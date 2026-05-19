/**
 * POST /api/admin/lesson-cache/[id]/regenerate
 *
 * Deletes the cached row. The next learner request with the same
 * (concept_id, profile_signature) will trigger a fresh TeachingAgent run
 * and re-populate the cache.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient }       from "@/lib/supabase/server";
import { verifyAdmin }               from "@/lib/admin/auth";
import { logAdminAction }            from "@/lib/admin/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const service = createServiceClient();

  const { data: before } = await service
    .from("cached_lessons")
    .select("concept_id, profile_signature")
    .eq("id", id)
    .single();

  const { error } = await service.from("cached_lessons").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction({
    actorId:    admin.id,
    actorEmail: admin.email,
    action:     "lesson_cache.regenerate",
    targetType: "cached_lesson",
    targetId:   id,
    diff:       { before },
    request:    req,
  });

  return NextResponse.json({ ok: true });
}
