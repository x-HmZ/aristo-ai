/**
 * POST /api/admin/kg/prerequisites
 *
 * Replace-set semantics: takes the full list of prerequisite IDs for a
 * concept and atomically replaces the edges. Validates that adding the
 * new edges would not introduce a cycle.
 *
 * Body: { concept_id: string, prerequisite_ids: string[] }
 * Returns: { ok: true, inserted: number, removed: number }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient }       from "@/lib/supabase/server";
import { verifyAdmin }               from "@/lib/admin/auth";
import { logAdminAction }            from "@/lib/admin/audit";

interface Edge {
  concept_id: string;
  prerequisite_id: string;
}

/**
 * Returns true iff there's a path from `start` back to `target` using
 * the existing edges (i.e. adding an edge target→start would create a
 * cycle).
 */
function pathExists(
  edges: Edge[],
  start: string,
  target: string
): boolean {
  if (start === target) return true;
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.concept_id)) adj.set(e.concept_id, []);
    adj.get(e.concept_id)!.push(e.prerequisite_id);
  }
  const stack = [start];
  const seen  = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === target) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const nxt of adj.get(cur) ?? []) stack.push(nxt);
  }
  return false;
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { concept_id, prerequisite_ids } = body as {
    concept_id?: string;
    prerequisite_ids?: string[];
  };

  if (!concept_id || !Array.isArray(prerequisite_ids)) {
    return NextResponse.json(
      { error: "concept_id and prerequisite_ids[] are required" },
      { status: 400 }
    );
  }

  // No self-edges
  if (prerequisite_ids.includes(concept_id)) {
    return NextResponse.json(
      { error: "A concept cannot be a prerequisite of itself" },
      { status: 400 }
    );
  }

  // De-duplicate the set
  const desired = Array.from(new Set(prerequisite_ids));

  const service = createServiceClient();

  // Verify all prerequisite_ids exist (and grab their domain for sanity)
  const allIds = [concept_id, ...desired];
  const { data: existingConcepts } = await service
    .from("concepts")
    .select("id, domain")
    .in("id", allIds);

  const existingSet = new Set((existingConcepts ?? []).map((c) => c.id));
  for (const id of allIds) {
    if (!existingSet.has(id)) {
      return NextResponse.json(
        { error: `Concept "${id}" does not exist` },
        { status: 400 }
      );
    }
  }

  // Cycle check — fetch current edges and simulate the new set.
  const { data: allEdges } = await service
    .from("concept_prerequisites")
    .select("concept_id, prerequisite_id");

  const currentEdges = (allEdges ?? []) as Edge[];
  // Remove the concept's existing edges from the simulation, then add the
  // desired ones, then look for cycles starting from the new prerequisites.
  const simulated: Edge[] = currentEdges.filter((e) => e.concept_id !== concept_id);
  for (const pid of desired) {
    simulated.push({ concept_id, prerequisite_id: pid });
    // Cycle = there's already a path from pid back to concept_id
    if (pathExists(simulated.filter((e) => e !== simulated[simulated.length - 1]), pid, concept_id)) {
      return NextResponse.json(
        {
          error: `Adding "${pid}" as a prerequisite would create a cycle (path back to ${concept_id} already exists).`,
        },
        { status: 400 }
      );
    }
  }

  // Atomically replace the concept's prerequisite set
  const { error: delError } = await service
    .from("concept_prerequisites")
    .delete()
    .eq("concept_id", concept_id);
  if (delError) {
    return NextResponse.json({ error: delError.message }, { status: 500 });
  }

  let inserted = 0;
  if (desired.length > 0) {
    const rows = desired.map((pid) => ({ concept_id, prerequisite_id: pid }));
    const { error: insError } = await service.from("concept_prerequisites").insert(rows);
    if (insError) {
      return NextResponse.json({ error: insError.message }, { status: 500 });
    }
    inserted = rows.length;
  }

  const previousIds = new Set(
    currentEdges.filter((e) => e.concept_id === concept_id).map((e) => e.prerequisite_id)
  );
  const desiredSet = new Set(desired);
  const removed = [...previousIds].filter((id) => !desiredSet.has(id)).length;

  await logAdminAction({
    actorId:    admin.id,
    actorEmail: admin.email,
    action:     "concept.prerequisites.set",
    targetType: "concept",
    targetId:   concept_id,
    diff:       {
      before: { prerequisite_ids: [...previousIds] },
      after:  { prerequisite_ids: desired },
    },
    request: req,
  });

  return NextResponse.json({ ok: true, inserted, removed });
}
