/**
 * GET /api/admin/kg/coverage/[domain]
 *
 * Returns RAG chunk coverage per concept in a domain. Used by the KG
 * editor to color nodes by whether they have reference material.
 *
 * Strategy:
 *   - Count reference_chunks rows per domain (no per-concept FK exists),
 *     and also peek at metadata.concept_id when present.
 *   - For now, return a single domain-level count + per-concept counts
 *     where metadata.concept_id was set during ingest.
 *
 * Returns:
 *   {
 *     domain_chunk_count:  number;
 *     per_concept:         Record<conceptId, { chunkCount, lastIngestedAt }>;
 *     last_ingested_at:    string | null;
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient }       from "@/lib/supabase/server";
import { verifyAdmin }               from "@/lib/admin/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { domain } = await params;
  const service = createServiceClient();

  const [
    { data: chunks, count: domainCount },
  ] = await Promise.all([
    service
      .from("reference_chunks")
      .select("metadata, created_at", { count: "exact" })
      .eq("domain", domain)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  const perConcept: Record<string, { chunkCount: number; lastIngestedAt: string | null }> = {};
  let lastIngestedAt: string | null = null;

  for (const row of (chunks ?? []) as Array<{
    metadata: Record<string, unknown> | null;
    created_at: string;
  }>) {
    if (!lastIngestedAt) lastIngestedAt = row.created_at;
    const cid = (row.metadata?.concept_id as string | undefined) ?? null;
    if (!cid) continue;
    if (!perConcept[cid]) {
      perConcept[cid] = { chunkCount: 0, lastIngestedAt: row.created_at };
    }
    perConcept[cid].chunkCount += 1;
  }

  return NextResponse.json({
    domain_chunk_count: domainCount ?? 0,
    per_concept:        perConcept,
    last_ingested_at:   lastIngestedAt,
  });
}
