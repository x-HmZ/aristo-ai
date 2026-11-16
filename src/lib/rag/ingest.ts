/**
 * Server-side batch ingestion, with its side effects injected so the logic
 * (chunk, cap, embed, replace-on-retry, dry run) is testable without a
 * database or the embeddings API.
 *
 * A batch is identified by (source id, batch index). Sending the same batch
 * again replaces the chunks that batch wrote earlier, so a retry after a
 * timeout never duplicates anything.
 */

import { chunkPages, type PageText } from "./chunking";
import { MAX_BATCH_CHUNKS, estimateIngest, type IngestEstimate } from "./batching";

export interface ChunkRow {
  domain:       string;
  source_title: string;
  content:      string;
  embedding:    number[];
  metadata:     Record<string, unknown>;
  source_id:    string;
  batch_index:  number;
  page_start:   number | null;
  page_end:     number | null;
}

export interface IngestStore {
  deleteBatch(sourceId: string, batchIndex: number): Promise<void>;
  insertChunks(rows: ChunkRow[]): Promise<void>;
}

export interface IngestDeps {
  embed: (text: string) => Promise<number[] | null>;
  store: IngestStore;
}

export interface IngestArgs {
  source:     { id: string; domain: string; title: string };
  batchIndex: number;
  pages:      PageText[];
  dryRun:     boolean;
  actorId?:   string;
}

export type IngestResult =
  | { ok: true; dryRun: boolean; estimate: IngestEstimate; stored: number }
  | { ok: false; status: number; error: string };

const EMBED_CONCURRENCY = 5;
const INSERT_SLICE      = 20;

export async function ingestBatch(deps: IngestDeps, args: IngestArgs): Promise<IngestResult> {
  const chunks = chunkPages(args.pages);
  if (chunks.length === 0) {
    return { ok: false, status: 400, error: "This batch produced no usable chunks (too little text)." };
  }
  if (chunks.length > MAX_BATCH_CHUNKS) {
    return {
      ok: false,
      status: 413,
      error: `This batch produced ${chunks.length} chunks; the limit is ${MAX_BATCH_CHUNKS}. Send smaller batches.`,
    };
  }

  const estimate = estimateIngest(chunks);
  if (args.dryRun) return { ok: true, dryRun: true, estimate, stored: 0 };

  // Embed everything first: if any chunk fails, nothing changes and the
  // previous copy of this batch (if any) is left intact.
  const embeddings: Array<number[] | null> = new Array(chunks.length).fill(null);
  try {
    for (let i = 0; i < chunks.length; i += EMBED_CONCURRENCY) {
      const slice = chunks.slice(i, i + EMBED_CONCURRENCY);
      const out = await Promise.all(slice.map((c) => deps.embed(c.text)));
      out.forEach((e, k) => { embeddings[i + k] = e; });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "embedding request failed";
    return { ok: false, status: 502, error: `Embedding failed: ${msg}. Retry this batch.` };
  }
  if (embeddings.some((e) => !e)) {
    return { ok: false, status: 502, error: "Some chunks returned no embedding. Retry this batch." };
  }

  const rows: ChunkRow[] = chunks.map((c, i) => ({
    domain:       args.source.domain,
    source_title: args.source.title.slice(0, 255),
    content:      c.text,
    embedding:    embeddings[i] as number[],
    metadata:     {
      chunk_index:  i,
      batch_chunks: chunks.length,
      ...(args.actorId ? { ingested_by: args.actorId } : {}),
    },
    source_id:   args.source.id,
    batch_index: args.batchIndex,
    page_start:  c.pageStart,
    page_end:    c.pageEnd,
  }));

  try {
    await deps.store.deleteBatch(args.source.id, args.batchIndex);
    for (let i = 0; i < rows.length; i += INSERT_SLICE) {
      await deps.store.insertChunks(rows.slice(i, i + INSERT_SLICE));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "database write failed";
    return { ok: false, status: 500, error: `Storing chunks failed: ${msg}. Retry this batch.` };
  }

  return { ok: true, dryRun: false, estimate, stored: rows.length };
}
