/**
 * POST /api/admin/rag/preview
 *
 * Grounding preview, no LLM call. For a concept id or a typed topic it runs
 * the same retrieval the lesson route runs and returns the chunks (source,
 * pages, similarity) and the exact <reference_material> block the lesson
 * prompt would receive. The only paid call is one query embedding
 * (a fraction of a cent).
 *
 * Body: { conceptId } or { topic, domain? }
 */

import { NextRequest, NextResponse } from "next/server";
import { z }                         from "zod";
import { createServiceClient }       from "@/lib/supabase/server";
import { verifyAdmin }               from "@/lib/admin/auth";
import { loadConceptScope, retrieveChunks, MIN_SIMILARITY, RETRIEVE_TOP_K } from "@/lib/rag/retrieve";
import { buildReferenceSection, formatChunk } from "@/lib/rag/reference";
import { DOMAIN_RE } from "@/lib/rag/sources";

const bodySchema = z.union([
  z.object({ conceptId: z.string().min(1).max(100) }),
  z.object({ topic: z.string().trim().min(2).max(300), domain: z.string().regex(DOMAIN_RE).optional() }),
]);

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Provide a conceptId or a topic." }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is required to embed the query." }, { status: 503 });
  }

  const service = createServiceClient();
  let concept: { id: string; name: string; description: string; domain?: string; learning_objectives?: string[] };
  let scope: Awaited<ReturnType<typeof loadConceptScope>> = { sourceId: null, pageRanges: null };

  if ("conceptId" in parsed.data) {
    const { data } = await service
      .from("concepts")
      .select("id, name, description, domain, learning_objectives")
      .eq("id", parsed.data.conceptId)
      .maybeSingle();
    if (!data) return NextResponse.json({ error: "Concept not found." }, { status: 404 });
    concept = { ...data, description: data.description ?? "", learning_objectives: data.learning_objectives ?? [] };
    scope = await loadConceptScope(service, data.id);
  } else {
    concept = { id: "preview", name: parsed.data.topic, description: "", domain: parsed.data.domain };
  }

  const result = await retrieveChunks(concept, service, {
    sourceId:   scope.sourceId,
    pageRanges: scope.pageRanges,
    feature:    "rag.embed.preview",
    userId:     admin.id,
  });

  return NextResponse.json({
    query:          result.query,
    threshold:      MIN_SIMILARITY,
    topK:           RETRIEVE_TOP_K,
    dropped:        result.dropped,
    usedPageFilter: result.usedPageFilter,
    chunks:         result.chunks,
    referenceBlock: buildReferenceSection(result.chunks.map(formatChunk)),
  });
}
