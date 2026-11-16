"use client";

/**
 * Browser-side calls for the upload dialog: register a source, send batches
 * with retry, finish. Only extracted text is sent; never the PDF.
 */

import type { Batch, IngestEstimate } from "@/lib/rag/batching";
import { sumEstimates } from "@/lib/rag/batching";
import type { OutlineEntry } from "@/lib/rag/outline";

export interface SourceDetails {
  title:           string;
  publisher:       string;
  licenceId:       string;
  licenceUrl:      string;
  attributionText: string;
  sourceUrl:       string;
  domain:          string;
  gradeMin:        number | null;
  gradeMax:        number | null;
}

interface ApiOk { ok?: boolean; error?: string; [k: string]: unknown }

async function post(url: string, body: unknown, method = "POST"): Promise<{ status: number; data: ApiOk }> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as ApiOk;
  return { status: res.status, data };
}

function sourceBody(
  d: SourceDetails, outline: OutlineEntry[], contentHash: string, batchCount: number, dryRun: boolean,
) {
  return {
    title:           d.title.trim(),
    publisher:       d.publisher.trim(),
    licenceId:       d.licenceId,
    licenceUrl:      d.licenceUrl.trim() || null,
    attributionText: d.attributionText.trim() || null,
    sourceUrl:       d.sourceUrl.trim() || null,
    domain:          d.domain.trim(),
    gradeMin:        d.gradeMin,
    gradeMax:        d.gradeMax,
    outline,
    contentHash,
    batchCount,
    dryRun,
  };
}

/** Validates details, licence and duplicate, and prices every batch. Nothing is stored or embedded. */
export async function dryRunAll(
  details: SourceDetails, outline: OutlineEntry[], contentHash: string, batches: Batch[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ ok: true; estimate: IngestEstimate; warning: string | null } | { ok: false; error: string }> {
  const check = await post("/api/admin/rag/sources", sourceBody(details, outline, contentHash, batches.length, true));
  if (check.status >= 400) return { ok: false, error: check.data.error ?? "Source check failed" };

  const estimates: IngestEstimate[] = [];
  for (const b of batches) {
    const r = await post("/api/admin/rag/ingest", { batchIndex: b.index, pages: b.pages, dryRun: true });
    if (r.status >= 400) return { ok: false, error: r.data.error ?? `Estimate failed at batch ${b.index + 1}` };
    estimates.push(r.data.estimate as IngestEstimate);
    onProgress?.(estimates.length, batches.length);
  }
  return { ok: true, estimate: sumEstimates(estimates), warning: (check.data.warning as string | null) ?? null };
}

export async function createSource(
  details: SourceDetails, outline: OutlineEntry[], contentHash: string, batchCount: number,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const r = await post("/api/admin/rag/sources", sourceBody(details, outline, contentHash, batchCount, false));
  if (r.status >= 400 || typeof r.data.id !== "string") return { ok: false, error: r.data.error ?? "Could not register the source" };
  return { ok: true, id: r.data.id };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Sends one batch, retrying transient failures (5xx, network) with backoff. */
export async function sendBatch(
  sourceId: string, batch: Batch, attempts = 3,
): Promise<{ ok: true; estimate: IngestEstimate } | { ok: false; error: string }> {
  let lastError = "Batch failed";
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await post("/api/admin/rag/ingest", { sourceId, batchIndex: batch.index, pages: batch.pages, dryRun: false });
      if (r.status < 400) return { ok: true, estimate: r.data.estimate as IngestEstimate };
      lastError = r.data.error ?? `Batch ${batch.index + 1} failed (${r.status})`;
      if (r.status < 500) break;                       // a 4xx will not get better by retrying
    } catch {
      lastError = "Network error while sending a batch";
    }
    await sleep(1500 * (i + 1));
  }
  return { ok: false, error: lastError };
}

export async function finishSource(
  sourceId: string, action: "complete" | "fail", tokenCount: number, error?: string,
): Promise<{ ok: boolean; error?: string }> {
  const r = await post(`/api/admin/rag/sources/${sourceId}`, { action, tokenCount, error }, "PATCH");
  return r.status < 400 ? { ok: true } : { ok: false, error: r.data.error ?? "Could not finish the source" };
}
