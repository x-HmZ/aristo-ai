"use client";

/**
 * DeskQuiz — the in-scene quiz "paper" the camera tilts down to reveal.
 *
 * Design history:
 *   • Attempt 1 used `<Html transform occlude="blending">` anchored to the
 *     classroom DeskPaper mesh.  The blending-occluder material on the
 *     same plane as the paper mesh masked the entire DOM to a blank white
 *     sheet — depth precision was the killer.
 *
 *   • Attempt 2/3 used a plain screen-space `<Html>` anchored near the
 *     desk.  Crisp and interactive, but the DOM floats parallel to the
 *     screen while the desk recedes in perspective — it never read as
 *     "paper ON the desk", just "popup over a desk".
 *
 *   • Current: `<Html transform>` (NO occlude — that was Attempt 1's
 *     killer, not the transform) rotated -90° about X so the DOM lies
 *     physically in the desk's surface plane.  The desk surface was
 *     probed via SceneProbe at y=-0.888, x∈[-0.46,0.47], z∈[-0.82,-0.22];
 *     the paper is anchored 1 cm above its centre.  When CameraController
 *     tilts down, the page foreshortens with the desk exactly like a real
 *     sheet of paper.
 */

import { Html } from "@react-three/drei";
import { useAristoStore } from "@/store/useAristoStore";
import { QuizView } from "@/components/quiz/QuizView";

// ─── Tunables ────────────────────────────────────────────────────────────────

// Centre of the student-desk surface (probed: y=-0.888), nudged 1 cm up to
// avoid z-fighting with the desktop mesh.
export const PAPER_ANCHOR: [number, number, number] = [0, -0.878, -0.5];

// CSS-pixel → world scale for the transformed DOM.  The paper wrapper is
// 520 px wide; the desk is ~0.93 world units wide.  distanceFactor in drei's
// transform mode applies scale = distanceFactor/400 per px, so 0.55 ≈
// 0.72 world units of paper width — comfortable margins on the desk.
const PAPER_DISTANCE_FACTOR = 0.55;

// ─── Component ───────────────────────────────────────────────────────────────

interface DeskQuizProps {
  /** Override paper anchor (dev tuning only). */
  paperAnchor?: [number, number, number];
}

export function DeskQuiz({ paperAnchor }: DeskQuizProps = {}) {
  const activeQuiz    = useAristoStore((s) => s.activeQuiz);
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
      position={paperAnchor ?? PAPER_ANCHOR}
      // Lie flat in the desk plane: -90° about X points the DOM's face up
      // (+Y) with the top of the page towards the back of the desk (-Z).
      transform
      rotation-x={-Math.PI / 2}
      distanceFactor={PAPER_DISTANCE_FACTOR}
      // zIndexRange keeps the quiz above any other Html (callouts, image
      // toolbar) so they can't peek through during the tilt.
      zIndexRange={[200, 0]}
    >
      {/* A sheet of paper in the lit room: `.theme-paper` keeps it light in both
          themes (the room never follows the theme); it is otherwise on the tokens. */}
      <div
        className="theme-paper aristo-scroll aristo-paper rounded-2xl border border-line bg-surface px-5 py-[18px] text-ink"
        style={{
          // 520 px wide is what sets the world size with PAPER_DISTANCE_FACTOR.
          width:         "520px",
          maxHeight:     "620px",
          overflowY:     "auto",
          // Soft warm shadow under the sheet so it feels grounded against the
          // wood backdrop. A scene constant, not a UI colour (three.js-side
          // lighting is literal too), so it stays a literal.
          boxShadow:     "0 32px 90px rgba(30,14,6,0.65)",
          animation:     "aristoPaperIn 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both",
        }}
      >
        <style>{`
          @keyframes aristoPaperIn {
            from { opacity: 0; transform: translateY(14px) scale(0.97); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
          @media (prefers-reduced-motion: reduce) {
            .aristo-paper { animation: none !important; }
          }
        `}</style>
        <QuizView
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
