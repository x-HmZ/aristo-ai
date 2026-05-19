// ============================================================
// Mastery score updates — Bayesian Knowledge Tracing (spec §3.5)
// and Spaced Repetition scheduling (spec §7.2).
//
// Pure functions: no DB calls, no side effects.
// ============================================================

// ── Bayesian Knowledge Tracing ────────────────────────────────

/**
 * Updates the mastery score for a concept after a single quiz answer.
 *
 * @param currentScore   P(mastery) before this answer — 0.0 to 1.0
 * @param isCorrect      Whether the learner answered correctly
 * @param difficulty     Question difficulty — 0.0 (easy) to 1.0 (hard)
 * @returns              Updated P(mastery) — 0.0 to 1.0, rounded to 4dp
 */
export function updateMastery(
  currentScore: number,
  isCorrect: boolean,
  difficulty: number
): number {
  // Clamp inputs
  const score = Math.max(0, Math.min(1, currentScore));
  const diff  = Math.max(0, Math.min(1, difficulty));

  // P(correct | mastered) — easier questions have higher ceiling
  const pCorrectIfMastered    = 0.95 - diff * 0.2;   // 0.75–0.95
  // P(correct | not mastered) — lucky guess probability
  const pCorrectIfNotMastered = 0.10 + (1 - diff) * 0.15; // 0.10–0.25
  // P(slip) — mastered but answered wrong
  const pSlip                 = 0.05 + diff * 0.10;  // 0.05–0.15

  let updated: number;

  if (isCorrect) {
    // Bayesian update: P(mastered | correct)
    const numerator   = pCorrectIfMastered * score;
    const denominator = numerator + pCorrectIfNotMastered * (1 - score);
    updated = denominator > 0 ? numerator / denominator : score;
  } else {
    // Bayesian update: P(mastered | incorrect)
    const numerator   = pSlip * score;
    const denominator = numerator + (1 - pCorrectIfNotMastered) * (1 - score);
    updated = denominator > 0 ? numerator / denominator : score;
    // Wrong answers still teach — small learning gain
    updated = Math.min(1.0, updated + 0.05);
  }

  return Math.round(updated * 10000) / 10000; // 4 decimal places
}

// ── Spaced Repetition Scheduler (simplified FSRS, spec §7.2) ─

export interface SRSState {
  intervalDays:       number;
  consecutiveCorrect: number;
  difficulty:         number; // 0.0–1.0
  lapses:             number;
}

/**
 * Computes the next review interval in days.
 *
 * @returns New interval in days
 */
export function scheduleNextReview(
  state: SRSState,
  isCorrect: boolean
): number {
  if (!isCorrect) {
    // Wrong answer — reset but not fully (penalise by 70%)
    return Math.max(1.0, state.intervalDays * 0.3);
  }

  const { consecutiveCorrect, difficulty } = state;

  if (consecutiveCorrect < 1) return 1.0;
  if (consecutiveCorrect < 2) return 3.0;

  // Expanding intervals with difficulty-adjusted ease factor
  const easeFactor = Math.max(1.3, 2.5 - difficulty * 1.0); // 1.3–2.5
  const newInterval = state.intervalDays * easeFactor;
  return Math.min(newInterval, 180); // cap at 6 months
}

/**
 * Returns the next review Date from now + intervalDays.
 */
export function nextReviewDate(intervalDays: number): Date {
  const d = new Date();
  d.setTime(d.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  return d;
}

// ── Bloom-level accuracy helpers ─────────────────────────────

export type BloomLevel = "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";

export const BLOOM_ORDER: BloomLevel[] = [
  "remember", "understand", "apply", "analyze", "evaluate", "create",
];

/**
 * Given a map of bloom-level → accuracy (0–1), returns the level
 * and difficulty that the next question should target.
 * Spec §6.5 algorithm.
 */
export function selectNextDifficulty(
  conceptMastery: number,
  recentAccuracy: number,
  bloomScores: Partial<Record<BloomLevel, number>>
): { bloomLevel: BloomLevel; difficulty: number } {
  const weakest = (Object.entries(bloomScores) as [BloomLevel, number][])
    .sort(([, a], [, b]) => a - b)[0];

  if (weakest && weakest[1] < 0.5) {
    return { bloomLevel: weakest[0], difficulty: 0.3 };
  }

  if (recentAccuracy > 0.8) {
    // Escalate — find the highest level they haven't mastered
    for (const level of [...BLOOM_ORDER].reverse()) {
      if ((bloomScores[level] ?? 0) < 0.8) {
        return {
          bloomLevel: level,
          difficulty: Math.min(1.0, conceptMastery + 0.1),
        };
      }
    }
  }

  return { bloomLevel: "apply", difficulty: conceptMastery };
}
