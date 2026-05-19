// ============================================================
// Knowledge Graph — core graph operations
// All functions take a Supabase client so they can be used
// from both API routes (server client) and admin scripts
// (service-role client).
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Concept, ConceptWithPrereqs, GraphValidationError } from "./types";

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
 * Returns concepts the user can learn next:
 *   - All prerequisites have mastery_score >= 0.7
 *   - The concept itself has mastery_score < 0.7 (or no mastery row at all)
 */
export async function getAvailableConcepts(
  supabase: SupabaseClient,
  userId: string,
  domain: string
): Promise<Concept[]> {
  // Load all concepts + their prerequisites
  const { data: concepts, error: cError } = await supabase
    .from("concepts")
    .select("*, concept_prerequisites!concept_prerequisites_concept_id_fkey(prerequisite_id)")
    .eq("domain", domain);

  if (cError) throw cError;
  if (!concepts || concepts.length === 0) return [];

  // Load user mastery scores for this domain
  const conceptIds = concepts.map((c: Concept) => c.id);
  const { data: masteryRows, error: mError } = await supabase
    .from("user_concept_mastery")
    .select("concept_id, mastery_score")
    .eq("user_id", userId)
    .in("concept_id", conceptIds);

  if (mError) throw mError;

  const masteryMap: Record<string, number> = {};
  for (const row of masteryRows ?? []) {
    masteryMap[row.concept_id] = parseFloat(row.mastery_score);
  }

  const available: Concept[] = [];

  for (const concept of concepts as ConceptRow[]) {
    const myMastery = masteryMap[concept.id] ?? 0;
    if (myMastery >= 0.7) continue; // Already learned

    const prereqs = (concept.prerequisites ?? []).map((p) => p.prerequisite_id);
    const prereqsMet = prereqs.every((pid) => (masteryMap[pid] ?? 0) >= 0.7);

    if (prereqsMet) {
      available.push(concept);
    }
  }

  return available;
}

/**
 * Returns the ordered sequence of concepts the user needs to reach a target,
 * excluding already-mastered ones. Uses topological sort on the required subgraph.
 */
export async function getLearningPath(
  supabase: SupabaseClient,
  userId: string,
  targetConceptId: string
): Promise<Concept[]> {
  // Walk transitive prerequisites using the view created in the migration
  const { data: prereqRows, error: pError } = await supabase
    .from("concept_all_prerequisites")
    .select("prerequisite_id")
    .eq("concept_id", targetConceptId);

  if (pError) throw pError;

  const prereqIds = (prereqRows ?? []).map((r: { prerequisite_id: string }) => r.prerequisite_id);
  const allIds = [...prereqIds, targetConceptId];

  // Load concepts
  const { data: concepts, error: cError } = await supabase
    .from("concepts")
    .select("*, concept_prerequisites!concept_prerequisites_concept_id_fkey(prerequisite_id)")
    .in("id", allIds);

  if (cError) throw cError;
  if (!concepts || concepts.length === 0) return [];

  // Load mastery
  const { data: masteryRows, error: mError } = await supabase
    .from("user_concept_mastery")
    .select("concept_id, mastery_score")
    .eq("user_id", userId)
    .in("concept_id", allIds);

  if (mError) throw mError;

  const masteryMap: Record<string, number> = {};
  for (const row of masteryRows ?? []) {
    masteryMap[row.concept_id] = parseFloat(row.mastery_score);
  }

  // Filter out already mastered
  const remaining = (concepts as ConceptRow[]).filter(
    (c) => (masteryMap[c.id] ?? 0) < 0.7
  );

  // Topological sort of remaining subgraph
  const prereqMap: Record<string, string[]> = {};
  const conceptMap: Record<string, Concept> = {};

  for (const c of remaining) {
    conceptMap[c.id] = c;
    const allPrereqs = (c.prerequisites ?? []).map((p) => p.prerequisite_id);
    // Only include prerequisites that are in our subgraph
    prereqMap[c.id] = allPrereqs.filter((pid) => conceptMap[pid] !== undefined || remaining.some((r) => r.id === pid));
  }

  const ids = Object.keys(prereqMap);
  const { adj, inDegree } = buildGraph(ids, prereqMap);

  const queue = ids.filter((id) => inDegree[id] === 0);
  const sorted: Concept[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (conceptMap[current]) sorted.push(conceptMap[current]);
    for (const neighbor of adj[current]) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) queue.push(neighbor);
    }
  }

  return sorted;
}

/**
 * Returns a concept with its direct prerequisites and dependents.
 */
export async function getConceptWithContext(
  supabase: SupabaseClient,
  conceptId: string
): Promise<ConceptWithPrereqs | null> {
  const { data: concept, error: cError } = await supabase
    .from("concepts")
    .select(`
      *,
      concept_prerequisites!concept_prerequisites_concept_id_fkey(prerequisite_id),
      dependents:concept_prerequisites!concept_prerequisites_prerequisite_id_fkey(concept_id)
    `)
    .eq("id", conceptId)
    .single();

  if (cError || !concept) return null;

  const c = concept as ConceptRow & { dependents?: Array<{ concept_id: string }> };

  return {
    ...c,
    prerequisites: (c.prerequisites ?? []).map((p) => p.prerequisite_id),
    dependents: (c.dependents ?? []).map((d) => d.concept_id),
  };
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
