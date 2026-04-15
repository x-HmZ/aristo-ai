import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function verifyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  return profile?.is_admin ? user : null;
}

// ─── GET — list all courses ───────────────────────────────────────────────────

export async function GET() {
  const user = await verifyAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  const { data: courses, error } = await service
    .from("courses")
    .select("*, curricula(title, source_type)")
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
    title,
    description,
    topics,
    source_type = "manual",
    is_published = false,
  } = body;

  if (!title || !topics?.length) {
    return NextResponse.json(
      { error: "Title and topics are required" },
      { status: 400 }
    );
  }

  const service = createServiceClient();

  // Create parent curriculum record
  const { data: curriculum, error: currErr } = await service
    .from("curricula")
    .insert({ title, description, source_type, created_by: user.id })
    .select("id")
    .single();

  if (currErr)
    return NextResponse.json({ error: currErr.message }, { status: 500 });

  // Create course linked to curriculum
  const { data: course, error: courseErr } = await service
    .from("courses")
    .insert({
      curriculum_id: curriculum.id,
      title,
      description,
      topic_list: topics,
      is_published,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (courseErr)
    return NextResponse.json({ error: courseErr.message }, { status: 500 });

  return NextResponse.json({ course });
}

// ─── PATCH — update course (publish/unpublish, edit topics/title) ─────────────

export async function PATCH(req: NextRequest) {
  const user = await verifyAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  // Allowlist safe fields only
  const allowed = ["title", "description", "topic_list", "is_published"];
  const sanitized = Object.fromEntries(
    Object.entries(updates).filter(([k]) => allowed.includes(k))
  );

  const service = createServiceClient();
  const { error } = await service
    .from("courses")
    .update({ ...sanitized, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// ─── DELETE — remove course (and its parent curriculum) ──────────────────────

export async function DELETE(req: NextRequest) {
  const user = await verifyAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const service = createServiceClient();

  // Fetch curriculum_id so we can clean up the parent too
  const { data: course } = await service
    .from("courses")
    .select("curriculum_id")
    .eq("id", id)
    .single();

  const { error } = await service.from("courses").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Clean up orphaned curriculum record if present
  if (course?.curriculum_id) {
    await service
      .from("curricula")
      .delete()
      .eq("id", course.curriculum_id);
  }

  return NextResponse.json({ success: true });
}
