// ============================================================
// Mastery score thresholds (spec §3.5)
// ============================================================

export type MasteryTier = "not_learned" | "in_progress" | "learned" | "mastered";

export function getMasteryTier(score: number): MasteryTier {
  if (score < 0.3)  return "not_learned";
  if (score < 0.7)  return "in_progress";
  if (score < 0.9)  return "learned";
  return "mastered";
}

/** Prerequisites are considered met when score >= this value */
export const PREREQ_THRESHOLD = 0.7;
