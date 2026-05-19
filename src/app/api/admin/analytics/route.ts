/**
 * GET /api/admin/analytics
 *
 * Admin-only overview statistics. Uses the post-FSLSM schema:
 *   - expertise distribution from learner_profiles.expertise_level
 *   - Bloom level performance from quiz_attempts (is_correct grouped by bloom_level)
 *   - struggling concepts from quiz_attempts (low accuracy, ≥2 attempts)
 *   - recent attempts (last 10, new schema fields)
 */

import { NextResponse }          from "next/server";
import { createServiceClient }   from "@/lib/supabase/server";
import { verifyAdmin }           from "@/lib/admin/auth";

// ─── GET /api/admin/analytics ──────────────────────────────────────────────────

export async function GET() {
  const user = await verifyAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: totalStudents },
    { count: studentsThisWeek },
    { count: publishedCourses },
    { data: learnerProfiles },
    { data: rawAttempts },
  ] = await Promise.all([
    service.from("profiles").select("*", { count: "exact", head: true }),
    service
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", weekAgo),
    service
      .from("courses")
      .select("*", { count: "exact", head: true })
      .eq("is_published", true),
    service.from("learner_profiles").select("expertise_level"),
    service
      .from("quiz_attempts")
      .select("concept_id, bloom_level, is_correct, created_at, concepts(name)")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  type AttemptRow = {
    concept_id: string | null;
    bloom_level: string | null;
    is_correct: boolean | null;
    created_at: string;
    concepts: { name: string } | { name: string }[] | null;
  };

  const attempts = (rawAttempts ?? []) as unknown as AttemptRow[];

  // Supabase may return concepts as an array or object depending on the FK relationship
  const conceptName = (row: AttemptRow): string | null => {
    if (!row.concepts) return null;
    const c = Array.isArray(row.concepts) ? row.concepts[0] : row.concepts;
    return c?.name ?? null;
  };

  // ── Expertise distribution ──────────────────────────────────────────────────
  const expertiseCount: Record<string, number> = {};
  (learnerProfiles ?? []).forEach((p) => {
    const lvl = p.expertise_level ?? "beginner";
    expertiseCount[lvl] = (expertiseCount[lvl] ?? 0) + 1;
  });
  const total = totalStudents ?? 0;
  const expertiseDistribution = (["beginner", "intermediate", "advanced"] as const).map(
    (level) => ({
      level,
      count: expertiseCount[level] ?? 0,
      pct:   total > 0 ? Math.round(((expertiseCount[level] ?? 0) / total) * 100) : 0,
    })
  );

  // ── Bloom level performance ─────────────────────────────────────────────────
  const bloomAgg: Record<string, { correct: number; total: number }> = {};
  attempts.forEach((a) => {
    if (!a.bloom_level) return;
    bloomAgg[a.bloom_level] ??= { correct: 0, total: 0 };
    bloomAgg[a.bloom_level].total++;
    if (a.is_correct) bloomAgg[a.bloom_level].correct++;
  });
  const bloomPerformance = Object.entries(bloomAgg)
    .map(([bloom, { correct, total: t }]) => ({
      bloom,
      accuracy: t > 0 ? Math.round((correct / t) * 100) : 0,
      count:    t,
    }))
    .sort((a, b) => a.accuracy - b.accuracy);

  // ── Struggling concepts ─────────────────────────────────────────────────────
  const conceptAgg: Record<string, { correct: number; total: number; name: string }> = {};
  attempts.forEach((a) => {
    if (!a.concept_id) return;
    conceptAgg[a.concept_id] ??= {
      correct: 0,
      total:   0,
      name:    conceptName(a) ?? a.concept_id,
    };
    conceptAgg[a.concept_id].total++;
    if (a.is_correct) conceptAgg[a.concept_id].correct++;
  });

  const strugglingTopics = Object.entries(conceptAgg)
    .filter(([, { total: t }]) => t >= 2)
    .map(([, { correct, total: t, name }]) => ({
      topic:    name,
      avgScore: t > 0 ? Math.round((correct / t) * 100) : 0,
      attempts: t,
    }))
    .sort((a, b) => a.avgScore - b.avgScore)
    .slice(0, 8);

  // ── Overall quiz score ──────────────────────────────────────────────────────
  const correctCount = attempts.filter((a) => a.is_correct).length;
  const avgQuizScore = attempts.length > 0
    ? Math.round((correctCount / attempts.length) * 100)
    : 0;

  // ── Recent attempts ─────────────────────────────────────────────────────────
  const recentAttempts = attempts.slice(0, 10).map((a) => ({
    topic:      conceptName(a) ?? a.concept_id ?? "Unknown",
    bloom:      a.bloom_level    ?? "—",
    is_correct: a.is_correct     ?? false,
    at:         a.created_at,
  }));

  return NextResponse.json({
    stats: {
      totalStudents:     totalStudents    ?? 0,
      studentsThisWeek:  studentsThisWeek ?? 0,
      publishedCourses:  publishedCourses ?? 0,
      avgQuizScore,
      totalQuizAttempts: attempts.length,
    },
    expertiseDistribution,
    bloomPerformance,
    strugglingTopics,
    recentAttempts,
  });
}
