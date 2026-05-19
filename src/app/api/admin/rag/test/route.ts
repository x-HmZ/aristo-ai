/**
 * POST /api/admin/rag/test
 *
 * Embeds the supplied query and returns the top-k matched
 * reference_chunks via the match_reference_chunks() RPC. Used by the RAG
 * manager's Similarity Tester panel.
 *
 * Body:   { domain?: string, query: string, k?: number }
 * Returns: { matches: { id, content, score, source_title, domain }[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient }       from "@/lib/supabase/server";
import { verifyAdmin }               from "@/lib/admin/auth";
import { getEmbedding }              from "@/lib/rag/embed";

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const query  = body?.query  as string | undefined;
  const domain = body?.domain as string | undefined;
  const k      = Math.min(20, Math.max(1, parseInt(body?.k ?? "5", 10) || 5));

  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is required for similarity testing" },
      { status: 503 }
    );
  }

  const embedding = await getEmbedding(query);
  if (!embedding) {
    return NextResponse.json(
      { error: "Failed to embed query (OpenAI returned no embedding)" },
      { status: 502 }
    );
  }

  const service = createServiceClient();
  const { data, error } = await service.rpc("match_reference_chunks", {
    query_embedding: embedding,
    match_count:     k,
    domain_filter:   domain ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const matches = (data ?? []) as Array<{
    id:           string;
    content:      string;
    domain:       string;
    source_title: string | null;
    similarity:   number;
  }>;

  return NextResponse.json({
    matches: matches.map((m) => ({
      id:           m.id,
      content:      m.content,
      score:        m.similarity,
      source_title: m.source_title,
      domain:       m.domain,
    })),
  });
}
