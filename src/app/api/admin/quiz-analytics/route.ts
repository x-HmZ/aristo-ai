/**
 * GET /api/admin/quiz-analytics
 *
 * Aggregated stats over quiz_attempts:
 *   - byBloom      : accuracy per bloom level
 *   - byType       : accuracy per question_type
 *   - calibration  : declared difficulty bucket vs. actual accuracy
 *   - trend        : rolling 7-day accuracy
 *
 * Query: ?concept_id=&domain=&from=ISO&to=ISO
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient }       from "@/lib/supabase/server";
import { verifyAdmin }               from "@/lib/admin/auth";

type Attempt = {
  bloom_level:           string | null;
  question_type:         string;
  is_correct:            boolean | null;
  difficulty:            number | null;
  response_time_seconds: number | null;
  created_at:            string;
  concepts: { domain: string } | { domain: string }[] | null;
};

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url        = new URL(req.url);
  const concept_id = url.searchParams.get("concept_id") ?? "";
  const domain     = url.searchParams.get("domain") ?? "";
  const from       = url.searchParams.get("from");
  const to         = url.searchParams.get("to");

  const service = createServiceClient();
  let q = service
    .from("quiz_attempts")
    .select(
      "bloom_level, question_type, is_correct, difficulty, response_time_seconds, created_at, concepts!quiz_attempts_concept_id_fkey(domain)"
    )
    .order("created_at", { ascending: false })
    .limit(5000);

  if (concept_id) q = q.eq("concept_id", concept_id);
  if (from)       q = q.gte("created_at", from);
  if (to)         q = q.lte("created_at", to);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let attempts = (data ?? []) as Attempt[];

  // Post-filter on domain (FK join)
  if (domain) {
    attempts = attempts.filter((a) => {
      const c = Array.isArray(a.concepts) ? a.concepts[0] : a.concepts;
      return c?.domain === domain;
    });
  }

  // ── byBloom ────────────────────────────────────────────────────────────────
  const bloomAgg: Record<string, { correct: number; total: number }> = {};
  for (const a of attempts) {
    if (!a.bloom_level) continue;
    bloomAgg[a.bloom_level] ??= { correct: 0, total: 0 };
    bloomAgg[a.bloom_level].total++;
    if (a.is_correct) bloomAgg[a.bloom_level].correct++;
  }
  const byBloom = Object.entries(bloomAgg).map(([bloom, { correct, total }]) => ({
    bloom,
    accuracy: total > 0 ? +((correct / total) * 100).toFixed(1) : 0,
    count:    total,
  }));

  // ── byType ─────────────────────────────────────────────────────────────────
  const typeAgg: Record<string, { correct: number; total: number; avg_time: number; time_n: number }> = {};
  for (const a of attempts) {
    typeAgg[a.question_type] ??= { correct: 0, total: 0, avg_time: 0, time_n: 0 };
    const t = typeAgg[a.question_type];
    t.total++;
    if (a.is_correct) t.correct++;
    if (a.response_time_seconds !== null && a.response_time_seconds !== undefined) {
      t.avg_time += a.response_time_seconds;
      t.time_n++;
    }
  }
  const byType = Object.entries(typeAgg).map(([type, { correct, total, avg_time, time_n }]) => ({
    type,
    accuracy:        total > 0 ? +((correct / total) * 100).toFixed(1) : 0,
    count:           total,
    avg_response_s:  time_n > 0 ? +(avg_time / time_n).toFixed(1) : null,
  }));

  // ── Calibration (declared difficulty bucket vs actual accuracy) ────────────
  // Bucket 0.1 wide, require n ≥ 20 per bucket to surface.
  const buckets: Record<string, { correct: number; total: number; sum_difficulty: number }> = {};
  for (const a of attempts) {
    if (a.difficulty === null || a.difficulty === undefined) continue;
    const b = Math.min(0.95, Math.max(0.05, Math.round(a.difficulty * 10) / 10));
    const key = b.toFixed(1);
    buckets[key] ??= { correct: 0, total: 0, sum_difficulty: 0 };
    buckets[key].total++;
    buckets[key].sum_difficulty += a.difficulty;
    if (a.is_correct) buckets[key].correct++;
  }
  const calibration = Object.entries(buckets)
    .filter(([, v]) => v.total >= 20)
    .map(([bucket, v]) => ({
      difficulty: +bucket,
      accuracy:   +(v.correct / v.total).toFixed(3),
      n:          v.total,
    }))
    .sort((a, b) => a.difficulty - b.difficulty);

  // ── Trend (rolling 7-day) ──────────────────────────────────────────────────
  const dayAgg = new Map<string, { correct: number; total: number }>();
  for (const a of attempts) {
    const day = a.created_at.slice(0, 10);
    if (!dayAgg.has(day)) dayAgg.set(day, { correct: 0, total: 0 });
    const d = dayAgg.get(day)!;
    d.total++;
    if (a.is_correct) d.correct++;
  }
  const trend = Array.from(dayAgg.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, { correct, total }]) => ({
      day,
      accuracy: total > 0 ? +((correct / total) * 100).toFixed(1) : 0,
      count:    total,
    }));

  const totalCorrect = attempts.filter((a) => a.is_correct).length;
  const summary = {
    total_attempts:   attempts.length,
    overall_accuracy: attempts.length > 0
      ? +((totalCorrect / attempts.length) * 100).toFixed(1)
      : 0,
    avg_response_s: (() => {
      const valid = attempts.filter((a) => a.response_time_seconds !== null);
      if (valid.length === 0) return null;
      return +(
        valid.reduce((s, a) => s + (a.response_time_seconds ?? 0), 0) / valid.length
      ).toFixed(1);
    })(),
  };

  return NextResponse.json({ summary, byBloom, byType, calibration, trend });
}
