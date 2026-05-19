// GET /api/profile/mastery — returns mastery scores for the user's current domain
// Query params: ?domain=python_programming (optional, defaults to all)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const domain = req.nextUrl.searchParams.get("domain");

    // Join mastery with concept to get domain + name
    let query = supabase
      .from("user_concept_mastery")
      .select(`
        concept_id,
        mastery_score,
        assessment_count,
        last_assessed,
        srs_next_review,
        srs_interval_days,
        srs_consecutive_correct,
        srs_lapses,
        concepts (id, name, domain, difficulty, bloom_level)
      `)
      .eq("user_id", user.id)
      .order("mastery_score", { ascending: false });

    if (domain) {
      // Filter by joining — use a separate concepts filter
      const { data: domainConcepts } = await supabase
        .from("concepts")
        .select("id")
        .eq("domain", domain);

      if (domainConcepts && domainConcepts.length > 0) {
        query = query.in("concept_id", domainConcepts.map((c: { id: string }) => c.id));
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ mastery: data ?? [] });
  } catch (err) {
    console.error("[GET /api/profile/mastery]", err);
    return NextResponse.json({ error: "Failed to fetch mastery" }, { status: 500 });
  }
}
