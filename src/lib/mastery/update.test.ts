import { describe, expect, it } from "vitest";
import {
  BLOOM_ORDER,
  nextReviewDate,
  scheduleNextReview,
  selectNextDifficulty,
  updateMastery,
} from "@/lib/mastery/update";

describe("updateMastery (BKT)", () => {
  it("increases mastery on a correct answer", () => {
    const updated = updateMastery(0.5, true, 0.5);
    expect(updated).toBeGreaterThan(0.5);
    expect(updated).toBe(0.8293);
  });

  it("still increases mastery on a wrong answer (slip term + learning gain)", () => {
    // A wrong answer at mid-mastery should not tank the score to near zero:
    // the slip-probability term plus the flat +0.05 learning gain keep it
    // moving forward, by design ("wrong answers still teach").
    const updated = updateMastery(0.5, false, 0.5);
    expect(updated).toBe(0.1581);
    expect(updated).toBeLessThan(0.5);
  });

  it("clamps currentScore and difficulty into [0, 1] before computing", () => {
    const overShot = updateMastery(1.5, true, 0.5);
    const underShot = updateMastery(-0.5, true, 0.5);
    expect(overShot).toBe(updateMastery(1, true, 0.5));
    expect(underShot).toBe(updateMastery(0, true, 0.5));
  });

  it("never exceeds 1.0 even from a perfect prior", () => {
    expect(updateMastery(1, true, 0.5)).toBe(1);
  });

  it("a wrong answer from a perfect prior still lands above 0 (learning-gain floor)", () => {
    const updated = updateMastery(0, false, 0.5);
    expect(updated).toBe(0.05);
    expect(updated).toBeGreaterThanOrEqual(0);
  });

  it("rounds to 4 decimal places", () => {
    const updated = updateMastery(0.3333333, true, 0.2);
    expect(Number.isInteger(updated * 10000)).toBe(true);
  });
});

describe("scheduleNextReview (FSRS-lite)", () => {
  const base = { intervalDays: 10, consecutiveCorrect: 0, difficulty: 0.5, lapses: 0 };

  it("penalises a wrong answer to 30% of the previous interval", () => {
    expect(scheduleNextReview(base, false)).toBe(3.0);
  });

  it("never drops the interval below 1 day on a wrong answer", () => {
    expect(scheduleNextReview({ ...base, intervalDays: 1 }, false)).toBe(1.0);
  });

  it("sets a 1-day interval for the first correct answer", () => {
    expect(scheduleNextReview({ ...base, consecutiveCorrect: 0 }, true)).toBe(1.0);
  });

  it("sets a 3-day interval for the second correct answer", () => {
    expect(scheduleNextReview({ ...base, consecutiveCorrect: 1 }, true)).toBe(3.0);
  });

  it("expands the interval by a difficulty-adjusted ease factor from the third correct answer on", () => {
    // easeFactor = max(1.3, 2.5 - 0.5) = 2.0
    expect(scheduleNextReview({ ...base, consecutiveCorrect: 2 }, true)).toBe(20.0);
  });

  it("floors the ease factor at 1.3 once difficulty pushes it below that", () => {
    // easeFactor = max(1.3, 2.5 - 1.5) = 1.3 (the function does not clamp
    // difficulty itself, so a value > 1 is what actually exercises the floor)
    const hard = { ...base, consecutiveCorrect: 3, difficulty: 1.5, intervalDays: 10 };
    expect(scheduleNextReview(hard, true)).toBeCloseTo(13.0, 5);
  });

  it("caps the expanding interval at 180 days", () => {
    const longStanding = { ...base, consecutiveCorrect: 5, difficulty: 0, intervalDays: 170 };
    expect(scheduleNextReview(longStanding, true)).toBe(180);
  });
});

describe("nextReviewDate", () => {
  it("adds the given number of days to now", () => {
    const before = Date.now();
    const result = nextReviewDate(3).getTime();
    const after = Date.now();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    expect(result).toBeGreaterThanOrEqual(before + threeDaysMs);
    expect(result).toBeLessThanOrEqual(after + threeDaysMs);
  });
});

describe("selectNextDifficulty", () => {
  it("targets the weakest bloom level when it is below 0.5 accuracy", () => {
    const result = selectNextDifficulty(0.6, 0.9, { remember: 0.9, apply: 0.3 });
    expect(result).toEqual({ bloomLevel: "apply", difficulty: 0.3 });
  });

  it("escalates to the highest un-mastered bloom level when recent accuracy is high", () => {
    // Every level must be present (unset levels default to 0 and are
    // immediately "un-mastered"), so score them all and leave only
    // "analyze" below the 0.8 escalation bar.
    const result = selectNextDifficulty(0.6, 0.9, {
      remember: 0.9,
      understand: 0.9,
      apply: 0.9,
      analyze: 0.6,
      evaluate: 0.9,
      create: 0.9,
    });
    expect(result.bloomLevel).toBe("analyze");
    expect(result.difficulty).toBeCloseTo(0.7, 5);
  });

  it("falls back to 'apply' at the learner's current mastery when no signal is strong enough", () => {
    const result = selectNextDifficulty(0.55, 0.6, {});
    expect(result).toEqual({ bloomLevel: "apply", difficulty: 0.55 });
  });

  it("BLOOM_ORDER is the fixed Bloom's taxonomy ladder", () => {
    expect(BLOOM_ORDER).toEqual([
      "remember", "understand", "apply", "analyze", "evaluate", "create",
    ]);
  });
});
