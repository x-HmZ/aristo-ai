/**
 * GET /api/admin/rag/chunks
 *
 * Lists reference_chunks with pagination + filtering. Admin-only.
 *
 * Query: ?domain=&page=1&limit=50&q=
 * Returns: { chunks, total, page, limit, domains }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient }       from "@/lib/supabase/server";
import { verifyAdmin }               from "@/lib/admin/auth";

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url    = new URL(req.url);
  const domain = url.searchParams.get("domain")?.trim() ?? "";
  const q      = url.searchParams.get("q")?.trim() ?? "";
  const page   = Math.max(1, parseInt(url.searchParams.get("page")  ?? "1", 10));
  const limit  = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10)));
  const offset = (page - 1) * limit;

  const service = createServiceClient();

  let query = service
    .from("reference_chunks")
    .select("id, domain, source_title, content, metadata, created_at", { count: "exact" })
    .order("created_at", { ascending: false });

  if (domain) query = query.eq("domain", domain);
  if (q)      query = query.ilike("content", `%${q}%`);

  const { data: chunks, count, error } = await query.range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also return distinct domains for the UI's domain picker
  const { data: distinctDomainsRaw } = await service
    .from("reference_chunks")
    .select("domain");
  const domains = Array.from(
    new Set(((distinctDomainsRaw ?? []) as Array<{ domain: string }>).map((r) => r.domain))
  ).sort();

  return NextResponse.json({
    chunks,
    total: count ?? 0,
    page,
    limit,
    domains,
  });
}
