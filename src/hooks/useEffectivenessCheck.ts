/**
 * useEffectivenessCheck
 *
 * Silently evaluates whether the student's current learning style profile is
 * producing good outcomes, and rotates to the next best option if not.
 *
 * Called after each quiz attempt.
 *
 * Evaluation signal:
 *   - Needs at least 3 quiz attempts with the current style + flow combo.
 *   - Computes average score as a fraction of total questions (0–1).
 *   - If avg < 0.50 → underperforming → rotate.
 *
 * Rotation logic (FSLSM-informed order):
 *   Within the same engagement flow, rotate through styles in order of
 *   proximity on the FSLSM grid:
 *     explorer → synthesizer → builder → analyst → explorer …
 *   (Adjacent profiles on the Active/Reflective × Global/Sequential grid,
 *   so each rotation changes only one dimension at a time — minimising
 *   disruption while meaningfully adjusting the teaching approach.)
 *
 *   If ALL four styles have been tried on the current flow and scores are
 *   still low → flip the engagement flow and reset the style cycle starting
 *   from the student's originally assessed style.
 *
 * All changes are:
 *   - Silent (no UI notification)
 *   - Persisted to Supabase profiles
 *   - Applied to the Zustand store so the next topic immediately uses the new style
 */

import { useCallback } from "react";
import {
  useAristoStore,
  type LearningStyle,
  type TeachingFlow,
} from "@/store/useAristoStore";

/**
 * FSLSM-ordered rotation: each step changes only one dimension on the grid.
 *
 *   explorer    (Active + Global)
 *   synthesizer (Reflective + Global)    ← changes processing only
 *   analyst     (Reflective + Sequential)← changes understanding only
 *   builder     (Active + Sequential)    ← changes processing only
 *   → back to explorer                   ← changes understanding only
 */
const STYLE_ROTATION: LearningStyle[] = [
  "explorer",
  "synthesizer",
  "analyst",
  "builder",
];

export function useEffectivenessCheck() {
  const userId        = useAristoStore((s) => s.userId);
  const learningStyle = useAristoStore((s) => s.learningStyle);
  const teachingFlow  = useAristoStore((s) => s.teachingFlow);

  const setLearningStyle = useAristoStore((s) => s.setLearningStyle);
  const setTeachingFlow  = useAristoStore((s) => s.setTeachingFlow);

  const checkAndAdapt = useCallback(async () => {
    if (!userId) return;

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      // Fetch last 20 quiz attempts (enough to evaluate all possible combos)
      const { data: attempts } = await supabase
        .from("quiz_attempts")
        .select("score, style_used, teaching_flow_used, questions")
        .eq("user_id", userId)
        .order("attempted_at", { ascending: false })
        .limit(20);

      if (!attempts || attempts.length < 3) return;

      // Filter to current style + flow
      const currentCombo = attempts.filter(
        (a) =>
          a.style_used === learningStyle &&
          a.teaching_flow_used === teachingFlow
      );

      if (currentCombo.length < 3) return; // Not enough data yet

      // Average score (0–1)
      const avgScore =
        currentCombo.reduce((sum, a) => {
          const total = Array.isArray(a.questions) ? a.questions.length : 5;
          return sum + (total > 0 ? a.score / total : 0);
        }, 0) / currentCombo.length;

      if (avgScore >= 0.5) return; // Performing adequately — no change needed

      // ── Underperforming: find next style to try ────────────────────────────

      // Collect styles already tried on this flow
      const triedOnCurrentFlow = new Set(
        attempts
          .filter((a) => a.teaching_flow_used === teachingFlow)
          .map((a) => a.style_used as LearningStyle)
      );

      const allStylesTried = STYLE_ROTATION.every((s) =>
        triedOnCurrentFlow.has(s)
      );

      let nextStyle: LearningStyle = learningStyle;
      let nextFlow: TeachingFlow = teachingFlow;

      if (allStylesTried) {
        // Every style tried on this flow and none worked → flip the flow
        nextFlow  = teachingFlow === "interactive" ? "structured" : "interactive";
        nextStyle = "explorer"; // Restart style cycle on the new flow
      } else {
        // Advance to the next untried style in the rotation
        const currentIdx = STYLE_ROTATION.indexOf(learningStyle);
        for (let step = 1; step <= STYLE_ROTATION.length; step++) {
          const candidate =
            STYLE_ROTATION[(currentIdx + step) % STYLE_ROTATION.length];
          if (!triedOnCurrentFlow.has(candidate)) {
            nextStyle = candidate;
            break;
          }
        }
      }

      // Nothing changed (safety guard — shouldn't happen)
      if (nextStyle === learningStyle && nextFlow === teachingFlow) return;

      // Apply changes
      if (nextStyle !== learningStyle) setLearningStyle(nextStyle);
      if (nextFlow  !== teachingFlow)  setTeachingFlow(nextFlow);

      // Persist to profile
      await supabase
        .from("profiles")
        .update({
          learning_style: nextStyle,
          teaching_flow: nextFlow,
        })
        .eq("id", userId);
    } catch (err) {
      // Non-critical — log but never surface to user
      console.error("Effectiveness check failed:", err);
    }
  }, [userId, learningStyle, teachingFlow, setLearningStyle, setTeachingFlow]);

  return { checkAndAdapt };
}
