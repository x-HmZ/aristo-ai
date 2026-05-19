/**
 * GET /api/admin/audit-log
 *
 * Paginated reader for admin_audit_log.
 * Query: ?actor=&action=&target_type=&from=&to=&page=&limit=
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient }       from "@/lib/supabase/server";
import { verifyAdmin }               from "@/lib/admin/auth";

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url    = new URL(req.url);
  const actor       = url.searchParams.get("actor")?.trim()       ?? "";
  const action      = url.searchParams.get("action")?.trim()      ?? "";
  const target_type = url.searchParams.get("target_type")?.trim() ?? "";
  const from        = url.searchParams.get("from");
  const to          = url.searchParams.get("to");
  const page        = Math.max(1, parseInt(url.searchParams.get("page")  ?? "1", 10));
  const limit       = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10)));
  const offset      = (page - 1) * limit;

  const service = createServiceClient();
  let q = service
    .from("admin_audit_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (actor)       q = q.ilike("actor_email", `%${actor}%`);
  if (action)      q = q.eq("action", action);
  if (target_type) q = q.eq("target_type", target_type);
  if (from)        q = q.gte("created_at", from);
  if (to)          q = q.lte("created_at", to);

  const { data, count, error } = await q.range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Distinct actions/target_types for filter dropdowns
  const { data: distinctActions }  = await service.from("admin_audit_log").select("action");
  const { data: distinctTargets }  = await service.from("admin_audit_log").select("target_type");

  return NextResponse.json({
    entries: data ?? [],
    total:   count ?? 0,
    page,
    limit,
    actions:      Array.from(new Set(((distinctActions  ?? []) as Array<{ action: string }>).map((r) => r.action))).sort(),
    target_types: Array.from(new Set(((distinctTargets ?? []) as Array<{ target_type: string | null }>).map((r) => r.target_type).filter(Boolean))) as string[],
  });
}
