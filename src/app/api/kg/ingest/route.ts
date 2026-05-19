/**
 * POST /api/kg/ingest
 *
 * Admin-only route to ingest reference material into the RAG pipeline.
 * Chunks the provided text, embeds each chunk via OpenAI text-embedding-3-small,
 * and stores them in reference_chunks (pgvector).
 *
 * Body:
 *  {
 *    domain:       string          — must match a concepts.domain value
 *    source_title: string          — e.g. "Python Docs §5.2"
 *    content:      string          — raw text (will be chunked automatically)
 *    metadata?:    Record<string,unknown>
 *  }
 *
 * Response: { inserted: number }
 *
 * Requires: profiles.is_admin = true for the authenticated user.
 * Requires: OPENAI_API_KEY env var to be set.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@/lib/supabase/server";
import { getEmbedding, chunkText }   from "@/lib/rag/embed";

export async function POST(req: NextRequest) {
  try {
    // ── Auth + admin check ────────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    const body = await req.json() as {
      domain:        string;
      source_title?: string;
      content:       string;
      metadata?:     Record<string, unknown>;
    };

    if (!body.domain || !body.content?.trim()) {
      return NextResponse.json(
        { error: "domain and content are required" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY not configured" },
        { status: 503 }
      );
    }

    // ── Chunk the content ─────────────────────────────────────────────────────
    const chunks = chunkText(body.content);

    if (chunks.length === 0) {
      return NextResponse.json({ error: "Content too short to ingest" }, { status: 400 });
    }

    // ── Embed + insert each chunk ─────────────────────────────────────────────
    // Process in batches of 5 to avoid overwhelming the OpenAI embeddings API
    const BATCH = 5;
    let inserted = 0;

    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH);

      const embeddings = await Promise.all(
        batch.map((chunk) => getEmbedding(chunk))
      );

      const rows = batch
        .map((content, j) => ({
          domain:       body.domain,
          source_title: body.source_title ?? null,
          content,
          embedding:    embeddings[j],   // null if embedding failed
          metadata:     body.metadata ?? {},
        }))
        .filter((r) => r.embedding !== null);   // skip any that failed to embed

      if (rows.length > 0) {
        const { error } = await supabase
          .from("reference_chunks")
          .insert(rows);

        if (error) throw error;
        inserted += rows.length;
      }
    }

    return NextResponse.json({ inserted, total_chunks: chunks.length });
  } catch (err) {
    console.error("POST /api/kg/ingest error:", err);
    return NextResponse.json({ error: "Ingest failed" }, { status: 500 });
  }
}
