/**
 * PATCH  /api/admin/kg/concept/[id]   partial update
 * DELETE /api/admin/kg/concept/[id]   removes the concept (FK cascade)
 *
 * Admin-only, audit-logged. Whitelists writable fields to prevent
 * arbitrary column injection.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient }       from "@/lib/supabase/server";
import { verifyAdmin }               from "@/lib/admin/auth";
import { logAdminAction }            from "@/lib/admin/audit";

const WRITABLE = new Set([
  "name",
  "description",
  "difficulty",
  "bloom_level",
  "estimated_minutes",
  "key_terms",
  "learning_objectives",
  "common_misconceptions",
  "tags",
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body   = await req.json().catch(() => ({}));

  const sanitized = Object.fromEntries(
    Object.entries(body).filter(([k]) => WRITABLE.has(k))
  );

  if (Object.keys(sanitized).length === 0) {
    return NextResponse.json(
      { error: "No writable fields provided" },
      { status: 400 }
    );
  }

  const service = createServiceClient();
  const { data: before } = await service
    .from("concepts")
    .select("name, description, difficulty, bloom_level, estimated_minutes")
    .eq("id", id)
    .single();

  const { data: after, error } = await service
    .from("concepts")
    .update(sanitized)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction({
    actorId:    admin.id,
    actorEmail: admin.email,
    action:     "concept.update",
    targetType: "concept",
    targetId:   id,
    diff:       { before, after: sanitized },
    request:    req,
  });

  return NextResponse.json({ concept: after });
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
    .from("concepts")
    .select("name, domain")
    .eq("id", id)
    .single();

  // Edges and dependent mastery rows cascade via FK ON DELETE CASCADE.
  const { error } = await service.from("concepts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction({
    actorId:    admin.id,
    actorEmail: admin.email,
    action:     "concept.delete",
    targetType: "concept",
    targetId:   id,
    diff:       { before },
    request:    req,
  });

  return NextResponse.json({ ok: true });
}
