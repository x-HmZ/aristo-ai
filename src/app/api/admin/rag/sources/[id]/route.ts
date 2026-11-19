/**
 * PATCH  /api/admin/rag/sources/[id]  - finish or fail an ingestion
 * DELETE /api/admin/rag/sources/[id]  - delete the source and all its chunks
 *
 * PATCH body: { action: "complete" | "fail", error? }
 *  complete: checks that chunks were stored, records the chunk count and
 *            marks the source ready. The token count is informational and
 *            comes from the per-batch estimates the client summed.
 */

import { revalidatePath }           from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { z }                         from "zod";
import { createServiceClient }       from "@/lib/supabase/server";
import { verifyAdmin }               from "@/lib/admin/auth";
import { logAdminAction }            from "@/lib/admin/audit";

const patchSchema = z.object({
  action:     z.enum(["complete", "fail"]),
  error:      z.string().max(1000).optional(),
  tokenCount: z.number().int().min(0).max(100_000_000).optional(),
});

const idSchema = z.string().uuid();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const body = patchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const service = createServiceClient();
  const { data: source } = await service
    .from("reference_sources")
    .select("id, status, batch_count")
    .eq("id", id)
    .maybeSingle();
  if (!source) return NextResponse.json({ error: "Source not found" }, { status: 404 });
  if (source.status !== "ingesting") {
    return NextResponse.json({ error: `Source is ${source.status}, not ingesting.` }, { status: 409 });
  }

  if (body.data.action === "fail") {
    await service
      .from("reference_sources")
      .update({ status: "failed", error: body.data.error ?? "Ingestion failed", updated_at: new Date().toISOString() })
      .eq("id", id);
    return NextResponse.json({ ok: true, status: "failed" });
  }

  const { count, error: countErr } = await service
    .from("reference_chunks")
    .select("id", { count: "exact", head: true })
    .eq("source_id", id);
  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });

  const chunks = count ?? 0;
  if (chunks === 0 || chunks < source.batch_count) {
    return NextResponse.json(
      { error: `Only ${chunks} chunks are stored for ${source.batch_count} batches. Re-send the missing batches.` },
      { status: 409 },
    );
  }

  const { error } = await service
    .from("reference_sources")
    .update({
      status:      "ready",
      error:       null,
      chunk_count: chunks,
      token_count: body.data.tokenCount ?? 0,
      updated_at:  new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction({
    actorId:    admin.id,
    actorEmail: admin.email,
    action:     "rag.source.ready",
    targetType: "source",
    targetId:   id,
    diff:       { params: { chunks, tokens: body.data.tokenCount ?? 0 } },
    request:    req,
  });

  revalidatePath("/credits");   // /credits is cached for an hour; a new ready source must show at once
  return NextResponse.json({ ok: true, status: "ready", chunks });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const service = createServiceClient();
  const { data: before } = await service
    .from("reference_sources")
    .select("title, domain, chunk_count, status")
    .eq("id", id)
    .maybeSingle();
  if (!before) return NextResponse.json({ error: "Source not found" }, { status: 404 });

  // reference_chunks.source_id is ON DELETE CASCADE.
  const { error } = await service.from("reference_sources").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction({
    actorId:    admin.id,
    actorEmail: admin.email,
    action:     "rag.source.delete",
    targetType: "source",
    targetId:   id,
    diff:       { before },
    request:    req,
  });

  revalidatePath("/credits");
  return NextResponse.json({ ok: true });
}
