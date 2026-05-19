/**
 * PATCH /api/admin/moderation/[id]
 *
 * Approve or reject a pending cached lesson.
 * Body: { status: "approved" | "rejected", notes?: string }
 *
 * - approved → row is now served to learners with the same signature
 * - rejected → row is deleted entirely so the next learner request will
 *              regenerate (and re-decide moderation). Notes are preserved
 *              in admin_audit_log.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient }       from "@/lib/supabase/server";
import { verifyAdmin }               from "@/lib/admin/auth";
import { logAdminAction }            from "@/lib/admin/audit";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body   = await req.json().catch(() => ({}));
  const status = body?.status as "approved" | "rejected" | undefined;
  const notes  = body?.notes  as string | undefined;

  if (status !== "approved" && status !== "rejected") {
    return NextResponse.json(
      { error: "status must be 'approved' or 'rejected'" },
      { status: 400 }
    );
  }

  const service = createServiceClient();

  const { data: before } = await service
    .from("cached_lessons")
    .select("concept_id, profile_signature, moderation_status, flagged_reason")
    .eq("id", id)
    .single();

  if (status === "approved") {
    const { error } = await service
      .from("cached_lessons")
      .update({
        moderation_status: "approved",
        moderator_id:      admin.id,
        moderator_notes:   notes ?? null,
        approved_at:       new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    // Rejected → delete the row so the next learner request regenerates.
    const { error } = await service.from("cached_lessons").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAdminAction({
    actorId:    admin.id,
    actorEmail: admin.email,
    action:     status === "approved" ? "lesson_cache.approve" : "lesson_cache.reject",
    targetType: "cached_lesson",
    targetId:   id,
    diff:       { before, after: { status }, notes: notes ?? null },
    request:    req,
  });

  return NextResponse.json({ ok: true });
}
