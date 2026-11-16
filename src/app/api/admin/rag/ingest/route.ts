/**
 * POST /api/admin/rag/ingest
 *
 * Ingests ONE batch of extracted page text for a registered source:
 * chunks it, embeds it and stores the chunks. A batch is identified by
 * (sourceId, batchIndex); sending it again replaces the chunks that batch
 * wrote, so retrying is always safe.
 *
 * With dryRun: true it chunks and prices the batch (chunk count, tokens, USD
 * from the repo's price table) and calls nothing paid. A dry run needs no
 * sourceId, so the estimate can be shown before the source is registered.
 *
 * Body: { sourceId?, batchIndex, pages: [{ page, text }], dryRun? }
 * The browser keeps each body under ~3 MB; this route refuses over 4 MB.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient }       from "@/lib/supabase/server";
import { verifyAdmin }               from "@/lib/admin/auth";
import { getEmbedding }              from "@/lib/rag/embed";
import { ingestBatch, type ChunkRow } from "@/lib/rag/ingest";
import { MAX_BATCH_BYTES }           from "@/lib/rag/batching";
import { ingestBatchSchema }         from "@/lib/rag/sources";

export const runtime     = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BATCH_BYTES) {
    return NextResponse.json({ error: "Batch too large. Send smaller batches." }, { status: 413 });
  }

  const parsed = ingestBatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid batch", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) },
      { status: 400 },
    );
  }
  const { sourceId, batchIndex, pages, dryRun } = parsed.data;

  if (!dryRun && !process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is required for ingest (text-embedding-3-small)" },
      { status: 503 },
    );
  }

  const service = createServiceClient();
  let source = { id: "dry-run", domain: "dry_run", title: "dry run" };
  if (sourceId) {
    const { data, error } = await service
      .from("reference_sources")
      .select("id, domain, title, status")
      .eq("id", sourceId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Source not found" }, { status: 404 });
    if (!dryRun && data.status !== "ingesting") {
      return NextResponse.json({ error: `Source is ${data.status}; batches are only accepted while ingesting.` }, { status: 409 });
    }
    source = data;
  }

  const result = await ingestBatch(
    {
      embed: (text) => getEmbedding(text, "rag.embed.ingest", admin.id),
      store: {
        async deleteBatch(sid, bi) {
          const { error } = await service
            .from("reference_chunks")
            .delete()
            .eq("source_id", sid)
            .eq("batch_index", bi);
          if (error) throw new Error(error.message);
        },
        async insertChunks(rows: ChunkRow[]) {
          const { error } = await service.from("reference_chunks").insert(rows);
          if (error) throw new Error(error.message);
        },
      },
    },
    { source, batchIndex, pages, dryRun, actorId: admin.id },
  );

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({
    ok:       true,
    dryRun:   result.dryRun,
    stored:   result.stored,
    estimate: result.estimate,
  });
}
