/**
 * AssessmentAgent
 *
 * Generates quiz questions and evaluates answers.
 * Implements spec §6, §8.3-8.4.
 *
 * - generateQuestions()   → Claude Sonnet (§8.3)
 * - evaluateShortAnswer() → Claude Haiku  (§8.4)
 */

import type Anthropic              from "@anthropic-ai/sdk";
import type { BloomLevel }          from "@/lib/mastery/update";
import { v4 as uuidv4 }            from "uuid";
import { MODELS }                  from "./models";
import { getAnthropic }            from "@/lib/llm/anthropic";

const client = getAnthropic();

// ─── Shared tool schemas ─────────────────────────────────────────────────────

const questionItemSchema = {
  type: "object",
  properties: {
    question_type: {
      type: "string",
      enum: [
        "multiple_choice", "true_false", "fill_blank", "short_answer",
        "code_completion", "code_debugging", "ordering", "matching",
      ],
    },
    bloom_level: {
      type: "string",
      enum: ["remember", "understand", "apply", "analyze", "evaluate", "create"],
    },
    question:               { type: "string" },
    options:                { type: "array", items: { type: "string" } },
    items:                  { type: "array", items: { type: "string" } },
    matches:                { type: "array", items: { type: "string" } },
    correct_answer:         { type: "string" },
    explanation_correct:    { type: "string" },
    explanation_wrong:      { type: "object", additionalProperties: { type: "string" } },
    misconception_targeted: { type: "string" },
    difficulty:             { type: "number" },
    estimated_seconds:      { type: "number" },
  },
  required: [
    "question_type", "bloom_level", "question",
    "correct_answer", "explanation_correct", "difficulty",
  ],
} as const;

const questionsTool: Anthropic.Tool = {
  name: "deliver_questions",
  description: "Return the generated quiz questions.",
  input_schema: {
    type: "object",
    properties: {
      questions: { type: "array", items: questionItemSchema },
    },
    required: ["questions"],
  },
};

const evaluationTool: Anthropic.Tool = {
  name: "deliver_evaluation",
  description: "Return the evaluation of a student's short answer.",
  input_schema: {
    type: "object",
    properties: {
      is_correct:             { type: "boolean" },
      score:                  { type: "number" },
      feedback:               { type: "string" },
      misconception_detected: { type: "string" },
    },
    required: ["is_correct", "score", "feedback"],
  },
};

type RawQuestion = Omit<QuizQuestion, "id" | "concept_id">;

function extractQuestions(response: Anthropic.Message, label: string): RawQuestion[] {
  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(`${label}: model did not return tool_use`);
  }
  const input = toolUse.input as { questions?: RawQuestion[] };
  if (!Array.isArray(input.questions)) {
    throw new Error(`${label}: tool_use missing questions array`);
  }
  return input.questions;
}

function finalizeQuestion(q: RawQuestion, conceptId: string): QuizQuestion {
  return {
    ...q,
    id:         uuidv4(),
    concept_id: conceptId,
    options:                q.options                ?? undefined,
    items:                  q.items                  ?? undefined,
    matches:                q.matches                ?? undefined,
    explanation_wrong:      q.explanation_wrong      ?? undefined,
    misconception_targeted: q.misconception_targeted ?? undefined,
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type QuestionType =
  | "multiple_choice"
  | "true_false"
  | "fill_blank"
  | "short_answer"
  | "code_completion"
  | "code_debugging"
  | "ordering"
  | "matching";

export interface QuizQuestion {
  id:                     string;
  concept_id:             string;
  question_type:          QuestionType;
  bloom_level:            BloomLevel;
  question:               string;
  /** MCQ / true_false options */
  options?:               string[];
  /** ordering: items to sort; matching: left-side terms */
  items?:                 string[];
  /** matching: right-side definitions (same length as items) */
  matches?:               string[];
  /** Canonical answer. For ordering/matching: JSON array string */
  correct_answer:         string;
  explanation_correct:    string;
  /** option text → explanation; used for MCQ distractors */
  explanation_wrong?:     Record<string, string>;
  misconception_targeted?: string;
  difficulty:             number;   // 0.0–1.0
  estimated_seconds?:     number;
}

export interface ConceptMeta {
  id:                     string;
  name:                   string;
  description:            string;
  learning_objectives?:   string[];
  common_misconceptions?: string[];
  bloom_level?:           string;
  domain?:                string;
}

export interface EvaluationResult {
  is_correct:             boolean;
  score:                  number;   // 0.0–1.0
  feedback:               string;
  misconception_detected: string | null;
}

// ─── generateQuestions (Sonnet, spec §8.3) ────────────────────────────────────

/**
 * Generates quiz questions for a concept.
 * Asks for a mixed set; question_type / bloom_level hints can be overridden per
 * question by the LLM to make the set pedagogically varied.
 */
export async function generateQuestions(
  concept:      ConceptMeta,
  bloomLevel:   BloomLevel,
  questionType: QuestionType,
  difficulty:   number,
  count:        number
): Promise<QuizQuestion[]> {

  const prompt = `You are an assessment expert. Generate ${count} quiz question(s) for the following concept.

<concept>
Name: ${concept.name}
Description: ${concept.description}
Learning objectives: ${JSON.stringify(concept.learning_objectives ?? [])}
Common misconceptions: ${JSON.stringify(concept.common_misconceptions ?? [])}
</concept>

<requirements>
Target Bloom's level: ${bloomLevel}
Preferred question type: ${questionType}
Difficulty: ${difficulty.toFixed(2)} (0.0 = easy, 1.0 = hard)
Number of questions: ${count}
</requirements>

<rules>
- You may use any of: multiple_choice, true_false, fill_blank, short_answer, code_completion, code_debugging, ordering, matching
- For multiple_choice: Generate exactly 4 options (one correct, three plausible distractors based on common misconceptions).
- For true_false: Include a statement that tests understanding, not trivial recall. options must be ["True", "False"].
- For fill_blank: Write a sentence with exactly one ____ placeholder. correct_answer is the missing term(s).
- For short_answer: An open-ended question. correct_answer is the ideal answer for comparison. No options needed.
- For code_completion: Include realistic code with ONE ____ placeholder. correct_answer is the code to fill in.
- For code_debugging: Show buggy code. correct_answer is the corrected line(s) only.
- For ordering: items is the shuffled list; correct_answer is a JSON array of the correct order (same strings).
- For matching: items is left-side terms; matches is right-side definitions; correct_answer is a JSON array of pairs [term, definition] in the correct pairing.
- Make distractors plausible — base them on the misconceptions listed above.
- Every question must have explanation_correct (why the right answer is right) and for MCQ/true_false also explanation_wrong (option→why it's wrong).
- Keep questions focused. One concept at a time.
</rules>

Return your response by calling the deliver_questions tool.`;

  const response = await client.messages.create(
    {
      model:       MODELS.assessment,
      max_tokens:  2048,
      tools:       [questionsTool],
      tool_choice: { type: "tool", name: "deliver_questions" },
      messages:    [{ role: "user", content: prompt }],
    },
    { feature: "quiz.questions" }
  );

  const raw = extractQuestions(response, "AssessmentAgent.generateQuestions");
  return raw.map((q) => finalizeQuestion(q, concept.id));
}

// ─── Mixed question set for a post-lesson quiz ────────────────────────────────

/**
 * Generates a mixed set of 3–5 questions for a post-lesson quiz.
 * Uses Sonnet to produce pedagogically varied types + bloom levels.
 */
export async function generateLessonQuiz(
  concept:            ConceptMeta,
  mastery:            number,          // current mastery score 0.0–1.0
  count:              number = 4,
  openMisconceptions: string[] = []    // student's recorded, unresolved misconceptions for this concept
): Promise<QuizQuestion[]> {

  const difficulty = Math.min(1.0, mastery + 0.15);

  // Pick a pedagogically sensible mix
  const typeHint = concept.domain?.includes("python") || concept.domain?.includes("programming")
    ? "Include at least one code_completion or code_debugging question if the concept involves code."
    : "Include a variety of types suited to the concept.";

  const misconceptionRule = openMisconceptions.length > 0
    ? `- This student has a RECORDED, unresolved misconception on this concept (see <open_misconceptions>). Make EXACTLY ONE question directly target the FIRST listed misconception, and set that question's misconception_targeted field to the EXACT text of that misconception, copied verbatim (no paraphrasing) — this lets the system detect and clear it when answered correctly. Do not target more than one recorded misconception in this quiz.`
    : `- No recorded misconceptions for this student on this concept — use misconception_targeted normally for any distractor-based reasoning.`;

  const prompt = `You are an assessment expert. Generate exactly ${count} quiz questions for the following concept, varying the question types and Bloom's taxonomy levels to build a comprehensive picture of understanding.

<concept>
Name: ${concept.name}
Description: ${concept.description}
Learning objectives: ${JSON.stringify(concept.learning_objectives ?? [])}
Common misconceptions: ${JSON.stringify(concept.common_misconceptions ?? [])}
</concept>

<open_misconceptions>
${openMisconceptions.length > 0 ? openMisconceptions.map((m) => `- ${m}`).join("\n") : "None recorded."}
</open_misconceptions>

<requirements>
Overall difficulty: ${difficulty.toFixed(2)} (0.0 = very easy, 1.0 = very hard)
Total questions: ${count}
${typeHint}
Start with lower Bloom's levels (remember/understand) and progress to higher ones (apply/analyze).
</requirements>

<rules>
- Available types: multiple_choice, true_false, fill_blank, short_answer, code_completion, code_debugging, ordering, matching
- For multiple_choice: 4 options (1 correct, 3 plausible distractors based on common misconceptions).
- For true_false: options must be exactly ["True", "False"]. Require the learner to think, not just guess.
- For fill_blank: sentence with exactly one ____ placeholder; correct_answer is the word/phrase.
- For short_answer: open-ended; correct_answer is the model answer for LLM comparison.
- For code_completion: code snippet with exactly one ____ ; correct_answer is the fill.
- For code_debugging: buggy code snippet; correct_answer is the corrected code.
- For ordering: items is the shuffled list; correct_answer is a JSON-stringified array of the items in the correct order.
- For matching: items are left-side terms; matches are right-side definitions; correct_answer is a JSON-stringified array of [term, definition] pairs in the correct matching.
- Every question must have explanation_correct. MCQ/true_false must also have explanation_wrong (map option → reason it's wrong).
- Keep each question focused. Do NOT ask the same thing twice.
${misconceptionRule}
</rules>

Return your response by calling the deliver_questions tool with exactly ${count} questions.`;

  const response = await client.messages.create(
    {
      model:       MODELS.assessment,
      max_tokens:  3000,
      tools:       [questionsTool],
      tool_choice: { type: "tool", name: "deliver_questions" },
      messages:    [{ role: "user", content: prompt }],
    },
    { feature: "quiz.lesson" }
  );

  const raw = extractQuestions(response, "AssessmentAgent.generateLessonQuiz");
  return raw.slice(0, count).map((q) => finalizeQuestion(q, concept.id));
}

// ─── generateReviewQuestion (Haiku, Phase 6 SRS) ─────────────────────────────

/**
 * Generates 1–2 review questions for a concept using Haiku (fast, cheap).
 * Targets remember/understand Bloom's levels to reinforce long-term retention.
 * Called by GET /api/quiz/review for each due concept in parallel.
 */
export async function generateReviewQuestion(
  concept: ConceptMeta,
  mastery: number
): Promise<QuizQuestion[]> {
  const count      = mastery < 0.5 ? 2 : 1;
  const difficulty = Math.min(0.85, mastery + 0.1);

  const prompt = `Generate ${count} spaced-repetition review question${count > 1 ? "s" : ""} for a student revisiting this concept.

<concept>
Name: ${concept.name}
Description: ${concept.description}
Learning objectives: ${JSON.stringify(concept.learning_objectives ?? [])}
Common misconceptions: ${JSON.stringify(concept.common_misconceptions ?? [])}
</concept>

<requirements>
Student mastery: ${mastery.toFixed(2)} (0=novice, 1=expert)
Difficulty: ${difficulty.toFixed(2)}
Focus: Bloom's levels "remember" or "understand" — test retention, not new application.
Preferred types: multiple_choice, true_false, fill_blank (quick to answer).
</requirements>

Return your response by calling the deliver_questions tool with ${count} question${count > 1 ? "s" : ""}.`;

  const response = await client.messages.create(
    {
      model:       MODELS.fast,
      max_tokens:  1024,
      tools:       [questionsTool],
      tool_choice: { type: "tool", name: "deliver_questions" },
      messages:    [{ role: "user", content: prompt }],
    },
    { feature: "quiz.review" }
  );

  const raw = extractQuestions(response, "generateReviewQuestion");
  return raw.slice(0, count).map((q) => finalizeQuestion(q, concept.id));
}

// ─── evaluateShortAnswer (Haiku, spec §8.4) ───────────────────────────────────

export async function evaluateShortAnswer(
  question:   QuizQuestion,
  userAnswer: string
): Promise<EvaluationResult> {

  const prompt = `You are evaluating a student's answer. Be encouraging but accurate.

Question: ${question.question}
Expected answer: ${question.correct_answer}
Student's answer: ${userAnswer}
Concept: ${question.concept_id}
Known misconceptions: ${question.misconception_targeted ?? "none specified"}

RULES:
- Never just "Correct!" or "Wrong!" — always explain.
- Partial credit (score 0.0–1.0) is allowed where appropriate.
- If you detect a misconception, name it specifically in misconception_detected.
- Keep feedback to 2-4 sentences.

Return your response by calling the deliver_evaluation tool.`;

  try {
    const response = await client.messages.create(
      {
        model:       MODELS.fast,
        max_tokens:  512,
        tools:       [evaluationTool],
        tool_choice: { type: "tool", name: "deliver_evaluation" },
        messages:    [{ role: "user", content: prompt }],
      },
      { feature: "quiz.eval_short" }
    );

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("evaluateShortAnswer: model did not return tool_use");
    }

    const out = toolUse.input as {
      is_correct:             boolean;
      score:                  number;
      feedback:               string;
      misconception_detected?: string | null;
    };

    return {
      is_correct:             out.is_correct,
      score:                  out.score,
      feedback:               out.feedback,
      misconception_detected: out.misconception_detected ?? null,
    };
  } catch {
    return {
      is_correct:             false,
      score:                  0,
      feedback:               "Could not evaluate answer. Please try again.",
      misconception_detected: null,
    };
  }
}

// ─── Objective answer evaluation ──────────────────────────────────────────────

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
