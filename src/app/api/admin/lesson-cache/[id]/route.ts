/**
 * GET    /api/admin/lesson-cache/[id]   full cached row incl. payload
 * DELETE /api/admin/lesson-cache/[id]   remove the cache row entirely
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient }       from "@/lib/supabase/server";
import { verifyAdmin }               from "@/lib/admin/auth";
import { logAdminAction }            from "@/lib/admin/audit";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const service = createServiceClient();
  const { data, error } = await service
    .from("cached_lessons")
    .select("*, concepts!cached_lessons_concept_id_fkey(name, domain)")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ row: data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const service = createServiceClient();

  const { data: before } = await service
    .from("cached_lessons")
    .select("concept_id, profile_signature, moderation_status")
    .eq("id", id)
    .single();

  const { error } = await service.from("cached_lessons").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction({
    actorId:    admin.id,
    actorEmail: admin.email,
    action:     "lesson_cache.delete",
    targetType: "cached_lesson",
    targetId:   id,
    diff:       { before },
    request:    req,
  });

  return NextResponse.json({ ok: true });
}
