/**
 * GET /api/learn/overdue-count
 *
 * Cheap endpoint for the LearnClient header chip: returns just the SRS
 * overdue count. Split out from /api/learn/next so the 5-minute client poll
 * doesn't trigger the course-progress + structure + mastery joins (or the
 * Math.random() lesson/review decision) that /api/learn/next performs.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOverdueCount } from "@/lib/srs/queue";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const overdueCount = await getOverdueCount(user.id, supabase);
    return NextResponse.json({ overdueCount });
  } catch (err) {
    console.error("GET /api/learn/overdue-count error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
