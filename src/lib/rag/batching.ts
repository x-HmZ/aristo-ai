/**
 * Batch planning for textbook ingestion.
 *
 * The browser extracts a book's text and sends it in batches. A batch must
 * stay under the request body limit (Vercel rejects over 4.5 MB; we aim for
 * 3 MB) and under a chunk count the route can embed within its time limit.
 *
 * Pure functions, no browser or network.
 */

import { DEFAULT_CHUNK_SIZE, chunkPages, estimateTokens, type PageChunk, type PageText } from "./chunking";
import { OPENAI_PRICING } from "@/lib/llm/pricing";

/** Client target: a batch plans for at most this many chunks. */
export const TARGET_BATCH_CHUNKS = 40;
/** Server hard cap per request; above the target to absorb packing differences. */
export const MAX_BATCH_CHUNKS = 60;
/** Client target for the JSON body size. */
export const TARGET_BATCH_BYTES = 3_000_000;
/** Server hard cap on the request body (Vercel's own limit is 4.5 MB). */
export const MAX_BATCH_BYTES = 4_000_000;
export const MAX_BATCHES = 2_000;
export const EMBEDDING_MODEL = "text-embedding-3-small";

export interface Batch {
  index:      number;
  pages:      PageText[];
  chunkCount: number;
  bytes:      number;
}

export interface BatchLimits {
  maxChunks?: number;
  maxBytes?:  number;
}

function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

function pageBytes(p: PageText): number {
  // Text plus a rough allowance for the JSON wrapper around each page.
  return byteLength(p.text) + 32;
}

/** A single page that would not fit one batch is cut into parts keeping its page number. */
export function splitOversizedPage(page: PageText, maxChunks: number): PageText[] {
  const limit = Math.floor(maxChunks * DEFAULT_CHUNK_SIZE * 0.7);
  if (page.text.length <= limit) return [page];
  const parts: PageText[] = [];
  let rest = page.text;
  while (rest.length > limit) {
    let cut = rest.lastIndexOf("\n\n", limit);
    if (cut < limit * 0.5) cut = rest.lastIndexOf(" ", limit);
    if (cut < limit * 0.5) cut = limit;
    parts.push({ page: page.page, text: rest.slice(0, cut) });
    rest = rest.slice(cut).trimStart();
  }
  if (rest.trim()) parts.push({ page: page.page, text: rest });
  return parts;
}

/** Splits pages into ordered batches that respect the byte and chunk limits. */
export function planBatches(pages: PageText[], limits: BatchLimits = {}): Batch[] {
  const maxChunks = limits.maxChunks ?? TARGET_BATCH_CHUNKS;
  const maxBytes  = limits.maxBytes  ?? TARGET_BATCH_BYTES;

  const queue = pages.flatMap((p) => splitOversizedPage(p, maxChunks)).filter((p) => p.text.trim().length > 0);
  const batches: Batch[] = [];

  let cur: PageText[] = [];
  let curBytes = 0;
  let curChunks = 0;

  const close = () => {
    if (cur.length === 0) return;
    batches.push({ index: batches.length, pages: cur, chunkCount: curChunks, bytes: curBytes });
    cur = [];
    curBytes = 0;
    curChunks = 0;
  };

  for (const p of queue) {
    const nextBytes  = curBytes + pageBytes(p);
    const nextChunks = chunkPages([...cur, p]).length;
    if (cur.length > 0 && (nextBytes > maxBytes || nextChunks > maxChunks)) {
      close();
      cur = [p];
      curBytes = pageBytes(p);
      curChunks = chunkPages([p]).length;
    } else {
      cur.push(p);
      curBytes = nextBytes;
      curChunks = nextChunks;
    }
  }
  close();
  return batches;
}

export interface IngestEstimate {
  chunks:  number;
  tokens:  number;
  usd:     number;
  model:   string;
}

/** Cost of embedding these chunks, from the repo's price table. No API call. */
export function estimateIngest(chunks: PageChunk[]): IngestEstimate {
  const tokens = chunks.reduce((s, c) => s + estimateTokens(c.text.slice(0, 8000)), 0);
  return {
    chunks: chunks.length,
    tokens,
    usd:    (tokens / 1_000_000) * OPENAI_PRICING[EMBEDDING_MODEL].input,
    model:  EMBEDDING_MODEL,
  };
}

export function sumEstimates(list: IngestEstimate[]): IngestEstimate {
  return list.reduce<IngestEstimate>(
    (a, e) => ({ chunks: a.chunks + e.chunks, tokens: a.tokens + e.tokens, usd: a.usd + e.usd, model: EMBEDDING_MODEL }),
    { chunks: 0, tokens: 0, usd: 0, model: EMBEDDING_MODEL },
  );
}

