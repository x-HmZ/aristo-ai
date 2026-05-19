/**
 * PATCH /api/admin/misconceptions/[id]
 *
 * Mark a single user_misconception as resolved/unresolved, OR bulk-update
 * a comma-separated list of IDs via id="bulk" + body.ids[].
 *
 * Body: { resolved: boolean, ids?: string[] }
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

  const { id }    = await params;
  const body      = await req.json().catch(() => ({}));
  const resolved  = body?.resolved as boolean | undefined;
  const ids       = Array.isArray(body?.ids) ? (body.ids as string[]) : null;

  if (typeof resolved !== "boolean") {
    return NextResponse.json({ error: "resolved boolean required" }, { status: 400 });
  }

  const service = createServiceClient();
  const targetIds = id === "bulk" && ids ? ids : [id];

  const { error } = await service
    .from("user_misconceptions")
    .update({
      resolved,
      resolved_at: resolved ? new Date().toISOString() : null,
    })
    .in("id", targetIds);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction({
    actorId:    admin.id,
    actorEmail: admin.email,
    action:     resolved ? "misconception.resolve" : "misconception.reopen",
    targetType: "misconception",
    targetId:   targetIds.length === 1 ? targetIds[0] : "bulk",
    diff:       { params: { resolved, count: targetIds.length } },
    request:    req,
  });

  return NextResponse.json({ ok: true, updated: targetIds.length });
}
