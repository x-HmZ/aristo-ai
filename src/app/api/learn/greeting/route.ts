/**
 * GET  /api/learn/greeting  — session-open synthesis (V4 "teacher memory")
 * POST /api/learn/greeting  — logs whether the suggested action was tapped
 *
 * Builds a compact context from EXISTING tables (session_logs,
 * user_concept_mastery, user_misconceptions, user_course_progress) and,
 * for a returning student, asks GreetingAgent (Haiku) for a short spoken
 * greeting + one suggested action. Brand-new students (no session_logs and
 * no mastery rows yet) get a deterministic fallback greeting with no LLM
 * call at all.
 *
 * Caching: the client (LearnClient) caches the response in sessionStorage
 * per calendar day, so this route is hit at most once per day per user.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@/lib/supabase/server";
import { requireApproved }           from "@/lib/auth/approval";
import { getOverdueCount }           from "@/lib/srs/queue";
import { logUsage }                  from "@/lib/llm/usage";
import {
  generateGreeting,
  type GreetingContext,
  type GreetingResult,
  type SuggestedActionType,
}                                     from "@/lib/agents/greeting";

const ACTION_TYPES: SuggestedActionType[] = ["resume_course", "review", "new_topic"];

function priorityAction(overdueCount: number, hasCourseInProgress: boolean): GreetingResult["suggested_action"] {
  if (overdueCount > 0) {
    return { type: "review", label: `Catch up on ${overdueCount} review${overdueCount === 1 ? "" : "s"}` };
  }
  if (hasCourseInProgress) {
    return { type: "resume_course", label: "Continue where you left off" };
  }
  return { type: "new_topic", label: "Explore something new" };
}

/** Consecutive-day streak ending today, mirroring /api/profile/analytics. */
function computeStreak(sessionStarts: string[]): number {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const dates = new Set(sessionStarts.map((s) => new Date(s).toISOString().slice(0, 10)));
  let streak = 0;
  const cur = new Date(todayStart);
  while (dates.has(cur.toISOString().slice(0, 10))) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

export async function GET(_req: NextRequest) {
  try {
    const guard = await requireApproved();
    if (guard.error) return guard.error;
    const { user } = guard;
    const supabase = await createClient();

    const sixtyAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

    const [
      profileRes,
      sessionsRes,
      masteryCountRes,
      strongConceptRes,
      misconceptionRes,
      courseProgressRes,
      overdueCount,
    ] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      supabase
        .from("session_logs")
        .select("session_start, concepts_viewed")
        .eq("user_id", user.id)
        .gte("session_start", sixtyAgo)
        .order("session_start", { ascending: false }),
      supabase
        .from("user_concept_mastery")
        .select("concept_id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("user_concept_mastery")
        .select("concept_id, last_assessed, concepts(name)")
        .eq("user_id", user.id)
        .gte("mastery_score", 0.8)
        .order("last_assessed", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("user_misconceptions")
        .select("concept_id, misconception, last_detected, concepts(name)")
        .eq("user_id", user.id)
        .eq("resolved", false)
        .order("last_detected", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("user_course_progress")
        .select("course_id")
        .eq("user_id", user.id)
        .eq("status", "in_progress")
        .limit(1)
        .maybeSingle(),
      getOverdueCount(user.id, supabase),
    ]);

    const firstName = profileRes.data?.full_name?.split(" ")[0] ?? "there";
    const sessions   = sessionsRes.data ?? [];
    const hasCourseInProgress = !!courseProgressRes.data?.course_id;

    const isNewUser = sessions.length === 0 && (masteryCountRes.count ?? 0) === 0;

    // ── Brand-new user: deterministic fallback, no LLM call ──────────────────
    if (isNewUser) {
      const fallback: GreetingResult = {
        greeting_speech: `Hi ${firstName}! Ready to dive into something new today? Pick a topic or course below and let's get started.`,
        suggested_action: { type: "new_topic", label: "Pick something to explore" },
      };
      return NextResponse.json({ ...fallback, source: "fallback" });
    }

    // ── Returning user: build context + call GreetingAgent ───────────────────
    const lastSession = sessions[0] ?? null;
    const daysSinceLastSession = lastSession
      ? Math.floor((Date.now() - new Date(lastSession.session_start).getTime()) / (24 * 60 * 60 * 1000))
      : null;

    let lastConceptsViewed: string[] = [];
    const viewedIds = (lastSession?.concepts_viewed as string[] | null ?? []).slice(0, 2);
    if (viewedIds.length > 0) {
      const { data: conceptRows } = await supabase
        .from("concepts")
        .select("id, name")
        .in("id", viewedIds);
      const nameById = new Map((conceptRows ?? []).map((c) => [c.id, c.name] as const));
      lastConceptsViewed = viewedIds.map((id) => nameById.get(id) ?? id);
    }

    type ConceptRef = { name: string } | { name: string }[] | null;
    const asName = (c: ConceptRef): string | null => {
      if (!c) return null;
      return Array.isArray(c) ? c[0]?.name ?? null : c.name;
    };

    const strongConcept = asName(strongConceptRes.data?.concepts as ConceptRef ?? null);

    const miscRow = misconceptionRes.data;
    const topOpenMisconception = miscRow
      ? {
          conceptName: asName(miscRow.concepts as ConceptRef) ?? miscRow.concept_id,
          text:        miscRow.misconception,
        }
      : null;

    const streakDays = computeStreak(sessions.map((s) => s.session_start));

    const allowedActions: SuggestedActionType[] = ["new_topic"];
    if (hasCourseInProgress) allowedActions.unshift("resume_course");
    if (overdueCount > 0) allowedActions.unshift("review");

    const ctx: GreetingContext = {
      firstName,
      daysSinceLastSession,
      lastConceptsViewed,
      topOpenMisconception,
      strongConcept,
      overdueReviewCount: overdueCount,
      streakDays,
      hasCourseInProgress,
      allowedActions,
    };

    const fallbackAction = priorityAction(overdueCount, hasCourseInProgress);

    try {
      const result = await generateGreeting(ctx);
      // Defence-in-depth: the model must pick from the allowed list; if it
      // didn't, fall back to the deterministic priority action rather than
      // surfacing a chip that navigates nowhere useful.
      if (!ACTION_TYPES.includes(result.suggested_action.type) || !allowedActions.includes(result.suggested_action.type)) {
        result.suggested_action = fallbackAction;
      }
      return NextResponse.json({ ...result, source: "generated" });
    } catch (err) {
      console.warn("[greeting] GreetingAgent failed, using deterministic fallback (non-fatal)", err);
      const fallback: GreetingResult = {
        greeting_speech: `Welcome back, ${firstName}! Let's keep the momentum going.`,
        suggested_action: fallbackAction,
      };
      return NextResponse.json({ ...fallback, source: "fallback" });
    }
  } catch (err) {
    console.error("GET /api/learn/greeting error:", err);
    return NextResponse.json({ error: "Failed to build greeting" }, { status: 500 });
  }
}

// ─── Signal logging ──────────────────────────────────────────────────────────

interface GreetingActionBody {
  actionType: SuggestedActionType;
  taken:      boolean;
}

function isValidBody(body: unknown): body is GreetingActionBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return ACTION_TYPES.includes(b.actionType as SuggestedActionType) && typeof b.taken === "boolean";
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireApproved();
    if (guard.error) return guard.error;
    const { user } = guard;

    const body = await req.json();
    if (!isValidBody(body)) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    // Fire-and-forget, zero-cost product signal. No dedicated signals table
    // exists (and adding one is out of scope for a DDL-free feature), so we
    // reuse usage_events — it already supports arbitrary metadata and is
    // queryable by feature for "did the suggestion get used" analysis.
    logUsage({
      user_id:          user.id,
      provider:         "internal",
      model:            "n/a",
      feature:          "signal.greeting_action_taken",
      cost_usd_micros:  0,
      metadata:         { action_type: body.actionType, taken: body.taken },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/learn/greeting error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
