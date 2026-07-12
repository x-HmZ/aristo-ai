/**
 * Central model IDs for all agent calls.
 * Update here on a model bump; do not hardcode model strings elsewhere.
 */

export const MODELS = {
  /** TeachingAgent: 5-phase lesson generation. High-quality, structured. */
  teaching:   "claude-sonnet-5",
  /** AssessmentAgent: lesson + ad-hoc quiz generation. Pedagogical variety. */
  assessment: "claude-sonnet-5",
  /** Cheap/fast: explain-more, free-mode chat, review questions, short-answer eval. */
  fast:       "claude-haiku-4-5-20251001",
} as const;
