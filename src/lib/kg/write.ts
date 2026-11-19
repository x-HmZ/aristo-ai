/**
 * The one write path for concepts and their prerequisite edges.
 *
 * Used by POST /api/kg/concepts (the admin editor and its commit button) and
 * by the "draft a course from a book" save. Takes a service-role client:
 * concepts and concept_prerequisites are writable only by the service role
 * (RLS), which is why the old /api/kg/ingest, which wrote with the admin's
 * own session, could not work.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { BLOOM_LEVELS } from "./fromOutline";

const id = z.string().regex(/^[a-z0-9_]{3,100}$/, "ids are snake_case, 3-100 chars");

export const conceptInputSchema = z.object({
  id,
  domain:                z.string().regex(/^[a-z0-9_]{3,100}$/),
  name:                  z.string().min(1).max(255),
  description:           z.string().max(4000).nullish(),
  difficulty:            z.coerce.number().int().min(1).max(5).optional(),
  bloom_level:           z.enum(BLOOM_LEVELS).optional(),
  estimated_minutes:     z.coerce.number().int().min(1).max(240).optional(),
  key_terms:             z.array(z.string().max(200)).max(50).optional(),
  learning_objectives:   z.array(z.string().max(500)).max(20).optional(),
  common_misconceptions: z.array(z.string().max(500)).max(20).optional(),
  tags:                  z.array(z.string().max(100)).max(50).optional(),
  prerequisites:         z.array(id).max(30).optional(),
  // Set by "draft a course from a book"; absent for hand-written concepts.
  source_id:             z.string().uuid().nullish(),
  source_pages:          z.array(z.object({ start: z.number().int().min(1), end: z.number().int().min(1) })).max(30).nullish(),
  grade_level:           z.number().int().min(1).max(12).nullish(),
  is_draft:              z.boolean().optional(),
});

export type ConceptWrite = z.infer<typeof conceptInputSchema>;

export const conceptsBodySchema = z.union([
  z.array(conceptInputSchema).min(1).max(600),
  z.object({ concepts: z.array(conceptInputSchema).min(1).max(600) }).transform((b) => b.concepts),
]);

export async function writeConcepts(
  service:  SupabaseClient,
  concepts: ConceptWrite[],
): Promise<{ inserted: number; edges: number }> {
  const rows = concepts.map(({ prerequisites: _p, ...rest }) => rest);
  const { error: upsertError } = await service.from("concepts").upsert(rows, { onConflict: "id" });
  if (upsertError) throw upsertError;

  const ids = concepts.map((c) => c.id);
  const edges: Array<{ concept_id: string; prerequisite_id: string }> = [];
  for (const c of concepts) {
    for (const p of new Set(c.prerequisites ?? [])) {
      if (p !== c.id) edges.push({ concept_id: c.id, prerequisite_id: p });
    }
  }

  // Replace edges for every concept written, including those that now have none.
  const { error: delError } = await service.from("concept_prerequisites").delete().in("concept_id", ids);
  if (delError) throw delError;

  if (edges.length > 0) {
    const { error: edgeError } = await service.from("concept_prerequisites").insert(edges);
    if (edgeError) throw edgeError;
  }
  return { inserted: concepts.length, edges: edges.length };
}
