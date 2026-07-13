import { describe, expect, it } from "vitest";
import { computeBloomAccuracy, updateDynamicProfile } from "@/lib/agents/profiler";
import type { BehavioralSignals, DynamicProfile } from "@/store/useAristoStore";

const baseSignals: BehavioralSignals = {
  time_on_explanations_seconds: 0,
  time_on_examples_seconds: 0,
  time_on_quizzes_seconds: 0,
  clicked_explain_more: 0,
  clicked_show_example: 0,
  clicked_skip_to_quiz: 0,
  questions_attempted: 0,
  questions_correct: 0,
};

const baseProfile: DynamicProfile = {
  expertise_level: "beginner",
  pace: "moderate",
  explanation_depth: "moderate",
  example_preference: "concrete",
};

describe("updateDynamicProfile", () => {
  it("defaults to the standard profile when there is no prior profile", () => {
    const result = updateDynamicProfile(null, baseSignals, {});
    expect(result).toEqual(baseProfile);
  });

  it("shifts explanation depth up after repeated explain-more clicks", () => {
    const result = updateDynamicProfile(
      baseProfile,
      { ...baseSignals, clicked_explain_more: 2 },
      {}
    );
    expect(result.explanation_depth).toBe("detailed");
  });

  it("shifts explanation depth down after repeated skip-to-quiz clicks", () => {
    const result = updateDynamicProfile(
      baseProfile,
      { ...baseSignals, clicked_skip_to_quiz: 2 },
      {}
    );
    expect(result.explanation_depth).toBe("concise");
  });

  it("does not shift depth on a single click (noise threshold)", () => {
    const result = updateDynamicProfile(
      baseProfile,
      { ...baseSignals, clicked_explain_more: 1 },
      {}
    );
    expect(result.explanation_depth).toBe("moderate");
  });

  it("speeds up pace when quiz answers are fast and accurate", () => {
    const result = updateDynamicProfile(
      baseProfile,
      {
        ...baseSignals,
        questions_attempted: 4,
        questions_correct: 4,
        time_on_quizzes_seconds: 40, // 10s/question avg, 100% accuracy
      },
      {}
    );
    expect(result.pace).toBe("fast");
  });

  it("slows pace down when quiz answers are slow or inaccurate", () => {
    const slow = updateDynamicProfile(
      baseProfile,
      {
        ...baseSignals,
        questions_attempted: 2,
        questions_correct: 2,
        time_on_quizzes_seconds: 200, // 100s/question avg
      },
      {}
    );
    expect(slow.pace).toBe("careful");

    const inaccurate = updateDynamicProfile(
      baseProfile,
      {
        ...baseSignals,
        questions_attempted: 4,
        questions_correct: 1, // 25% accuracy
        time_on_quizzes_seconds: 40,
      },
      {}
    );
    expect(inaccurate.pace).toBe("careful");
  });

  it("shifts example preference up when demonstrations dominate explanation time", () => {
    const result = updateDynamicProfile(
      { ...baseProfile, example_preference: "abstract" },
      {
        ...baseSignals,
        time_on_examples_seconds: 100,
        time_on_explanations_seconds: 50, // 2x -> exceeds the 1.5x threshold
      },
      {}
    );
    expect(result.example_preference).toBe("mixed");
  });

  it("raises expertise level only once enough questions have been attempted", () => {
    const tooFew = updateDynamicProfile(
      baseProfile,
      { ...baseSignals, questions_attempted: 3, questions_correct: 3 }, // 100% but <5 attempts
      {}
    );
    expect(tooFew.expertise_level).toBe("beginner");

    const enough = updateDynamicProfile(
      baseProfile,
      { ...baseSignals, questions_attempted: 5, questions_correct: 5 }, // 100%, >=5 attempts
      {}
    );
    expect(enough.expertise_level).toBe("intermediate");
  });

  it("lowers expertise level after sustained poor accuracy", () => {
    const result = updateDynamicProfile(
      { ...baseProfile, expertise_level: "intermediate" },
      { ...baseSignals, questions_attempted: 5, questions_correct: 1 }, // 20% accuracy
      {}
    );
    expect(result.expertise_level).toBe("beginner");
  });

  it("clamps expertise level at the ends of the ordinal scale", () => {
    const alreadyAdvanced = updateDynamicProfile(
      { ...baseProfile, expertise_level: "advanced" },
      { ...baseSignals, questions_attempted: 5, questions_correct: 5 },
      {}
    );
    expect(alreadyAdvanced.expertise_level).toBe("advanced");
  });

  it("records the weakest and strongest bloom levels from accuracy data", () => {
    const result = updateDynamicProfile(baseProfile, baseSignals, {
      remember: 0.9,
      apply: 0.2,
      analyze: 0.5,
    });
    expect(result.weakest_bloom_level).toBe("apply");
    expect(result.strongest_bloom_level).toBe("remember");
  });
});

describe("computeBloomAccuracy", () => {
  it("computes per-level accuracy from raw quiz attempt rows", () => {
    const result = computeBloomAccuracy([
      { bloom_level: "remember", is_correct: true },
      { bloom_level: "remember", is_correct: false },
      { bloom_level: "apply", is_correct: true },
      { bloom_level: "apply", is_correct: true },
    ]);
    expect(result).toEqual({ remember: 0.5, apply: 1 });
  });

  it("returns an empty object for no rows", () => {
    expect(computeBloomAccuracy([])).toEqual({});
  });

  it("ignores rows with a missing bloom_level", () => {
    const result = computeBloomAccuracy([
      { bloom_level: "", is_correct: true },
      { bloom_level: "remember", is_correct: true },
    ] as { bloom_level: string; is_correct: boolean }[]);
    expect(result).toEqual({ remember: 1 });
  });
});
