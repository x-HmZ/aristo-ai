/**
 * Admin courses CRUD  —  /api/admin/courses
 *
 * Updated for the Phase 5 schema: `structure jsonb` replaces
 * `topic_list` and `curriculum_id`.
 *
 * Auth: shared verifyAdmin() in src/lib/admin/auth.ts.
 * Audit: every mutation logs to admin_audit_log via logAdminAction().
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient }       from "@/lib/supabase/server";
import { verifyAdmin }               from "@/lib/admin/auth";
import { logAdminAction }            from "@/lib/admin/audit";

// ─── GET — list all courses ───────────────────────────────────────────────────

export async function GET() {
  const user = await verifyAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  const { data: courses, error } = await service
    .from("courses")
    .select("id, domain, title, description, structure, estimated_hours, is_published, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ courses });
}

// ─── POST — create course ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await verifyAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const {
    id,
    domain,
    title,
    description,
    structure,
    estimated_hours,
    is_published = false,
  } = body;

  if (!title || !domain || !structure) {
    return NextResponse.json(
      { error: "title, domain, and structure are required" },
      { status: 400 }
    );
  }

  const courseId = id ?? `course_${domain}_${Date.now()}`;
  const service  = createServiceClient();
  const { data: course, error } = await service
    .from("courses")
    .insert({
      id:              courseId,
      domain,
      title,
      description,
      structure,
      estimated_hours,
      is_published,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction({
    actorId:    user.id,
    actorEmail: user.email,
    action:     "course.create",
    targetType: "course",
    targetId:   courseId,
    diff:       { params: { domain, title, is_published, estimated_hours } },
    request:    req,
  });

  return NextResponse.json({ course });
}

// ─── PATCH — update course ────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const user = await verifyAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const allowed = ["title", "description", "structure", "estimated_hours", "is_published"];
  const sanitized = Object.fromEntries(
    Object.entries(updates).filter(([k]) => allowed.includes(k))
  );

  const service = createServiceClient();

  // Capture before-state for audit diff
  const { data: before } = await service
    .from("courses")
    .select("title, description, structure, estimated_hours, is_published")
    .eq("id", id)
    .single();

  const { error } = await service
    .from("courses")
    .update(sanitized)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Specialize the action name when toggling publish state for easier filtering
  const action =
    "is_published" in sanitized && before && before.is_published !== sanitized.is_published
      ? sanitized.is_published ? "course.publish" : "course.unpublish"
      : "course.update";

  await logAdminAction({
    actorId:    user.id,
    actorEmail: user.email,
    action,
    targetType: "course",
    targetId:   id,
    diff:       { before, after: sanitized },
    request:    req,
  });

  return NextResponse.json({ success: true });
}

// ─── DELETE — remove course ───────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const user = await verifyAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const service = createServiceClient();
  const { data: before } = await service
    .from("courses")
    .select("title, domain, is_published")
    .eq("id", id)
    .single();

  const { error } = await service.from("courses").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction({
    actorId:    user.id,
    actorEmail: user.email,
    action:     "course.delete",
    targetType: "course",
    targetId:   id,
    diff:       { before },
    request:    req,
  });

  return NextResponse.json({ success: true });
}
