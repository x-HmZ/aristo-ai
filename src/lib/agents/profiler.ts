/**
 * ProfilerAgent — Phase 7 Behavioral Profiling (spec §3.4)
 *
 * Pure rule-based computation — no LLM needed (spec Quick Reference table).
 * Observes behavioral signals from a session and returns an updated
 * DynamicProfile for the learner.
 *
 * Called by POST /api/profile/session after each session flush.
 */

import type { DynamicProfile, BehavioralSignals } from "@/store/useAristoStore";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Per-Bloom-level accuracy map (0.0–1.0). Computed from recent quiz_attempts. */
export type BloomAccuracy = Partial<Record<string, number>>;

// ─── Ordinal shift helpers ────────────────────────────────────────────────────

const EXPERTISE: readonly string[] = ["beginner", "intermediate", "advanced"];
const PACE:      readonly string[] = ["careful",  "moderate",    "fast"];
const DEPTH:     readonly string[] = ["concise",  "moderate",    "detailed"];
const EXAMPLE:   readonly string[] = ["abstract", "mixed",       "concrete"];

function shift(
  order: readonly string[],
  current: string,
  direction: "up" | "down"
): string {
  const idx  = order.indexOf(current);
  const base = idx === -1 ? 1 : idx;   // default to middle if unknown
  const next = direction === "up" ? base + 1 : base - 1;
  return order[Math.max(0, Math.min(order.length - 1, next))];
}

// ─── Core profiler update ─────────────────────────────────────────────────────

/**
 * Given behavioral signals from a completed session and per-Bloom accuracy
 * computed from recent quiz history, returns an updated DynamicProfile.
 *
 * Uses a conservative shifting rule: each signal must be strong enough
 * (above a threshold) before nudging the profile, to avoid noise-driven
 * oscillation.
 */
export function updateDynamicProfile(
  current:      DynamicProfile | null,
  signals:      BehavioralSignals,
  bloomAccuracy: BloomAccuracy
): DynamicProfile {
  const profile: DynamicProfile = current ?? {
    expertise_level:    "beginner",
    pace:               "moderate",
    explanation_depth:  "moderate",
    example_preference: "concrete",
  };

  const updated = { ...profile };

  // ── 1. Explanation depth ───────────────────────────────────────────────────
  // clicked_explain_more ≥ 2  → learner wants more depth
  // clicked_skip_to_quiz ≥ 2  → learner prefers concise
  if (signals.clicked_explain_more >= 2) {
    updated.explanation_depth = shift(DEPTH, updated.explanation_depth, "up") as DynamicProfile["explanation_depth"];
  }
  if (signals.clicked_skip_to_quiz >= 2) {
    updated.explanation_depth = shift(DEPTH, updated.explanation_depth, "down") as DynamicProfile["explanation_depth"];
  }

  // ── 2. Pace ────────────────────────────────────────────────────────────────
  // avg quiz response time + accuracy together determine pace signal
  const accuracy = signals.questions_attempted > 0
    ? signals.questions_correct / signals.questions_attempted
    : null;

  const avgQuizSec = signals.questions_attempted > 0
    ? signals.time_on_quizzes_seconds / signals.questions_attempted
    : null;

  if (accuracy !== null && avgQuizSec !== null) {
    if (avgQuizSec < 15 && accuracy > 0.8) {
      // Quick AND correct → learner is ahead of the curve
      updated.pace = shift(PACE, updated.pace, "up") as DynamicProfile["pace"];
    } else if (avgQuizSec > 60 || accuracy < 0.5) {
      // Slow OR struggling → needs a gentler pace
      updated.pace = shift(PACE, updated.pace, "down") as DynamicProfile["pace"];
    }
  }

  // ── 3. Example preference ──────────────────────────────────────────────────
  // Spending notably more time on demonstrations than explanations → concrete
  const exampleHeavy =
    signals.time_on_examples_seconds > 0 &&
    signals.time_on_explanations_seconds > 0 &&
    signals.time_on_examples_seconds > signals.time_on_explanations_seconds * 1.5;

  if (exampleHeavy || signals.clicked_show_example >= 2) {
    updated.example_preference = shift(EXAMPLE, updated.example_preference, "up") as DynamicProfile["example_preference"];
  }

  // ── 4. Expertise level ─────────────────────────────────────────────────────
  // Only shift after a meaningful number of attempts to avoid noise
  if (accuracy !== null && signals.questions_attempted >= 5) {
    if (accuracy >= 0.85) {
      updated.expertise_level = shift(EXPERTISE, updated.expertise_level, "up") as DynamicProfile["expertise_level"];
    } else if (accuracy < 0.40) {
      updated.expertise_level = shift(EXPERTISE, updated.expertise_level, "down") as DynamicProfile["expertise_level"];
    }
  }

  // ── 5. Bloom-level strengths and weaknesses ────────────────────────────────
  const bloomEntries = Object.entries(bloomAccuracy).filter(
    (e): e is [string, number] => typeof e[1] === "number"
  );

  if (bloomEntries.length > 0) {
    const sorted = [...bloomEntries].sort(([, a], [, b]) => a - b);
    updated.weakest_bloom_level   = sorted[0][0];
    updated.strongest_bloom_level = sorted[sorted.length - 1][0];
  }

  return updated;
}

// ─── Bloom accuracy from raw quiz_attempts rows ───────────────────────────────

interface QuizAttemptRow {
  bloom_level: string;
  is_correct:  boolean;
}

/**
 * Computes per-Bloom-level accuracy from raw quiz_attempts rows.
 * Returns only levels that have been attempted at least once.
 */
export function computeBloomAccuracy(rows: QuizAttemptRow[]): BloomAccuracy {
  const counts: Record<string, { correct: number; total: number }> = {};

  for (const row of rows) {
    const level = row.bloom_level;
    if (!level) continue;
    counts[level] ??= { correct: 0, total: 0 };
    counts[level].total  += 1;
    counts[level].correct += row.is_correct ? 1 : 0;
  }

  const result: BloomAccuracy = {};
  for (const [level, { correct, total }] of Object.entries(counts)) {
    result[level] = total > 0 ? correct / total : 0;
  }
  return result;
}
