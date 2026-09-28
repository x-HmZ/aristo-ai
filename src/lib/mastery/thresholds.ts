// ============================================================
// Mastery score thresholds (spec §3.5)
// ============================================================

import { BRAND_HEX } from "@/lib/brandColors";

export type MasteryTier = "not_learned" | "in_progress" | "learned" | "mastered";

export function getMasteryTier(score: number): MasteryTier {
  if (score < 0.3)  return "not_learned";
  if (score < 0.7)  return "in_progress";
  if (score < 0.9)  return "learned";
  return "mastered";
}

/** Prerequisites are considered met when score >= this value */
export const PREREQ_THRESHOLD = 0.7;

/** Colour tokens for UI (matches the Aristo pastel-orange theme) */
export const MASTERY_COLORS: Record<MasteryTier, { bg: string; text: string; label: string }> = {
  not_learned: { bg: "#F3F4F6", text: "#6B7280",  label: "Not started"  },
  in_progress: { bg: BRAND_HEX.wash, text: BRAND_HEX.orangeInk,  label: "In progress"  },
  learned:     { bg: "#DCFCE7", text: "#16A34A",  label: "Learned"      },
  mastered:    { bg: "#EDE9FE", text: BRAND_HEX.purpleHover,  label: "Mastered"     },
};
