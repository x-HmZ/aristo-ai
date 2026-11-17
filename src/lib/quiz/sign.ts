/**
 * Signed quiz answer keys. Quiz questions are not stored on the server, so /api/quiz/submit used to grade
 * against whatever `correctAnswer` the browser sent. Now the server signs each question when it issues it and
 * verifies the signature before grading: a forged answer key, concept, type, question text or difficulty no
 * longer verifies. Server-only (Node crypto); never import this from a client component.
 */

import { hmacHex, verifyHmacHex } from "@/lib/guard/sign";

const LABEL = "aristo/quiz-answer/v1" as const;

/** The fields the signature covers. */
export interface SignedQuestionFields {
  id:             string;
  concept_id:     string;
  question_type:  string;
  question:       string;
  correct_answer: string;
  difficulty:     number;
}

function message(q: SignedQuestionFields): string {
  return JSON.stringify([q.id, q.concept_id, q.question_type, q.question, q.correct_answer, q.difficulty]);
}

export function signQuestion(q: SignedQuestionFields): string {
  return hmacHex(LABEL, message(q));
}

export function verifyQuestion(q: SignedQuestionFields, signature: unknown): boolean {
  return verifyHmacHex(LABEL, message(q), signature);
}

/**
 * Copy of each question with `answer_sig` set. Difficulty is clamped to 0..1 first (the model is asked for that
 * range but not held to it), so the value that is signed is the value /api/quiz/submit will accept.
 */
export function signQuestions<T extends SignedQuestionFields>(questions: T[]): Array<T & { answer_sig: string }> {
  return questions.map((raw) => {
    const d = Number.isFinite(raw.difficulty) ? Math.min(1, Math.max(0, raw.difficulty)) : 0.5;
    const q = { ...raw, difficulty: d };
    return { ...q, answer_sig: signQuestion(q) };
  });
}
