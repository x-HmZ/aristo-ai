/**
 * POST /api/admin/rag/upload
 *
 * Ingest text into the RAG corpus. Accepts either:
 *   - application/json: { domain, source_title?, text, concept_id? }
 *   - multipart/form-data: domain=…&source_title=…&file=<txt or md or pdf>
 *
 * Chunks, embeds, and inserts into reference_chunks. Returns { ingested }.
 *
 * PDF parsing is intentionally omitted in v1 — paste the text instead, or
 * pre-extract on the client. (Adding pdf-parse pulls in ~2MB.)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient }       from "@/lib/supabase/server";
import { verifyAdmin }               from "@/lib/admin/auth";
import { logAdminAction }            from "@/lib/admin/audit";
import { chunkText, getEmbedding }   from "@/lib/rag/embed";

export const runtime     = "nodejs";
export const maxDuration = 60;

interface IngestInput {
  domain:       string;
  source_title?: string;
  text:         string;
  concept_id?:  string;
}

async function readInput(req: NextRequest): Promise<IngestInput | { error: string }> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const body = await req.json().catch(() => null);
    if (!body || !body.domain || !body.text) {
      return { error: "domain and text are required" };
    }
    return {
      domain:       body.domain,
      source_title: body.source_title ?? null,
      text:         body.text,
      concept_id:   body.concept_id ?? undefined,
    } as IngestInput;
  }
  if (ct.includes("multipart/form-data")) {
    const fd = await req.formData();
    const domain       = fd.get("domain")?.toString() ?? "";
    const source_title = fd.get("source_title")?.toString() ?? "";
    const concept_id   = fd.get("concept_id")?.toString() ?? "";
    const file         = fd.get("file");

    if (!domain) return { error: "domain is required" };

    let text = fd.get("text")?.toString() ?? "";
    if (file && file instanceof File) {
      if (file.type === "application/pdf") {
        return {
          error: "PDF upload not yet supported — pre-extract text and paste it as the 'text' field.",
        };
      }
      // Treat anything else as plain text
      text = await file.text();
    }
    if (!text) return { error: "Provide text via 'file' (.txt/.md) or 'text' form field" };

    return {
      domain,
      source_title: source_title || null,
      text,
      concept_id:   concept_id || undefined,
    } as IngestInput;
  }
  return { error: `Unsupported content-type: ${ct}` };
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = await readInput(req);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { domain, source_title, text, concept_id } = parsed;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is required for ingest (text-embedding-3-small)" },
      { status: 503 }
    );
  }

  const chunks = chunkText(text);
  if (chunks.length === 0) {
    return NextResponse.json(
      { error: "Input text produced no usable chunks (after >50-char filter)" },
      { status: 400 }
    );
  }

  const service = createServiceClient();
  const rows: Array<{
    domain: string; source_title: string | null; content: string; embedding: number[]; metadata: Record<string, unknown>;
  }> = [];

  // Embed in batches of 5 to avoid hitting RPM caps
  for (let i = 0; i < chunks.length; i += 5) {
    const batch = chunks.slice(i, i + 5);
    const embeddings = await Promise.all(batch.map((c) => getEmbedding(c)));
    embeddings.forEach((emb, idx) => {
      if (!emb) return; // skip failed embeddings
      rows.push({
        domain,
        source_title: source_title ?? null,
        content:      batch[idx],
        embedding:    emb,
        metadata: {
          ingested_by:        admin.id,
          chunk_index:        i + idx,
          total_chunks:       chunks.length,
          ...(concept_id ? { concept_id } : {}),
        },
      });
    });
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "All chunks failed to embed — check OPENAI_API_KEY and rate limits." },
      { status: 502 }
    );
  }

  const { error } = await service.from("reference_chunks").insert(rows);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAdminAction({
    actorId:    admin.id,
    actorEmail: admin.email,
    action:     "rag.ingest",
    targetType: "domain",
    targetId:   domain,
    diff:       {
      params: { source_title, concept_id: concept_id ?? null, ingested: rows.length },
    },
    request: req,
  });

  return NextResponse.json({
    ingested:     rows.length,
    total_chunks: chunks.length,
  });
}
