/**
 * GET /api/profile/analytics
 *
 * Student-facing learning analytics:
 *   - streak (consecutive days with a session)
 *   - time today / this week (from session_logs)
 *   - mastery overview: total seen, mastered (≥0.8), reviews due
 *   - weak concepts (mastery < 0.5, sorted ascending)
 *   - learner_profile fields (expertise, pace, depth, bloom)
 */

import { NextResponse }  from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekAgo  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000);
    const sixtyAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Parallel fetch: mastery rows, learner profile, last 60 days of session logs
    const [masteryRes, profileRes, sessionsRes] = await Promise.all([
      supabase
        .from("user_concept_mastery")
        .select("concept_id, mastery_score, srs_next_review, concepts(name, domain)")
        .eq("user_id", user.id),
      supabase
        .from("learner_profiles")
        .select("expertise_level, pace, explanation_depth, weakest_bloom_level, strongest_bloom_level")
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("session_logs")
        .select("session_start, time_on_explanations_seconds, time_on_examples_seconds, time_on_quizzes_seconds")
        .eq("user_id", user.id)
        .gte("session_start", sixtyAgo.toISOString())
        .order("session_start", { ascending: false }),
    ]);

    const mastery  = masteryRes.data  ?? [];
    const profile  = profileRes.data;
    const sessions = sessionsRes.data ?? [];

    // ── Streak ──────────────────────────────────────────────────────────────────
    // Count consecutive days ending today that have ≥1 session
    const sessionDates = new Set(
      sessions.map((s) => new Date(s.session_start).toISOString().slice(0, 10))
    );
    let streak = 0;
    const cur = new Date(todayStart);
    while (sessionDates.has(cur.toISOString().slice(0, 10))) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    }

    // ── Time stats ───────────────────────────────────────────────────────────────
    const sumTime = (rows: typeof sessions) =>
      rows.reduce(
        (sum, s) =>
          sum +
          (s.time_on_explanations_seconds ?? 0) +
          (s.time_on_examples_seconds     ?? 0) +
          (s.time_on_quizzes_seconds      ?? 0),
        0
      );

    const time_today_seconds = sumTime(
      sessions.filter((s) => new Date(s.session_start) >= todayStart)
    );
    const time_week_seconds = sumTime(
      sessions.filter((s) => new Date(s.session_start) >= weekAgo)
    );

    // ── Mastery overview ─────────────────────────────────────────────────────────
    const total_concepts_seen = mastery.length;
    const total_mastered      = mastery.filter((m) => Number(m.mastery_score) >= 0.8).length;
    const reviews_due         = mastery.filter(
      (m) => m.srs_next_review && new Date(m.srs_next_review) <= now
    ).length;

    // ── Weak concepts ────────────────────────────────────────────────────────────
    type ConceptRef = { name: string; domain: string } | null;
    const weak_concepts = mastery
      .filter((m) => Number(m.mastery_score) < 0.5)
      .sort((a, b) => Number(a.mastery_score) - Number(b.mastery_score))
      .slice(0, 6)
      .map((m) => {
        const c = m.concepts as unknown as ConceptRef;
        return {
          concept_id:    m.concept_id,
          name:          c?.name   ?? m.concept_id,
          domain:        c?.domain ?? "",
          mastery_score: Number(m.mastery_score),
        };
      });

    return NextResponse.json({
      streak,
      time_today_seconds,
      time_week_seconds,
      total_concepts_seen,
      total_mastered,
      reviews_due,
      weak_concepts,
      learner_profile: profile ?? null,
    });
  } catch (err) {
    console.error("[GET /api/profile/analytics]", err);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
