/**
 * GET  /api/admin/rag/sources  - list every reference source (any status)
 * POST /api/admin/rag/sources  - register a source before its batches are sent
 *
 * POST body is validated by createSourceSchema. It checks the licence
 * allow-list and refuses a content hash that is already held by a live
 * source. With dryRun: true it runs those checks and stores nothing.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient }       from "@/lib/supabase/server";
import { verifyAdmin }               from "@/lib/admin/auth";
import { logAdminAction }            from "@/lib/admin/audit";
import { checkLicence }              from "@/lib/rag/licences";
import { createSourceSchema, findDuplicate } from "@/lib/rag/sources";

const COLUMNS =
  "id, title, publisher, licence_id, licence_url, attribution_text, source_url, domain, grade_min, grade_max, status, error, batch_count, chunk_count, token_count, created_at, updated_at, outline";

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("reference_sources")
    .select(COLUMNS)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sources: data ?? [] });
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const raw = await req.json().catch(() => null);
  const parsed = createSourceSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid source details", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const licence = checkLicence({
    licenceId:       input.licenceId,
    licenceUrl:      input.licenceUrl,
    attributionText: input.attributionText,
  });
  if (!licence.ok) return NextResponse.json({ error: licence.reason }, { status: 422 });

  const service = createServiceClient();

  const { data: sameHash, error: dupErr } = await service
    .from("reference_sources")
    .select("id, title, status, content_hash")
    .eq("content_hash", input.contentHash);
  if (dupErr) return NextResponse.json({ error: dupErr.message }, { status: 500 });
  const dup = findDuplicate(input.contentHash, sameHash ?? []);
  if (dup) {
    return NextResponse.json(
      { error: `This text is already ingested as "${dup.title}" (${dup.status}). Delete that source first to re-ingest it.`, existingId: dup.id },
      { status: 409 },
    );
  }

  if (input.dryRun) {
    return NextResponse.json({ ok: true, dryRun: true, warning: licence.warning ?? null });
  }

  const { data: row, error } = await service
    .from("reference_sources")
    .insert({
      title:            input.title,
      publisher:        input.publisher,
      licence_id:       input.licenceId,
      licence_url:      input.licenceUrl || null,
      attribution_text: input.attributionText || null,
      source_url:       input.sourceUrl || null,
      content_hash:     input.contentHash,
      domain:           input.domain,
      grade_min:        input.gradeMin ?? null,
      grade_max:        input.gradeMax ?? null,
      outline:          input.outline,
      status:           "ingesting",
      batch_count:      input.batchCount,
      created_by:       admin.id,
    })
    .select("id")
    .single();

  if (error) {
    // The unique index on live hashes also guards against a race.
    if (error.code === "23505") {
      return NextResponse.json({ error: "This text is already ingested." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAdminAction({
    actorId:    admin.id,
    actorEmail: admin.email,
    action:     "rag.source.create",
    targetType: "source",
    targetId:   row.id,
    diff:       { params: { title: input.title, domain: input.domain, licence: input.licenceId, batches: input.batchCount } },
    request:    req,
  });

  return NextResponse.json({ ok: true, id: row.id, warning: licence.warning ?? null });
}
