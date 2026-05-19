/**
 * RAG Retrieve — Phase 8 (spec §4.4)
 *
 * Given a concept, embeds a query string and retrieves the top-k most
 * similar reference chunks from Supabase pgvector via the
 * match_reference_chunks() RPC (created in migration 010).
 *
 * Degrades gracefully:
 *  - Returns [] if OPENAI_API_KEY is missing
 *  - Returns [] if the reference_chunks table is empty or the RPC fails
 *
 * The returned strings are ready to be injected into the TeachingAgent prompt
 * as <reference_material> blocks.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getEmbedding }        from "@/lib/rag/embed";

export interface ConceptForRAG {
  id:                   string;
  name:                 string;
  description:          string;
  domain?:              string;
  learning_objectives?: string[];
}

interface ChunkRow {
  id:           string;
  content:      string;
  domain:       string;
  source_title: string | null;
  similarity:   number;
}

/**
 * Retrieves up to `topK` reference chunks relevant to the given concept.
 *
 * Query construction (spec §4.4):
 *   "{name}: {description}. {learning objectives joined}"
 */
export async function retrieveContext(
  concept:  ConceptForRAG,
  supabase: SupabaseClient,
  topK      = 4
): Promise<string[]> {
  const objectives = (concept.learning_objectives ?? []).join(" ");
  const query      = `${concept.name}: ${concept.description}. ${objectives}`.trim();

  const embedding = await getEmbedding(query);
  if (!embedding) return [];   // API key missing — lesson still works without RAG

  const { data, error } = await supabase.rpc("match_reference_chunks", {
    query_embedding: embedding,
    match_count:     topK,
    domain_filter:   concept.domain ?? null,
  });

  if (error || !data) return [];

  return (data as ChunkRow[])
    .filter((row) => row.similarity > 0.3)   // discard low-relevance chunks
    .map((row) => {
      const source = row.source_title ? ` (${row.source_title})` : "";
      return `[Reference${source}]\n${row.content}`;
    });
}
