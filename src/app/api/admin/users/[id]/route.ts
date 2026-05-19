/**
 * GET    /api/admin/users/[id]    deep profile dump
 * PATCH  /api/admin/users/[id]    body: { is_admin?, reset_mastery? }
 * DELETE /api/admin/users/[id]    cascade-deletes the user
 *
 * All admin-only and audit-logged.
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

  const [
    { data: profile },
    { data: learnerProfile },
    { data: mastery },
    { data: misconceptions },
    { data: sessions },
    { data: quizzes },
    { data: authUser },
  ] = await Promise.all([
    service.from("profiles")
      .select("id, full_name, goal, daily_time_minutes, is_admin, created_at, updated_at")
      .eq("id", id).single(),
    service.from("learner_profiles")
      .select("*").eq("user_id", id).single(),
    service.from("user_concept_mastery")
      .select("concept_id, mastery_score, assessment_count, last_assessed, srs_interval_days, srs_next_review, srs_stability, srs_difficulty, srs_consecutive_correct, srs_lapses, concepts!user_concept_mastery_concept_id_fkey(name, domain, bloom_level, difficulty)")
      .eq("user_id", id)
      .order("mastery_score", { ascending: false })
      .limit(200),
    service.from("user_misconceptions")
      .select("id, concept_id, misconception, occurrence_count, first_detected, last_detected, resolved, concepts!user_misconceptions_concept_id_fkey(name)")
      .eq("user_id", id)
      .order("occurrence_count", { ascending: false })
      .limit(50),
    service.from("session_logs")
      .select("*")
      .eq("user_id", id)
      .order("session_start", { ascending: false })
      .limit(20),
    service.from("quiz_attempts")
      .select("id, concept_id, bloom_level, question_type, is_correct, score, response_time_seconds, misconception_detected, context, created_at, concepts!quiz_attempts_concept_id_fkey(name)")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    service.auth.admin.getUserById(id),
  ]);

  if (!profile) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    profile: {
      ...profile,
      email: authUser?.user?.email ?? null,
    },
    learnerProfile: learnerProfile ?? null,
    mastery:        mastery ?? [],
    misconceptions: misconceptions ?? [],
    sessions:       sessions ?? [],
    quizzes:        quizzes ?? [],
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (admin.id === (await params).id) {
    return NextResponse.json(
      { error: "Refusing to modify your own admin account from this endpoint" },
      { status: 400 }
    );
  }

  const { id } = await params;
  const body   = await req.json().catch(() => ({}));
  const { is_admin, reset_mastery } = body as {
    is_admin?: boolean;
    reset_mastery?: boolean;
  };

  const service = createServiceClient();

  // Capture before-state for diff
  const { data: before } = await service
    .from("profiles")
    .select("is_admin, full_name")
    .eq("id", id)
    .single();

  if (typeof is_admin === "boolean") {
    const { error } = await service
      .from("profiles")
      .update({ is_admin })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logAdminAction({
      actorId:    admin.id,
      actorEmail: admin.email,
      action:     is_admin ? "user.promote_admin" : "user.demote_admin",
      targetType: "user",
      targetId:   id,
      diff:       { before: { is_admin: before?.is_admin }, after: { is_admin } },
      request:    req,
    });
  }

  if (reset_mastery) {
    const { error: e1 } = await service.from("user_concept_mastery").delete().eq("user_id", id);
    const { error: e2 } = await service.from("user_misconceptions").delete().eq("user_id", id);
    if (e1 || e2) {
      return NextResponse.json(
        { error: e1?.message ?? e2?.message ?? "Mastery reset failed" },
        { status: 500 }
      );
    }
    await logAdminAction({
      actorId:    admin.id,
      actorEmail: admin.email,
      action:     "user.reset_mastery",
      targetType: "user",
      targetId:   id,
      diff:       { params: { reset_mastery: true } },
      request:    req,
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (admin.id === id) {
    return NextResponse.json(
      { error: "You cannot delete your own account" },
      { status: 400 }
    );
  }

  const service = createServiceClient();
  const { data: before } = await service
    .from("profiles")
    .select("full_name")
    .eq("id", id)
    .single();

  // Delete the auth user — the profiles FK cascade will remove the row
  // in public.profiles, and the cascading FKs on profiles will remove
  // learner_profiles, user_concept_mastery, user_misconceptions,
  // session_logs, quiz_attempts, and user_course_progress.
  const { error } = await service.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction({
    actorId:    admin.id,
    actorEmail: admin.email,
    action:     "user.delete",
    targetType: "user",
    targetId:   id,
    diff:       { before: { full_name: before?.full_name ?? null } },
    request:    req,
  });

  return NextResponse.json({ ok: true });
}
