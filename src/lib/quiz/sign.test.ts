import { beforeEach, describe, expect, it } from "vitest";
import { signQuestion, signQuestions, verifyQuestion } from "@/lib/quiz/sign";

beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
});

const q = { id: "q1", concept_id: "c", question_type: "multiple_choice", question: "Q?", correct_answer: "A", difficulty: 0.5 };

describe("quiz signing", () => {
  it("verifies the issued question and nothing altered", () => {
    const sig = signQuestion(q);
    expect(verifyQuestion(q, sig)).toBe(true);
    for (const alt of [{ id: "q2" }, { concept_id: "d" }, { question_type: "true_false" }, { question: "Q!" }, { correct_answer: "B" }, { difficulty: 0.6 }]) {
      expect(verifyQuestion({ ...q, ...alt }, sig), JSON.stringify(alt)).toBe(false);
    }
  });

  it("rejects missing, malformed and foreign-key signatures", () => {
    const sig = signQuestion(q);
    expect(verifyQuestion(q, undefined)).toBe(false);
    expect(verifyQuestion(q, "abc")).toBe(false);
    process.env.SUPABASE_SERVICE_ROLE_KEY = "other";
    expect(verifyQuestion(q, sig)).toBe(false);
  });

  it("signQuestions adds a signature that verifies, clamping difficulty first", () => {
    const [out] = signQuestions([{ ...q, difficulty: 1.7 }]);
    expect(out.difficulty).toBe(1);
    expect(verifyQuestion(out, out.answer_sig)).toBe(true);
  });
});
