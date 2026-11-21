"use client";

/**
 * DeskQuiz: the quiz as one sheet of paper lying on the student's desk, which the camera tilts down to reveal.
 *
 * Design history:
 *   - Attempt 1 used `<Html transform occlude="blending">` anchored to the classroom DeskPaper mesh. The blending
 *     occluder on the same plane as the paper mesh masked the whole DOM to a blank white sheet (depth precision).
 *   - Attempts 2 and 3 used a plain screen-space `<Html>` near the desk: crisp, but it floated parallel to the screen
 *     while the desk receded, so it read as a popup over a desk.
 *   - Then `<Html transform>` (no occlude) rotated -90 degrees about X so the DOM lies in the desk's plane.
 *   - Now (V10.1): the sheet has a real size. 40 x 54 cm in the middle of the desk top (probed y=-0.888, x -0.46..0.47,
 *     z -0.82..-0.22), so it lies fully on the desk with margin. Its height never changes: the result and Next sit in a
 *     band that is reserved from the start (QuizView `sheet`). The camera and the CSS box come from sheetFraming.ts.
 */

import { SceneHtml as Html } from "@/components/three/SceneHtml";
import { useThree } from "@react-three/fiber";
import { useMemo } from "react";
import type { PerspectiveCamera } from "three";
import { useAristoStore } from "@/store/useAristoStore";
import { QuizView } from "@/components/quiz/QuizView";
import { CONTROL_MIN, SHEET_ANCHOR, sheetFraming } from "./sheetFraming";

/** Where the sheet lies (also where the teacher looks when the quiz is on the desk). */
export { SHEET_ANCHOR };

interface DeskQuizProps {
  /** Override paper anchor (dev tuning only). */
  paperAnchor?: [number, number, number];
}

export function DeskQuiz({ paperAnchor }: DeskQuizProps = {}) {
  const activeQuiz    = useAristoStore((s) => s.activeQuiz);
  const size = useThree((s) => s.size);
  const fov = useThree((s) => (s.camera as PerspectiveCamera).fov);
  const { cardWidth, cardHeight, distanceFactor, controlHeight } = useMemo(
    () => sheetFraming(size.width, size.height, fov), [size.width, size.height, fov],
  );
  const userId        = useAristoStore((s) => s.userId);
  const demoMode       = useAristoStore((s) => s.demoMode);
  const setActiveQuiz = useAristoStore((s) => s.setActiveQuiz);
  const setQuizResult = useAristoStore((s) => s.setQuizResult);

  if (!activeQuiz || !userId) return null;

  const handleComplete = (score: number, total: number) => {
    // Order matters: clear activeQuiz first so the CameraController starts
    // its reverse lerp back to the lesson framing, then surface the result
    // so LearnClient can swap the bottom bar to <CourseAdvanceBar/>.
    setActiveQuiz(null);
    setQuizResult({ score, total });
  };

  return (
    <Html
      position={paperAnchor ?? SHEET_ANCHOR}
      // Lie flat in the desk plane: -90 degrees about X points the DOM's face up (+Y) with the top of the page
      // towards the back of the desk (-Z).
      transform
      rotation-x={-Math.PI / 2}
      distanceFactor={distanceFactor}
      // zIndexRange keeps the quiz above any other Html (callouts, image toolbar) so they can't peek through.
      zIndexRange={[200, 0]}
    >
      {/* A sheet of paper in the lit room: `.theme-paper` keeps it light in both themes (the room never follows the
          theme); it is otherwise on the tokens. */}
      <div
        className="theme-paper aristo-paper flex flex-col overflow-hidden rounded-2xl border border-line bg-surface text-ink"
        style={{
          // The CSS box sets the world size with distanceFactor: always 40 x 54 cm (sheetFraming.ts).
          width:         `${cardWidth}px`,
          height:        `${cardHeight}px`,
          // Soft warm shadow under the sheet so it feels grounded against the wood backdrop. A scene constant, not a UI
          // colour (three.js-side lighting is literal too), so it stays a literal.
          boxShadow:     "0 32px 90px rgba(30,14,6,0.65)",
          animation:     "aristoPaperIn 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both",
        }}
      >
        <style>{`
          @keyframes aristoPaperIn {
            from { opacity: 0; transform: translateY(14px) scale(0.97); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
          ${controlHeight > CONTROL_MIN
            ? `/* The tilted paper is foreshortened: controls this tall in CSS px measure 44px on screen (sheetFraming.ts). */
          .aristo-paper :is(button, input, select, textarea) { min-height: ${controlHeight}px; }`
            : ""}
          @media (prefers-reduced-motion: reduce) {
            .aristo-paper { animation: none !important; }
          }
        `}</style>
        <QuizView
          sheet
          conceptId={activeQuiz.conceptId}
          questions={activeQuiz.questions}
          userId={userId}
          onComplete={handleComplete}
          localOnly={demoMode}
        />
      </div>
    </Html>
  );
}
