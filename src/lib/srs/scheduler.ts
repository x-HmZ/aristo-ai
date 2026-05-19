/**
 * SRS Scheduler — Phase 6
 *
 * Thin wrapper around the pure FSRS functions in mastery/update.ts.
 * Provides computeNextSRSState(): a single call that returns all the
 * database fields to write after a review answer.
 */

import {
  scheduleNextReview,
  nextReviewDate,
  type SRSState,
} from "@/lib/mastery/update";

export type { SRSState };
export { scheduleNextReview, nextReviewDate };

export interface SRSUpdate {
  srs_interval_days:       number;
  srs_next_review:         string;   // ISO date string
  srs_consecutive_correct: number;
  srs_lapses:              number;
}

/**
 * Given the current SRS state and whether the learner answered correctly,
 * returns the full set of DB fields to write to user_concept_mastery.
 */
export function computeNextSRSState(
  state:     SRSState,
  isCorrect: boolean
): SRSUpdate {
  const newInterval = scheduleNextReview(state, isCorrect);
  return {
    srs_interval_days:       newInterval,
    srs_next_review:         nextReviewDate(newInterval).toISOString(),
    srs_consecutive_correct: isCorrect ? state.consecutiveCorrect + 1 : 0,
    srs_lapses:              isCorrect ? state.lapses : state.lapses + 1,
  };
}

/**
 * Initial SRS state for a concept the learner has just finished a lesson quiz on.
 * Sets a 1-day review interval so it surfaces tomorrow.
 */
export function initialSRSUpdate(): SRSUpdate {
  return {
    srs_interval_days:       1,
    srs_next_review:         nextReviewDate(1).toISOString(),
    srs_consecutive_correct: 0,
    srs_lapses:              0,
  };
}
