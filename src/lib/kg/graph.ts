// ============================================================
// Knowledge Graph — core graph operations
// All functions take a Supabase client so they can be used
// from both API routes (server client) and admin scripts
// (service-role client).
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Concept, GraphValidationError } from "./types";

// ── Types returned from Supabase joins ────────────────────────

interface ConceptRow extends Concept {
  // concept_prerequisites rows joined as arrays
  prerequisites?: Array<{ prerequisite_id: string }>;
  dependents?: Array<{ concept_id: string }>;
}

// ── Internal helpers ─────────────────────────────────────────

/** Build adjacency list and in-degree map from a map of concepts → prerequisite id arrays. */
function buildGraph(
  conceptIds: string[],
  prereqMap: Record<string, string[]>   // concept_id → [prerequisite_id, ...]
): { adj: Record<string, string[]>; inDegree: Record<string, number> } {
  const adj: Record<string, string[]> = {};
  const inDegree: Record<string, number> = {};

  for (const id of conceptIds) {
    adj[id] = [];
    inDegree[id] = 0;
  }

  for (const [conceptId, prereqs] of Object.entries(prereqMap)) {
    for (const prereqId of prereqs) {
      // Edge: prereqId → conceptId (prereq must come first)
      if (adj[prereqId]) adj[prereqId].push(conceptId);
      if (inDegree[conceptId] !== undefined) inDegree[conceptId]++;
    }
  }

  return { adj, inDegree };
}

// ── Public API ────────────────────────────────────────────────

/**
 * Returns all concepts in a valid teaching order using Kahn's algorithm.
 * Throws if a cycle exists.
 */
export async function topologicalSort(
  supabase: SupabaseClient,
  domain: string
): Promise<Concept[]> {
  const { data: concepts, error } = await supabase
    .from("concepts")
    .select("*, concept_prerequisites!concept_prerequisites_concept_id_fkey(prerequisite_id)")
    .eq("domain", domain);

  if (error) throw error;
  if (!concepts || concepts.length === 0) return [];

  const prereqMap: Record<string, string[]> = {};
  const conceptMap: Record<string, Concept> = {};

  for (const c of concepts as ConceptRow[]) {
    conceptMap[c.id] = c;
    prereqMap[c.id] = (c.prerequisites ?? []).map((p) => p.prerequisite_id);
  }

  const ids = Object.keys(prereqMap);
  const { adj, inDegree } = buildGraph(ids, prereqMap);

  // Kahn's algorithm
  const queue = ids.filter((id) => inDegree[id] === 0);
  const sorted: Concept[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(conceptMap[current]);

    for (const neighbor of adj[current]) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) queue.push(neighbor);
    }
  }

  if (sorted.length !== ids.length) {
    throw new Error("Cycle detected in knowledge graph — topological sort failed.");
  }

  return sorted;
}

/**
 * Validates the knowledge graph for a given domain.
 * Checks: no cycles, no orphans, all referenced prerequisites exist, at least one root.
 * Returns an array of error messages (empty = valid).
 */
export async function validateGraph(
  supabase: SupabaseClient,
  domain: string
): Promise<GraphValidationError[]> {
  const errors: GraphValidationError[] = [];

  const { data: concepts, error: cError } = await supabase
    .from("concepts")
    .select("id")
    .eq("domain", domain);

  if (cError) throw cError;
  if (!concepts || concepts.length === 0) return [];

  const { data: edges, error: eError } = await supabase
    .from("concept_prerequisites")
    .select("concept_id, prerequisite_id")
    .in("concept_id", concepts.map((c: { id: string }) => c.id));

  if (eError) throw eError;

  const conceptIds = new Set(concepts.map((c: { id: string }) => c.id));
  const prereqMap: Record<string, string[]> = {};

  for (const id of conceptIds) prereqMap[id] = [];

  for (const edge of edges ?? []) {
    // Check all referenced prerequisites actually exist in this domain
    if (!conceptIds.has(edge.prerequisite_id)) {
      errors.push({
        type: "missing_prerequisite",
        message: `Concept "${edge.concept_id}" references missing prerequisite "${edge.prerequisite_id}"`,
        involved: [edge.concept_id, edge.prerequisite_id],
      });
    } else {
      prereqMap[edge.concept_id].push(edge.prerequisite_id);
    }
  }

  // Check for at least one root (concept with no prerequisites)
  const ids = [...conceptIds];
  const { adj, inDegree } = buildGraph(ids, prereqMap);
  const roots = ids.filter((id) => inDegree[id] === 0);

  if (roots.length === 0) {
    errors.push({
      type: "no_root",
      message: "No root concept found — every concept has at least one prerequisite (possible cycle).",
    });
  }

  // Cycle detection via Kahn's
  const queue = [...roots];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    visited.add(current);
    for (const neighbor of adj[current]) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) queue.push(neighbor);
    }
  }

  if (visited.size !== ids.length) {
    const cycleNodes = ids.filter((id) => !visited.has(id));
    errors.push({
      type: "cycle",
      message: `Cycle detected involving ${cycleNodes.length} concept(s).`,
      involved: cycleNodes,
    });
  }

  // Check for orphans: concepts not reachable from any root
  // (In a DAG without cycles, all nodes reachable from roots = visited)
  const orphans = ids.filter((id) => !visited.has(id) && inDegree[id] > 0 && roots.length > 0);
  if (orphans.length > 0 && !errors.some((e) => e.type === "cycle")) {
    errors.push({
      type: "orphan",
      message: `${orphans.length} concept(s) are unreachable from root nodes.`,
      involved: orphans,
    });
  }

  return errors;
}
