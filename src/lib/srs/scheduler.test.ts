import { describe, expect, it } from "vitest";
import {
  computeNextSRSState,
  initialSRSUpdate,
  type SRSState,
} from "@/lib/srs/scheduler";

describe("computeNextSRSState", () => {
  const state: SRSState = {
    intervalDays: 10,
    consecutiveCorrect: 2,
    difficulty: 0.5,
    lapses: 1,
  };

  it("increments consecutiveCorrect and leaves lapses untouched on a correct answer", () => {
    const result = computeNextSRSState(state, true);
    expect(result.srs_consecutive_correct).toBe(3);
    expect(result.srs_lapses).toBe(1);
    expect(result.srs_interval_days).toBe(20); // 10 * (2.5 - 0.5*1.0)
  });

  it("resets consecutiveCorrect and increments lapses on a wrong answer", () => {
    const result = computeNextSRSState(state, false);
    expect(result.srs_consecutive_correct).toBe(0);
    expect(result.srs_lapses).toBe(2);
    expect(result.srs_interval_days).toBe(3); // 10 * 0.3
  });

  it("writes an ISO date string for srs_next_review", () => {
    const result = computeNextSRSState(state, true);
    expect(() => new Date(result.srs_next_review).toISOString()).not.toThrow();
    expect(new Date(result.srs_next_review).getTime()).toBeGreaterThan(Date.now());
  });
});

describe("initialSRSUpdate", () => {
  it("starts a concept at a 1-day interval with no history", () => {
    const result = initialSRSUpdate();
    expect(result.srs_interval_days).toBe(1);
    expect(result.srs_consecutive_correct).toBe(0);
    expect(result.srs_lapses).toBe(0);
    expect(new Date(result.srs_next_review).getTime()).toBeGreaterThan(Date.now());
  });
});
