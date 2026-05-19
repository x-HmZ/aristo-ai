/**
 * POST /api/admin/lesson-cache/bulk-invalidate
 *
 * Wipes a batch of cached rows. Useful after editing a concept's
 * description / objectives / misconceptions — old payloads are stale.
 *
 * Body: { concept_id?: string; domain?: string }
 *   - concept_id  → wipe all signatures for that concept
 *   - domain      → wipe everything for the domain
 *   - neither     → 400
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient }       from "@/lib/supabase/server";
import { verifyAdmin }               from "@/lib/admin/auth";
import { logAdminAction }            from "@/lib/admin/audit";

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body       = await req.json().catch(() => ({}));
  const concept_id = body?.concept_id as string | undefined;
  const domain     = body?.domain     as string | undefined;

  if (!concept_id && !domain) {
    return NextResponse.json(
      { error: "Provide concept_id or domain" },
      { status: 400 }
    );
  }

  const service = createServiceClient();

  let deleted = 0;
  if (concept_id) {
    const { count, error } = await service
      .from("cached_lessons")
      .delete({ count: "exact" })
      .eq("concept_id", concept_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    deleted = count ?? 0;
  } else if (domain) {
    // Resolve concept IDs in the domain, then delete by FK
    const { data: concepts } = await service
      .from("concepts")
      .select("id")
      .eq("domain", domain);
    const ids = (concepts ?? []).map((c: { id: string }) => c.id);
    if (ids.length > 0) {
      const { count, error } = await service
        .from("cached_lessons")
        .delete({ count: "exact" })
        .in("concept_id", ids);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      deleted = count ?? 0;
    }
  }

  await logAdminAction({
    actorId:    admin.id,
    actorEmail: admin.email,
    action:     "lesson_cache.bulk_invalidate",
    targetType: concept_id ? "concept" : "domain",
    targetId:   concept_id ?? domain ?? null,
    diff:       { params: { concept_id, domain, deleted } },
    request:    req,
  });

  return NextResponse.json({ deleted });
}
