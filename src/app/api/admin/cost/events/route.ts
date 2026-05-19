/**
 * GET /api/admin/cost/events — paginated raw usage_events stream.
 * Query: ?from=&to=&user_id=&feature=&page=&limit=
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient }       from "@/lib/supabase/server";
import { verifyAdmin }               from "@/lib/admin/auth";

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url     = new URL(req.url);
  const from    = url.searchParams.get("from");
  const to      = url.searchParams.get("to");
  const user_id = url.searchParams.get("user_id");
  const feature = url.searchParams.get("feature");
  const page    = Math.max(1, parseInt(url.searchParams.get("page")  ?? "1", 10));
  const limit   = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10)));
  const offset  = (page - 1) * limit;

  const service = createServiceClient();
  let q = service
    .from("usage_events")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (from)    q = q.gte("created_at", from);
  if (to)      q = q.lte("created_at", to);
  if (user_id) q = q.eq("user_id", user_id);
  if (feature) q = q.eq("feature", feature);

  const { data, count, error } = await q.range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    events: data ?? [],
    total:  count ?? 0,
    page,
    limit,
  });
}
