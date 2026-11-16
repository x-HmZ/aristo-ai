/**
 * Source registry helpers: input schemas, content hashing and duplicate
 * detection. Pure apart from sha256Hex, which uses Web Crypto (available in
 * the browser and in Node 18+).
 */

import { z } from "zod";
import { LICENCES } from "./licences";
import { MAX_BATCHES } from "./batching";

export const DOMAIN_RE = /^[a-z0-9_]{3,100}$/;

export const domainSchema = z.string().regex(DOMAIN_RE, "domain must be 3-100 chars of a-z, 0-9 and _");

const licenceIds = LICENCES.map((l) => l.id) as [string, ...string[]];

export const outlineEntrySchema = z.object({
  title:   z.string().min(1).max(200),
  page:    z.number().int().min(1).nullable(),
  endPage: z.number().int().min(1).nullable(),
  depth:   z.number().int().min(0).max(5),
});

const optionalUrl = z
  .string()
  .max(2000)
  .refine((v) => v === "" || /^https?:\/\//i.test(v), "must be an http(s) URL")
  .nullish();

export const createSourceSchema = z
  .object({
    title:           z.string().trim().min(1).max(255),
    publisher:       z.string().trim().min(1).max(255),
    licenceId:       z.enum(licenceIds),
    licenceUrl:      optionalUrl,
    attributionText: z.string().trim().max(2000).nullish(),
    sourceUrl:       optionalUrl,
    domain:          domainSchema,
    gradeMin:        z.number().int().min(1).max(12).nullish(),
    gradeMax:        z.number().int().min(1).max(12).nullish(),
    outline:         z.array(outlineEntrySchema).max(400).default([]),
    contentHash:     z.string().regex(/^[a-f0-9]{64}$/, "contentHash must be a SHA-256 hex digest"),
    batchCount:      z.number().int().min(1).max(MAX_BATCHES),
    dryRun:          z.boolean().default(false),
  })
  .refine((v) => v.gradeMin == null || v.gradeMax == null || v.gradeMin <= v.gradeMax, {
    message: "gradeMin must not exceed gradeMax",
    path:    ["gradeMax"],
  });

export type CreateSourceInput = z.infer<typeof createSourceSchema>;

export const ingestBatchSchema = z
  .object({
    /** Required unless dryRun: an estimate can run before the source exists. */
    sourceId:   z.string().uuid().optional(),
    batchIndex: z.number().int().min(0).max(MAX_BATCHES),
    pages: z
      .array(z.object({ page: z.number().int().min(1).nullable(), text: z.string().max(400_000) }))
      .min(1)
      .max(2000),
    dryRun: z.boolean().default(false),
  })
  .refine((v) => v.dryRun || !!v.sourceId, { message: "sourceId is required", path: ["sourceId"] });

export type IngestBatchInput = z.infer<typeof ingestBatchSchema>;

export const completeSourceSchema = z.object({
  action: z.enum(["complete", "fail"]),
  error:  z.string().max(1000).optional(),
});

/** Whitespace-normalised text, the input to the content hash. */
export function normaliseForHash(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes  = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function contentHashOf(fullText: string): Promise<string> {
  return sha256Hex(normaliseForHash(fullText));
}

export interface SourceHashRow {
  id:           string;
  title:        string;
  status:       string;
  content_hash: string;
}

/** A source with this hash that is not a failed attempt blocks a new one. */
export function findDuplicate(hash: string, existing: SourceHashRow[]): SourceHashRow | null {
  return existing.find((s) => s.content_hash === hash && s.status !== "failed") ?? null;
}

/** USD formatting for the UI and reports, keeping small amounts visible. */
export function formatUsd(usd: number): string {
  if (usd === 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}
