import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function verifyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  return profile?.is_admin ? user : null;
}

// ─── GET /api/admin/analytics ─────────────────────────────────────────────────

export async function GET() {
  const user = await verifyAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: totalStudents },
    { count: studentsThisWeek },
    { count: publishedCourses },
    { data: profiles },
    { data: quizAttempts },
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
    service.from("profiles").select("learning_style, teaching_flow"),
    service
      .from("quiz_attempts")
      .select("style_used, score, questions, topic, attempted_at")
      .order("attempted_at", { ascending: false })
      .limit(500),
  ]);

  // ── Style & flow distribution ───────────────────────────────────────────────
  const styleCount: Record<string, number> = {};
  const flowCount: Record<string, number> = {};

  (profiles ?? []).forEach((p) => {
    if (p.learning_style)
      styleCount[p.learning_style] = (styleCount[p.learning_style] ?? 0) + 1;
    if (p.teaching_flow)
      flowCount[p.teaching_flow] = (flowCount[p.teaching_flow] ?? 0) + 1;
  });

  const total = totalStudents ?? 0;

  const styleDistribution = Object.entries(styleCount).map(
    ([style, count]) => ({
      style,
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
    })
  );

  const flowDistribution = Object.entries(flowCount).map(([flow, count]) => ({
    flow,
    count,
    pct: total > 0 ? Math.round((count / total) * 100) : 0,
  }));

  // ── Quiz aggregation ────────────────────────────────────────────────────────
  const attempts = quizAttempts ?? [];

  const scoredAttempts = attempts.filter(
    (a) => Array.isArray(a.questions) && a.questions.length > 0
  );

  const avgQuizScore =
    scoredAttempts.length > 0
      ? Math.round(
          scoredAttempts.reduce((sum, a) => {
            const qs = (a.questions as unknown[]).length;
            return sum + (a.score / qs) * 100;
          }, 0) / scoredAttempts.length
        )
      : 0;

  // Quiz by style
  const styleAgg: Record<string, { total: number; count: number }> = {};
  attempts.forEach((a) => {
    if (!a.style_used) return;
    const qs = Array.isArray(a.questions) ? (a.questions as unknown[]).length : 1;
    if (!styleAgg[a.style_used]) styleAgg[a.style_used] = { total: 0, count: 0 };
    styleAgg[a.style_used].total += (a.score / qs) * 100;
    styleAgg[a.style_used].count += 1;
  });

  const quizByStyle = Object.entries(styleAgg).map(
    ([style, { total, count }]) => ({
      style,
      avgScore: Math.round(total / count),
      count,
    })
  );

  // Struggling topics (lowest avg score, min 2 attempts)
  const topicAgg: Record<string, { total: number; count: number }> = {};
  attempts.forEach((a) => {
    if (!a.topic) return;
    const qs = Array.isArray(a.questions) ? (a.questions as unknown[]).length : 1;
    if (!topicAgg[a.topic]) topicAgg[a.topic] = { total: 0, count: 0 };
    topicAgg[a.topic].total += (a.score / qs) * 100;
    topicAgg[a.topic].count += 1;
  });

  const strugglingTopics = Object.entries(topicAgg)
    .map(([topic, { total, count }]) => ({
      topic,
      avgScore: Math.round(total / count),
      attempts: count,
    }))
    .filter((t) => t.attempts >= 2)
    .sort((a, b) => a.avgScore - b.avgScore)
    .slice(0, 8);

  // Recent attempts (last 10)
  const recentAttempts = attempts.slice(0, 10).map((a) => ({
    topic: a.topic,
    score: a.score,
    total: Array.isArray(a.questions) ? (a.questions as unknown[]).length : 5,
    style: a.style_used,
    at: a.attempted_at,
  }));

  return NextResponse.json({
    stats: {
      totalStudents: totalStudents ?? 0,
      studentsThisWeek: studentsThisWeek ?? 0,
      publishedCourses: publishedCourses ?? 0,
      avgQuizScore,
      totalQuizAttempts: attempts.length,
    },
    styleDistribution,
    flowDistribution,
    quizByStyle,
    strugglingTopics,
    recentAttempts,
  });
}
