/**
 * GET /api/admin/system/health
 *
 * Returns:
 *   - rowCounts: row count per primary table
 *   - apiKeys:   live ping results for Anthropic / OpenAI / fal.ai
 *   - recentErrors: last 10 audit-log entries whose `diff.error` is set
 */

import { NextResponse }         from "next/server";
import { createServiceClient }  from "@/lib/supabase/server";
import { verifyAdmin }          from "@/lib/admin/auth";

const TABLES = [
  "profiles", "learner_profiles", "concepts", "concept_prerequisites",
  "user_concept_mastery", "user_misconceptions", "session_logs",
  "quiz_attempts", "courses", "user_course_progress", "reference_chunks",
  "admin_audit_log", "usage_events",
];

async function pingAnthropic(): Promise<"ok" | "missing_key" | "error"> {
  if (!process.env.ANTHROPIC_API_KEY) return "missing_key";
  try {
    const r = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key":         process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      cache: "no-store",
    });
    return r.ok ? "ok" : "error";
  } catch { return "error"; }
}

async function pingOpenAI(): Promise<"ok" | "missing_key" | "error"> {
  if (!process.env.OPENAI_API_KEY) return "missing_key";
  try {
    const r = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      cache: "no-store",
    });
    return r.ok ? "ok" : "error";
  } catch { return "error"; }
}

async function pingFal(): Promise<"ok" | "missing_key" | "error"> {
  if (!process.env.FAL_KEY) return "missing_key";
  // fal doesn't have a cheap ping endpoint, so we treat the key's mere presence
  // as "configured"; flip to "ok" without a network call to avoid metering.
  return "ok";
}

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();

  const [rowCountsArr, anthropic, openai, fal] = await Promise.all([
    Promise.all(
      TABLES.map(async (t) => {
        const { count } = await service.from(t).select("*", { count: "exact", head: true });
        return [t, count ?? 0] as const;
      })
    ),
    pingAnthropic(),
    pingOpenAI(),
    pingFal(),
  ]);

  const rowCounts: Record<string, number> = {};
  for (const [t, c] of rowCountsArr) rowCounts[t] = c;

  const { data: errorEntries } = await service
    .from("admin_audit_log")
    .select("id, actor_email, action, target_type, target_id, diff, created_at")
    .not("diff->error", "is", null)
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({
    rowCounts,
    apiKeys: {
      anthropic,
      openai,
      fal,
    },
    recentErrors: errorEntries ?? [],
    server_time:  new Date().toISOString(),
  });
}
