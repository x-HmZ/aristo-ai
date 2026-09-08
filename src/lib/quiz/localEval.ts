/**
 * localEval — pure, client-safe objective-answer evaluation.
 *
 * Extracted from assessment.ts so it can be imported directly from client
 * components (QuizView) without pulling in that module's top-level
 * `getAnthropic()` client construction, which throws when ANTHROPIC_API_KEY
 * is absent from the bundle (always true client-side). assessment.ts
 * re-exports these for existing server callers (e.g. /api/quiz/submit).
 *
 * No network calls, no side effects — safe to import anywhere.
 */

import type { QuizQuestion } from "@/lib/agents/assessment";

export interface EvaluationResult {
  is_correct:             boolean;
  score:                  number;   // 0.0–1.0
  feedback:               string;
  misconception_detected: string | null;
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[.,;:!?"'`]+$/g, "").replace(/^["'`]+/, "");
}

function tryJsonParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}

/**
 * Evaluates a locally-checkable answer (MCQ, true_false, fill_blank, ordering, matching).
 * Returns an EvaluationResult consistent with evaluateShortAnswer.
 */
export function evaluateObjective(
  question:   QuizQuestion,
  userAnswer: string
): EvaluationResult {
  let isCorrect = false;

  if (question.question_type === "ordering") {
    const expected = tryJsonParse(question.correct_answer);
    const got      = tryJsonParse(userAnswer);
    if (Array.isArray(expected) && Array.isArray(got) && expected.length === got.length) {
      isCorrect = expected.every((v, i) => normalize(String(v)) === normalize(String(got[i])));
    }
  } else if (question.question_type === "matching") {
    // correct_answer / userAnswer: JSON array of [term, definition] pairs.
    // Pair order should not matter; pair contents must match exactly.
    const expected = tryJsonParse(question.correct_answer);
    const got      = tryJsonParse(userAnswer);
    if (
      Array.isArray(expected) && Array.isArray(got) &&
      expected.length === got.length
    ) {
      const key = (pair: unknown) =>
        Array.isArray(pair) ? pair.map((v) => normalize(String(v))).join("→") : "";
      const expectedSet = new Set(expected.map(key));
      isCorrect = got.every((p) => expectedSet.has(key(p)));
    }
  } else {
    // multiple_choice / true_false / fill_blank / code_completion
    isCorrect = normalize(question.correct_answer) === normalize(userAnswer);
  }

  const score = isCorrect ? 1.0 : 0.0;

  let feedback: string;
  if (isCorrect) {
    feedback = question.explanation_correct;
  } else {
    const wrongExp = question.explanation_wrong?.[userAnswer];
    feedback = wrongExp
      ? `Not quite — ${wrongExp} The correct answer is: ${question.correct_answer}. ${question.explanation_correct}`
      : `Not quite. The correct answer is: ${question.correct_answer}. ${question.explanation_correct}`;
  }

  return {
    is_correct:             isCorrect,
    score,
    feedback,
    misconception_detected: isCorrect ? null : (question.misconception_targeted ?? null),
  };
}
