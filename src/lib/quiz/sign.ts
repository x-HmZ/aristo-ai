/**
 * Signed quiz answer keys. Quiz questions are not stored on the server, so /api/quiz/submit used to grade
 * against whatever `correctAnswer` the browser sent. Now the server signs each question when it issues it and
 * verifies the signature before grading: a forged answer key, concept, type, Bloom level, targeted
 * misconception, question text, difficulty or issuing context no longer verifies. Bloom level and the
 * misconception text reach the grader prompt and the mastery update, and the context decides whether the
 * spaced-repetition schedule is advanced, so none of them may be client-chosen. Server-only (Node crypto);
 * never import this from a client component.
 *
 * Version marker: the label below. v2 added bloom_level, misconception_targeted and context; a v1 signature
 * (a quiz fetched before the change) fails verification and the client falls back to local grading.
 */

import { hmacHex, verifyHmacHex } from "@/lib/guard/sign";

const LABEL = "aristo/quiz-answer/v2" as const;

/** Where a question was issued: the lesson quiz route or the daily review route. */
export type QuizIssueContext = "lesson" | "review";

/** The fields the signature covers. */
export interface SignedQuestionFields {
  id:                      string;
  concept_id:              string;
  question_type:           string;
  bloom_level:             string;
  question:                string;
  correct_answer:          string;
  misconception_targeted?: string;
  difficulty:              number;
}

function message(q: SignedQuestionFields, context: QuizIssueContext): string {
  return JSON.stringify([
    q.id, q.concept_id, q.question_type, q.bloom_level, q.question, q.correct_answer,
    q.misconception_targeted ?? "", q.difficulty, context,
  ]);
}

export function signQuestion(q: SignedQuestionFields, context: QuizIssueContext): string {
  return hmacHex(LABEL, message(q, context));
}

export function verifyQuestion(q: SignedQuestionFields, context: QuizIssueContext, signature: unknown): boolean {
  return verifyHmacHex(LABEL, message(q, context), signature);
}

/**
 * Copy of each question with `answer_sig` set, bound to the route that issues it. Difficulty is clamped to 0..1
 * first (the model is asked for that range but not held to it), so the value that is signed is the value
 * /api/quiz/submit will accept.
 */
export function signQuestions<T extends SignedQuestionFields>(
  questions: T[],
  context: QuizIssueContext,
): Array<T & { answer_sig: string }> {
  return questions.map((raw) => {
    const d = Number.isFinite(raw.difficulty) ? Math.min(1, Math.max(0, raw.difficulty)) : 0.5;
    const q = { ...raw, difficulty: d };
    return { ...q, answer_sig: signQuestion(q, context) };
  });
}
