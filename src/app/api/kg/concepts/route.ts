// POST /api/kg/concepts — add one or many concepts (with prerequisites)
// Admin-only. Body: { concepts: ConceptInput[] }
// where ConceptInput = concept fields + prerequisites: string[]

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient }       from "@/lib/supabase/server";
import { verifyAdmin }               from "@/lib/admin/auth";
import { logAdminAction }            from "@/lib/admin/audit";

interface ConceptInput {
  id: string;
  domain: string;
  name: string;
  description?: string;
  difficulty?: number;
  bloom_level?: string;
  estimated_minutes?: number;
  key_terms?: string[];
  learning_objectives?: string[];
  common_misconceptions?: string[];
  tags?: string[];
  prerequisites?: string[];
}

export async function POST(req: NextRequest) {
  const user = await verifyAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const concepts: ConceptInput[] = Array.isArray(body) ? body : body.concepts;

    if (!concepts || concepts.length === 0) {
      return NextResponse.json({ error: "concepts array required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Upsert concept rows (without prerequisites field)
    const conceptRows = concepts.map(({ prerequisites: _prereqs, ...rest }) => rest);
    const { error: insertError } = await supabase
      .from("concepts")
      .upsert(conceptRows, { onConflict: "id" });

    if (insertError) throw insertError;

    // Build prerequisite edges
    const edges: Array<{ concept_id: string; prerequisite_id: string }> = [];
    for (const concept of concepts) {
      for (const prereqId of concept.prerequisites ?? []) {
        edges.push({ concept_id: concept.id, prerequisite_id: prereqId });
      }
    }

    if (edges.length > 0) {
      // Delete old edges for these concepts first (clean replace)
      const conceptIds = concepts.map((c) => c.id);
      await supabase
        .from("concept_prerequisites")
        .delete()
        .in("concept_id", conceptIds);

      const { error: edgeError } = await supabase
        .from("concept_prerequisites")
        .insert(edges);

      if (edgeError) throw edgeError;
    }

    const domain = concepts[0]?.domain ?? "unknown";
    await logAdminAction({
      actorId:    user.id,
      actorEmail: user.email,
      action:     "kg.concepts.commit",
      targetType: "domain",
      targetId:   domain,
      diff:       { params: { inserted: concepts.length, edges: edges.length } },
      request:    req,
    });

    return NextResponse.json({ inserted: concepts.length, edges: edges.length });
  } catch (err) {
    console.error("[POST /api/kg/concepts]", err);
    return NextResponse.json({ error: "Failed to insert concepts" }, { status: 500 });
  }
}
