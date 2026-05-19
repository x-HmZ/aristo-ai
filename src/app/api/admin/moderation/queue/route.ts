/**
 * GET /api/admin/moderation/queue
 *
 * Lists `cached_lessons` rows awaiting moderation. Sorted oldest-first so
 * admins clear the backlog FIFO.
 */

import { NextResponse }          from "next/server";
import { createServiceClient }   from "@/lib/supabase/server";
import { verifyAdmin }           from "@/lib/admin/auth";

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  const { data, error, count } = await service
    .from("cached_lessons")
    .select(
      "id, concept_id, profile_signature, generated_by_model, payload, flagged_reason, generated_at, concepts!cached_lessons_concept_id_fkey(name, domain)",
      { count: "exact" }
    )
    .eq("moderation_status", "pending")
    .order("generated_at", { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ rows: data ?? [], total: count ?? 0 });
}
