/**
 * GET /api/admin/lesson-cache
 *
 * Paginated browse of cached_lessons rows.
 * Query: ?concept_id=&status=&model=&page=&limit=
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient }       from "@/lib/supabase/server";
import { verifyAdmin }               from "@/lib/admin/auth";

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url        = new URL(req.url);
  const concept_id = url.searchParams.get("concept_id")?.trim() ?? "";
  const status     = url.searchParams.get("status")?.trim()     ?? "";
  const model      = url.searchParams.get("model")?.trim()      ?? "";
  const page       = Math.max(1, parseInt(url.searchParams.get("page")  ?? "1", 10));
  const limit      = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10)));
  const offset     = (page - 1) * limit;

  const service = createServiceClient();
  let q = service
    .from("cached_lessons")
    .select(
      "id, concept_id, profile_signature, generated_by_model, moderation_status, moderator_id, flagged_reason, generated_at, approved_at, usage_count, concepts!cached_lessons_concept_id_fkey(name, domain)",
      { count: "exact" }
    )
    .order("generated_at", { ascending: false });

  if (concept_id) q = q.eq("concept_id", concept_id);
  if (status)     q = q.eq("moderation_status", status);
  if (model)      q = q.eq("generated_by_model", model);

  const { data, count, error } = await q.range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    rows:  data ?? [],
    total: count ?? 0,
    page,
    limit,
  });
}
