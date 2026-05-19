/**
 * DELETE /api/admin/rag/chunks/[id]
 * Admin-only. Removes a single reference chunk.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient }       from "@/lib/supabase/server";
import { verifyAdmin }               from "@/lib/admin/auth";
import { logAdminAction }            from "@/lib/admin/audit";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const service = createServiceClient();

  const { data: before } = await service
    .from("reference_chunks")
    .select("domain, source_title")
    .eq("id", id)
    .single();

  const { error } = await service.from("reference_chunks").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction({
    actorId:    admin.id,
    actorEmail: admin.email,
    action:     "rag.chunk.delete",
    targetType: "chunk",
    targetId:   id,
    diff:       { before },
    request:    req,
  });

  return NextResponse.json({ ok: true });
}
