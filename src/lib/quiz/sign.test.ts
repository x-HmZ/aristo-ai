import { beforeEach, describe, expect, it } from "vitest";
import { signQuestion, signQuestions, verifyQuestion } from "@/lib/quiz/sign";
import { hmacHex } from "@/lib/guard/sign";

beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
});

const q = {
  id: "q1", concept_id: "c", question_type: "multiple_choice", bloom_level: "apply", question: "Q?", correct_answer: "A",
  misconception_targeted: "m", difficulty: 0.5,
};

describe("quiz signing", () => {
  it("verifies the issued question and nothing altered", () => {
    const sig = signQuestion(q, "lesson");
    expect(verifyQuestion(q, "lesson", sig)).toBe(true);
    for (const alt of [
      { id: "q2" }, { concept_id: "d" }, { question_type: "true_false" }, { bloom_level: "create" }, { question: "Q!" },
      { correct_answer: "B" }, { misconception_targeted: "other" }, { misconception_targeted: undefined }, { difficulty: 0.6 },
    ]) {
      expect(verifyQuestion({ ...q, ...alt }, "lesson", sig), JSON.stringify(alt)).toBe(false);
    }
  });

  it("binds the issuing context", () => {
    const sig = signQuestion(q, "lesson");
    expect(verifyQuestion(q, "review", sig)).toBe(false);
    expect(verifyQuestion(q, "review", signQuestion(q, "review"))).toBe(true);
  });

  it("rejects a signature made under the old v1 label", () => {
    const old = hmacHex("aristo/quiz-answer/v1" as never, JSON.stringify([q.id, q.concept_id, q.question_type, q.question, q.correct_answer, q.difficulty]));
    expect(verifyQuestion(q, "lesson", old)).toBe(false);
  });

  it("rejects missing, malformed and foreign-key signatures", () => {
    const sig = signQuestion(q, "lesson");
    expect(verifyQuestion(q, "lesson", undefined)).toBe(false);
    expect(verifyQuestion(q, "lesson", "abc")).toBe(false);
    process.env.SUPABASE_SERVICE_ROLE_KEY = "other";
    expect(verifyQuestion(q, "lesson", sig)).toBe(false);
  });

  it("signQuestions adds a signature that verifies, clamping difficulty first", () => {
    const [out] = signQuestions([{ ...q, difficulty: 1.7 }], "review");
    expect(out.difficulty).toBe(1);
    expect(verifyQuestion(out, "review", out.answer_sig)).toBe(true);
    expect(verifyQuestion(out, "lesson", out.answer_sig)).toBe(false);
  });
});
