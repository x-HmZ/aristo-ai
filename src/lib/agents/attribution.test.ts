import { beforeEach, describe, expect, it, vi } from "vitest";

// Every paid Anthropic call must carry the calling user's id in its usage tag, or usage_events rows are
// anonymous and a per-user spend ceiling cannot see them.

const create = vi.hoisted(() => vi.fn());
vi.mock("@/lib/llm/anthropic", () => ({ getAnthropic: () => ({ messages: { create } }) }));

import { generateLesson, explainMore } from "@/lib/agents/teaching";
import {
  evaluateShortAnswer,
  generateLessonQuiz,
  generateQuestions,
  generateReviewQuestion,
  type QuizQuestion,
} from "@/lib/agents/assessment";

const concept = { id: "c1", name: "Fractions", description: "Parts of a whole" };

const question = {
  question_type: "multiple_choice",
  bloom_level: "remember",
  question: "q",
  correct_answer: "a",
  explanation_correct: "because",
  difficulty: 0.3,
};

function toolUse(input: unknown) {
  return { content: [{ type: "tool_use", name: "x", input }] };
}

beforeEach(() => {
  create.mockReset();
});

function lastTag() {
  const call = create.mock.calls.at(-1)!;
  return call[1] as { feature: string; userId?: string | null };
}

describe("usage tags carry the user id", () => {
  it("quiz generation, review and lesson quiz", async () => {
    create.mockResolvedValue(toolUse({ questions: [question] }));

    await generateQuestions(concept, "apply", "multiple_choice", 0.5, 1, "user-1");
    expect(lastTag()).toMatchObject({ feature: "quiz.questions", userId: "user-1" });

    await generateLessonQuiz(concept, 0.4, 1, "user-2");
    expect(lastTag()).toMatchObject({ feature: "quiz.lesson", userId: "user-2" });

    await generateReviewQuestion(concept, 0.4, "user-3");
    expect(lastTag()).toMatchObject({ feature: "quiz.review", userId: "user-3" });
  });

  it("short-answer evaluation", async () => {
    create.mockResolvedValue(toolUse({ is_correct: true, score: 1, feedback: "ok" }));
    await evaluateShortAnswer({ id: "q", concept_id: "c1", ...question } as unknown as QuizQuestion, "ans", "user-4");
    expect(lastTag()).toMatchObject({ feature: "quiz.eval_short", userId: "user-4" });
  });

  it("explain-more", async () => {
    create.mockResolvedValue({ content: [{ type: "text", text: "more" }] });
    await explainMore("activate", "content", "Fractions", null, "user-5");
    expect(lastTag()).toMatchObject({ feature: "teach.explain_more", userId: "user-5" });
  });

  it("lesson generation, including the retry", async () => {
    // An invalid payload forces the second attempt, so both tags are checked.
    create.mockResolvedValue(toolUse({}));
    await expect(generateLesson(concept, null, [], "user-6")).rejects.toThrow();
    const tags = create.mock.calls.map((c) => c[1] as { feature: string; userId?: string | null });
    expect(tags.map((t) => t.feature)).toEqual(["teach.lesson", "teach.lesson.retry"]);
    expect(tags.every((t) => t.userId === "user-6")).toBe(true);
  });

  it("an omitted user id is null, not undefined garbage", async () => {
    create.mockResolvedValue(toolUse({ questions: [question] }));
    await generateReviewQuestion(concept, 0.4);
    expect(lastTag().userId).toBeNull();
  });
});
