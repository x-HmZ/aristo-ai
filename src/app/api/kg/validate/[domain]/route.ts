// POST /api/kg/validate/:domain — validate the knowledge graph for a domain
// Admin-only.

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient }       from "@/lib/supabase/server";
import { validateGraph }             from "@/lib/kg/graph";
import { verifyAdmin }               from "@/lib/admin/auth";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  const user = await verifyAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { domain } = await params;
    const supabase = createServiceClient();
    const errors   = await validateGraph(supabase, domain);

    return NextResponse.json({
      valid: errors.length === 0,
      errors,
    });
  } catch (err) {
    console.error("[POST /api/kg/validate/:domain]", err);
    return NextResponse.json({ error: "Validation failed" }, { status: 500 });
  }
}
