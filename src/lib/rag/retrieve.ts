/**
 * RAG Retrieve — Phase 8 (spec §4.4)
 *
 * Given a concept, embeds a query string and retrieves the most similar
 * reference chunks from Supabase pgvector via match_reference_chunks().
 *
 * Degrades gracefully:
 *  - Returns nothing if OPENAI_API_KEY is missing
 *  - Returns nothing if the table is empty or the RPC fails
 *
 * When a concept carries page ranges (drafted from a book outline), the
 * search is first limited to those pages; if nothing relevant is found
 * there, it falls back to the whole domain.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getEmbedding }        from "@/lib/rag/embed";
import { formatChunk, type ReferenceChunk } from "@/lib/rag/reference";

export const RETRIEVE_TOP_K     = 4;
export const MIN_SIMILARITY     = 0.3;

export interface ConceptForRAG {
  id:                   string;
  name:                 string;
  description:          string;
  domain?:              string;
  learning_objectives?: string[];
}

export interface PageRange { start: number; end: number }

export interface RetrievedChunk extends ReferenceChunk {
  domain:     string;
  similarity: number;
}

export interface RetrievalResult {
  query:           string;
  chunks:          RetrievedChunk[];
  /** Rows the database returned that fell under MIN_SIMILARITY. */
  dropped:         number;
  usedPageFilter:  boolean;
  /** False when no embedding could be made (no API key). */
  embedded:        boolean;
}

interface ChunkRow {
  id:            string;
  content:       string;
  domain:        string;
  source_title:  string | null;
  source_id?:    string | null;
  page_start?:   number | null;
  page_end?:     number | null;
  similarity:    number;
}

export interface RetrieveOptions {
  topK?:       number;
  pageRanges?: PageRange[] | null;
  sourceId?:   string | null;
  userId?:     string | null;
  feature?:    string;
  /** Injected in tests. */
  embed?:      (text: string) => Promise<number[] | null>;
}

export function buildRetrievalQuery(concept: ConceptForRAG): string {
  const objectives = (concept.learning_objectives ?? []).join(" ");
  return `${concept.name}: ${concept.description}. ${objectives}`.trim();
}

function toChunk(row: ChunkRow): RetrievedChunk {
  return {
    id:          row.id,
    content:     row.content,
    domain:      row.domain,
    sourceId:    row.source_id ?? null,
    sourceTitle: row.source_title,
    pageStart:   row.page_start ?? null,
    pageEnd:     row.page_end ?? null,
    similarity:  row.similarity,
  };
}

async function callRpc(
  supabase:  SupabaseClient,
  embedding: number[],
  concept:   ConceptForRAG,
  topK:      number,
  sourceId:  string | null,
  ranges:    PageRange[] | null,
): Promise<ChunkRow[] | null> {
  const base = {
    query_embedding: embedding,
    match_count:     topK,
    domain_filter:   concept.domain ?? null,
  };
  const filtered = sourceId || (ranges && ranges.length > 0);
  const { data, error } = await supabase.rpc(
    "match_reference_chunks",
    filtered ? { ...base, source_filter: sourceId, page_ranges: ranges } : base,
  );
  if (!error && data) return data as ChunkRow[];
  if (filtered) {
    // Migration 020 not applied yet: the old function takes three arguments.
    const retry = await supabase.rpc("match_reference_chunks", base);
    if (!retry.error && retry.data) return retry.data as ChunkRow[];
  }
  return null;
}

/** Structured retrieval; the lesson route and the admin preview both use this. */
export async function retrieveChunks(
  concept:  ConceptForRAG,
  supabase: SupabaseClient,
  opts:     RetrieveOptions = {},
): Promise<RetrievalResult> {
  const topK  = opts.topK ?? RETRIEVE_TOP_K;
  const query = buildRetrievalQuery(concept);
  const empty: RetrievalResult = { query, chunks: [], dropped: 0, usedPageFilter: false, embedded: false };

  const embed = opts.embed ?? ((t: string) => getEmbedding(t, opts.feature ?? "rag.embed.retrieve", opts.userId));
  const embedding = await embed(query);
  if (!embedding) return empty;   // API key missing: lesson still works without RAG

  const ranges = opts.pageRanges && opts.pageRanges.length > 0 ? opts.pageRanges : null;
  const sourceId = opts.sourceId ?? null;

  let rows = await callRpc(supabase, embedding, concept, topK, sourceId, ranges);
  let usedPageFilter = ranges !== null;
  let kept = (rows ?? []).filter((r) => r.similarity > MIN_SIMILARITY);

  if (ranges && kept.length === 0) {
    rows = await callRpc(supabase, embedding, concept, topK, null, null);
    usedPageFilter = false;
    kept = (rows ?? []).filter((r) => r.similarity > MIN_SIMILARITY);
  }

  return {
    query,
    chunks:         kept.map(toChunk),
    dropped:        (rows ?? []).length - kept.length,
    usedPageFilter,
    embedded:       true,
  };
}

/**
 * Looks up a concept's source and page ranges. Best effort: before
 * migration 020 the columns do not exist, and the lesson must still work.
 */
export async function loadConceptScope(
  supabase:  SupabaseClient,
  conceptId: string,
): Promise<{ sourceId: string | null; pageRanges: PageRange[] | null }> {
  try {
    const { data, error } = await supabase
      .from("concepts")
      .select("source_id, source_pages")
      .eq("id", conceptId)
      .maybeSingle();
    if (error || !data) return { sourceId: null, pageRanges: null };
    const pages = Array.isArray(data.source_pages) ? (data.source_pages as PageRange[]) : null;
    return { sourceId: (data.source_id as string | null) ?? null, pageRanges: pages };
  } catch {
    return { sourceId: null, pageRanges: null };
  }
}

/**
 * Prompt-ready chunks (each wrapped by formatChunk). Kept for callers that
 * only need strings.
 */
export async function retrieveContext(
  concept:  ConceptForRAG,
  supabase: SupabaseClient,
  topK      = RETRIEVE_TOP_K,
  opts:     Omit<RetrieveOptions, "topK"> = {},
): Promise<string[]> {
  const { chunks } = await retrieveChunks(concept, supabase, { ...opts, topK });
  return chunks.map(formatChunk);
}
