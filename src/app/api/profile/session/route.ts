/**
 * POST /api/profile/session
 *
 * Session signal flush — called at the end of every learning session.
 * Implements Phase 7: Behavioral Profiling (spec §3.4).
 *
 * Steps:
 *  1. Write a session_logs row for this session
 *  2. Compute per-Bloom accuracy from recent quiz_attempts (last 30 days)
 *  3. Load the learner's current dynamic profile
 *  4. Run ProfilerAgent.updateDynamicProfile() (rule-based, no LLM)
 *  5. Upsert learner_profiles row
 *  6. Return the updated profile
 *
 * Body: {
 *   signals:        BehavioralSignals,
 *   sessionStart:   ISO string,
 *   conceptsViewed: string[]
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@/lib/supabase/server";
import {
  updateDynamicProfile,
  computeBloomAccuracy,
}                                    from "@/lib/agents/profiler";
import type { BehavioralSignals }    from "@/store/useAristoStore";
import type { DynamicProfile }       from "@/store/useAristoStore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      signals:        BehavioralSignals;
      sessionStart:   string;
      conceptsViewed: string[];
    };

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { signals, sessionStart, conceptsViewed } = body;

    // ── 1. Write session_logs row ─────────────────────────────────────────────
    const sessionEnd    = new Date().toISOString();
    const quizAccuracy  = signals.questions_attempted > 0
      ? signals.questions_correct / signals.questions_attempted
      : null;

    await supabase
      .from("session_logs")
      .insert({
        user_id:                      user.id,
        session_start:                sessionStart,
        session_end:                  sessionEnd,
        concepts_viewed:              conceptsViewed,
        time_on_explanations_seconds: signals.time_on_explanations_seconds,
        time_on_examples_seconds:     signals.time_on_examples_seconds,
        time_on_quizzes_seconds:      signals.time_on_quizzes_seconds,
        clicked_explain_more:         signals.clicked_explain_more,
        clicked_show_example:         signals.clicked_show_example,
        clicked_skip_to_quiz:         signals.clicked_skip_to_quiz,
        quiz_accuracy:                quizAccuracy,
        questions_attempted:          signals.questions_attempted,
        questions_correct:            signals.questions_correct,
      });

    // ── 2. Compute per-Bloom accuracy from last 30 days ───────────────────────
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: recentAttempts } = await supabase
      .from("quiz_attempts")
      .select("bloom_level, is_correct")
      .eq("user_id", user.id)
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(100);

    const bloomAccuracy = computeBloomAccuracy(recentAttempts ?? []);

    // ── 3. Load current dynamic profile ──────────────────────────────────────
    const { data: lpRow } = await supabase
      .from("learner_profiles")
      .select("expertise_level, pace, explanation_depth, example_preference, weakest_bloom_level, strongest_bloom_level")
      .eq("user_id", user.id)
      .maybeSingle();

    const currentProfile: DynamicProfile | null = lpRow
      ? {
          expertise_level:    lpRow.expertise_level    ?? "beginner",
          pace:               lpRow.pace               ?? "moderate",
          explanation_depth:  lpRow.explanation_depth  ?? "moderate",
          example_preference: lpRow.example_preference ?? "concrete",
          weakest_bloom_level:   lpRow.weakest_bloom_level   ?? undefined,
          strongest_bloom_level: lpRow.strongest_bloom_level ?? undefined,
        }
      : null;

    // ── 4. Run profiler (rule-based) ──────────────────────────────────────────
    const updatedProfile = updateDynamicProfile(currentProfile, signals, bloomAccuracy);

    // ── 5. Upsert learner_profiles ────────────────────────────────────────────
    await supabase
      .from("learner_profiles")
      .upsert(
        {
          user_id:               user.id,
          expertise_level:       updatedProfile.expertise_level,
          pace:                  updatedProfile.pace,
          explanation_depth:     updatedProfile.explanation_depth,
          example_preference:    updatedProfile.example_preference,
          weakest_bloom_level:   updatedProfile.weakest_bloom_level  ?? null,
          strongest_bloom_level: updatedProfile.strongest_bloom_level ?? null,
          updated_at:            new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    return NextResponse.json({ updated_profile: updatedProfile });
  } catch (err) {
    console.error("POST /api/profile/session error:", err);
    return NextResponse.json({ error: "Session flush failed" }, { status: 500 });
  }
}
