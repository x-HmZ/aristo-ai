// GET /api/kg/:domain — list all concepts for a domain
// Admin-only. Used by the KG editor.

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient }       from "@/lib/supabase/server";
import { verifyAdmin }               from "@/lib/admin/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  const user = await verifyAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { domain } = await params;
    const supabase = createServiceClient();

    const { data: concepts, error } = await supabase
      .from("concepts")
      .select(`
        *,
        concept_prerequisites!concept_prerequisites_concept_id_fkey(prerequisite_id)
      `)
      .eq("domain", domain)
      .order("difficulty", { ascending: true });

    if (error) throw error;

    // Reshape to include prerequisites as a flat array of IDs
    const shaped = (concepts ?? []).map((c: {
      concept_prerequisites?: Array<{ prerequisite_id: string }>;
      [key: string]: unknown;
    }) => ({
      ...c,
      prerequisites: (c.concept_prerequisites ?? []).map(
        (p: { prerequisite_id: string }) => p.prerequisite_id
      ),
      concept_prerequisites: undefined,
    }));

    return NextResponse.json({ concepts: shaped });
  } catch (err) {
    console.error("[GET /api/kg/:domain]", err);
    return NextResponse.json({ error: "Failed to fetch concepts" }, { status: 500 });
  }
}
