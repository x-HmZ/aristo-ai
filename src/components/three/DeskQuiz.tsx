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
 *   • Attempt 2 dropped occlusion and used V1's tight positioning trick
 *     (Html close to camera, rotation-x for the reading tilt).  Still
 *     fragile because `<Html transform>`'s CSS3D projection has to be
 *     hand-tuned per camera FOV.
 *
 *   • Current: a plain `<Html>` (no transform) anchored to the desk
 *     position.  The DOM renders in screen-space as a normal HTML overlay
 *     — crisp at any DPI, fully interactive, never occluded.  The camera
 *     tilt animation still does the visual heavy lifting: the avatar leans
 *     out of frame, the desk fills the view, and the quiz paper appears
 *     centred.  Best of both worlds.
 *
 *   The trade-off: the quiz doesn't visibly tilt with the desk geometry.
 *   In practice this reads as "the student is leaning over the desk and
 *   looking straight down at the page" — entirely natural.
 */

import { Html } from "@react-three/drei";
import { useAristoStore } from "@/store/useAristoStore";
import { QuizView } from "@/components/quiz/QuizView";

// ─── Tunables ────────────────────────────────────────────────────────────────

// Anchor point — placed on the student's desk surface immediately in
// front of the lesson camera (≈0.45 m forward, ≈0.75 m below).  Tuned in
// the /dev/desk-quiz harness so the projected paper sits on the desktop
// once CameraController has tilted to the desk framing.  Coordinates are
// in world space; with <Html center> the DOM centres at the screen
// projection of this world point so the paper rests visually on the desk
// regardless of viewport aspect.
const PAPER_ANCHOR: [number, number, number] = [0, -0.75, -0.45];

// ─── Component ───────────────────────────────────────────────────────────────

interface DeskQuizProps {
  /** Override paper anchor (dev tuning only). */
  paperAnchor?: [number, number, number];
}

export function DeskQuiz({ paperAnchor }: DeskQuizProps = {}) {
  const activeQuiz    = useAristoStore((s) => s.activeQuiz);
  const userId        = useAristoStore((s) => s.userId);
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
      center
      // zIndexRange keeps the quiz above any other Html (callouts, image
      // toolbar) so they can't peek through during the tilt.
      zIndexRange={[200, 0]}
    >
      <div
        className="aristo-scroll"
        style={{
          width:         "min(520px, 86vw)",
          maxHeight:     "min(620px, 78vh)",
          overflowY:     "auto",
          background:    "#fffef8",
          borderRadius:  "16px",
          padding:       "18px 20px",
          boxShadow:     "0 32px 90px rgba(30,14,6,0.65), 0 0 0 1px rgba(249,123,47,0.12)",
          color:         "#1a1a2e",
          fontFamily:    "system-ui, sans-serif",
          // Subtle paper-on-desk drop tone — soft warm shadow under the
          // sheet so it feels grounded against the wood backdrop.
          backgroundImage: "linear-gradient(180deg, #fffef8 0%, #fdf6e8 100%)",
          animation:     "aristoPaperIn 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both",
        }}
      >
        <style>{`
          @keyframes aristoPaperIn {
            from { opacity: 0; transform: translateY(14px) scale(0.97); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>
        <QuizView
          conceptId={activeQuiz.conceptId}
          questions={activeQuiz.questions}
          userId={userId}
          onComplete={handleComplete}
        />
      </div>
    </Html>
  );
}
