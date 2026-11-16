// POST /api/kg/concepts — add one or many concepts (with prerequisites)
// Admin-only. Body: { concepts: ConceptInput[] } or a bare array,
// where ConceptInput = concept fields + prerequisites: string[]
// (validated by conceptsBodySchema; written by writeConcepts with the
// service-role client).

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient }       from "@/lib/supabase/server";
import { verifyAdmin }               from "@/lib/admin/auth";
import { logAdminAction }            from "@/lib/admin/audit";
import { conceptsBodySchema, writeConcepts } from "@/lib/kg/write";

export async function POST(req: NextRequest) {
  const user = await verifyAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = conceptsBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:  "Invalid concepts",
        issues: parsed.error.issues.slice(0, 10).map((i) => `${i.path.join(".")}: ${i.message}`),
      },
      { status: 400 },
    );
  }
  const concepts = parsed.data;

  try {
    const { inserted, edges } = await writeConcepts(createServiceClient(), concepts);

    await logAdminAction({
      actorId:    user.id,
      actorEmail: user.email,
      action:     "kg.concepts.commit",
      targetType: "domain",
      targetId:   concepts[0]?.domain ?? "unknown",
      diff:       { params: { inserted, edges } },
      request:    req,
    });

    return NextResponse.json({ inserted, edges });
  } catch (err) {
    console.error("[POST /api/kg/concepts]", err);
    return NextResponse.json({ error: "Failed to insert concepts" }, { status: 500 });
  }
}
