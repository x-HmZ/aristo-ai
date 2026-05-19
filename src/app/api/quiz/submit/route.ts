/**
 * POST /api/quiz/submit
 *
 * Evaluates a single quiz answer, updates mastery via BKT, writes a
 * quiz_attempts row, and returns feedback.
 * Implements spec §6.6 + §8.4 + §3.5.
 *
 * Phase 6 additions:
 *  - Accepts optional `context` field: "lesson" (default) | "review"
 *  - On context="lesson" first attempt: seeds SRS with 1-day interval
 *  - On context="review": computes next SRS interval via FSRS
 *
 * Body: { questionId, conceptId, questionType, bloomLevel?, question,
 *         correctAnswer, misconceptionTargeted?, difficulty, userAnswer,
 *         context? }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@/lib/supabase/server";
import { requireApproved }           from "@/lib/auth/approval";
import {
  evaluateShortAnswer,
  evaluateObjective,
}                                    from "@/lib/agents/assessment";
import type { QuizQuestion }         from "@/lib/agents/assessment";
import { updateMastery }             from "@/lib/mastery/update";
import { computeNextSRSState, initialSRSUpdate } from "@/lib/srs/scheduler";
import type { SRSState }             from "@/lib/srs/scheduler";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      questionId:              string;
      conceptId:               string;
      questionType:            string;
      bloomLevel?:             string;
      question:                string;
      correctAnswer:           string;
      misconceptionTargeted?:  string;
      difficulty:              number;
      userAnswer:              string;
      context?:                "lesson" | "review";
    };

    const context = body.context ?? "lesson";

    const guard = await requireApproved();
    if (guard.error) return guard.error;
    const { user } = guard;
    const supabase = await createClient();

    // ── Build a minimal QuizQuestion for the evaluators ──────────────────────
    const q: QuizQuestion = {
      id:                    body.questionId,
      concept_id:            body.conceptId,
      question_type:         body.questionType as QuizQuestion["question_type"],
      bloom_level:           (body.bloomLevel ?? "apply") as QuizQuestion["bloom_level"],
      question:              body.question,
      correct_answer:        body.correctAnswer,
      explanation_correct:   "",
      misconception_targeted: body.misconceptionTargeted,
      difficulty:            body.difficulty,
    };

    // ── Evaluate ─────────────────────────────────────────────────────────────
    const isSubjective =
      body.questionType === "short_answer" ||
      body.questionType === "code_debugging";

    const result = isSubjective
      ? await evaluateShortAnswer(q, body.userAnswer)
      : evaluateObjective(q, body.userAnswer);

    // ── Load existing mastery row ─────────────────────────────────────────────
    const { data: existing } = await supabase
      .from("user_concept_mastery")
      .select(
        "mastery_score, assessment_count, srs_interval_days, srs_consecutive_correct, srs_lapses, srs_next_review"
      )
      .eq("user_id", user.id)
      .eq("concept_id", body.conceptId)
      .maybeSingle();

    const currentScore    = existing?.mastery_score    ?? 0.1;
    const assessmentCount = existing?.assessment_count ?? 0;
    const newScore        = updateMastery(currentScore, result.is_correct, body.difficulty);

    // ── Compute SRS fields ────────────────────────────────────────────────────
    let srsFields = {};

    if (context === "review") {
      // Full FSRS update on review answers
      const srsState: SRSState = {
        intervalDays:       existing?.srs_interval_days       ?? 1,
        consecutiveCorrect: existing?.srs_consecutive_correct ?? 0,
        difficulty:         body.difficulty,
        lapses:             existing?.srs_lapses              ?? 0,
      };
      srsFields = computeNextSRSState(srsState, result.is_correct);
    } else if (assessmentCount === 0) {
      // First lesson quiz — seed SRS so the concept appears for review tomorrow
      srsFields = initialSRSUpdate();
    }

    // ── Upsert mastery row ────────────────────────────────────────────────────
    await supabase
      .from("user_concept_mastery")
      .upsert(
        {
          user_id:          user.id,
          concept_id:       body.conceptId,
          mastery_score:    newScore,
          assessment_count: assessmentCount + 1,
          last_assessed:    new Date().toISOString(),
          ...srsFields,
        },
        { onConflict: "user_id,concept_id" }
      );

    // ── Write per-question quiz_attempts row ──────────────────────────────────
    await supabase
      .from("quiz_attempts")
      .insert({
        user_id:               user.id,
        concept_id:            body.conceptId,
        question_type:         body.questionType,
        bloom_level:           body.bloomLevel ?? "apply",
        question:              body.question,
        correct_answer:        body.correctAnswer,
        user_answer:           body.userAnswer,
        is_correct:            result.is_correct,
        score:                 result.score,
        difficulty:            body.difficulty,
        misconception_detected: result.misconception_detected,
        feedback_given:        result.feedback,
        context,
      });

    // ── Log misconception if detected ────────────────────────────────────────
    if (result.misconception_detected) {
      const { error: rpcErr } = await supabase.rpc("increment_misconception", {
        p_user_id:    user.id,
        p_concept_id: body.conceptId,
        p_text:       result.misconception_detected,
      });

      if (rpcErr) {
        await supabase
          .from("user_misconceptions")
          .insert({
            user_id:          user.id,
            concept_id:       body.conceptId,
            misconception:    result.misconception_detected,
            occurrence_count: 1,
          });
      }
    }

    return NextResponse.json({ ...result, new_mastery: newScore });
  } catch (err) {
    console.error("POST /api/quiz/submit error:", err);
    return NextResponse.json({ error: "Evaluation failed" }, { status: 500 });
  }
}
