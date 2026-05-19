"use client";

/**
 * CameraController — exponentially-damped camera lerp between two framings.
 *
 *   • "lesson"  — default tutoring shot of the avatar.
 *   • "desk"    — looking down at the desk paper while activeQuiz is set.
 *
 * Why exponential damping (not progress + ease):
 *   • The previous implementation advanced a `progress` scalar at a fixed
 *     rate and ran the result through a cubic ease.  At <60 fps this lands
 *     "stair-step" motion that the eye reads as jerky.  Critically-damped
 *     exponential ease — `current += (target - current) * (1 - exp(-λ·dt))`
 *     — gives smooth, frame-rate-independent motion identical to what
 *     SwiftUI / iOS uses for camera moves.
 *   • One scratch Vector3 per channel, no allocations per frame.
 *
 * Mount inside the <Canvas>.  Reads `activeQuiz` from the store to pick
 * which framing to chase; LearnClient owns set/clear of that state.
 */

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { Vector3 } from "three";
import { useAristoStore } from "@/store/useAristoStore";

// ─── Named framings ──────────────────────────────────────────────────────────

const LESSON_POS    = new Vector3(0,    0,    0.9);
const LESSON_TARGET = new Vector3(0,    0,   -3);

// Desk view — camera stays essentially at the student's POV and simply
// tilts the gaze downward toward the desk surface in front of them.  This
// "student looking down at their own paper" framing was tuned in the
// /dev/desk-quiz harness (see HANDOFF_DESK_QUIZ.md).
//
// Why we don't aim at the PLACEMENT.default.desk anchor in Classroom.tsx
// — that anchor is the *teacher's* desk further back in the room.  The
// student sits in a chair near the lesson-camera origin; the desk in
// front of them is at roughly z=-0.6 in world space, with its surface
// near y=-1.05.  Pointing the camera at that surface keeps the chair
// across the table softly visible in the background for context rather
// than blocking the view.
const DESK_POS    = new Vector3(0,    0.2,  -0.05);
const DESK_TARGET = new Vector3(0,   -1.05, -0.6);

// Damping strength.  Higher = snappier.  λ=3.2 → ~95 % of distance covered
// in ~0.9 s while never popping at the start/end — feels like a smooth
// camera operator, not a teleport.
const LAMBDA = 3.2;

// Threshold under which we consider the camera "landed" and hand control
// back to OrbitControls (only relevant for the lesson framing).
const SNAP_EPSILON = 0.0008;

// ─── Component ───────────────────────────────────────────────────────────────

interface CameraControllerProps {
  /** Override desk camera position (dev tuning only). */
  deskPos?:    [number, number, number];
  /** Override desk look-at target (dev tuning only). */
  deskTarget?: [number, number, number];
  /** Override damping λ (dev tuning only). */
  lambda?:     number;
}

export function CameraController({ deskPos, deskTarget, lambda }: CameraControllerProps = {}) {
  const { camera, controls } = useThree();
  const activeQuiz = useAristoStore((s) => s.activeQuiz);

  // Live camera position and look-at point — mutated each frame.
  const livePos    = useRef(new Vector3().copy(LESSON_POS));
  const liveTarget = useRef(new Vector3().copy(LESSON_TARGET));

  // Per-frame goals.  We re-build the Vector3 from a tuple each frame only
  // when an override is passed; in the normal (production) path we read the
  // module-level constant directly with zero allocations.
  const goalPosOverride    = useRef(new Vector3());
  const goalTargetOverride = useRef(new Vector3());

  useFrame((_, delta) => {
    let goalPos:    Vector3;
    let goalTarget: Vector3;
    if (activeQuiz) {
      if (deskPos) {
        goalPosOverride.current.set(deskPos[0], deskPos[1], deskPos[2]);
        goalPos = goalPosOverride.current;
      } else {
        goalPos = DESK_POS;
      }
      if (deskTarget) {
        goalTargetOverride.current.set(deskTarget[0], deskTarget[1], deskTarget[2]);
        goalTarget = goalTargetOverride.current;
      } else {
        goalTarget = DESK_TARGET;
      }
    } else {
      goalPos    = LESSON_POS;
      goalTarget = LESSON_TARGET;
    }
    const L = lambda ?? LAMBDA;

    // Critically-damped exponential ease.  `1 - exp(-λ·dt)` is the
    // frame-rate-independent equivalent of "lerp by ~λ percent per second"
    // — looks identical at 30 fps and 144 fps.
    const t = 1 - Math.exp(-L * Math.min(delta, 0.1));
    livePos.current   .lerp(goalPos,    t);
    liveTarget.current.lerp(goalTarget, t);

    // When we're at rest at the lesson framing AND OrbitControls is enabled
    // (no quiz active), step aside and let the user orbit freely — without
    // this we'd fight every interaction.
    const isAtLesson =
      !activeQuiz &&
      livePos.current.distanceToSquared(LESSON_POS) < SNAP_EPSILON &&
      liveTarget.current.distanceToSquared(LESSON_TARGET) < SNAP_EPSILON;
    if (isAtLesson) return;

    camera.position.copy(livePos.current);
    camera.lookAt(liveTarget.current);

    // Keep OrbitControls' internal target in sync so it doesn't snap us
    // back to its remembered target on the first post-quiz drag.
    const ctrls = controls as unknown as { target?: Vector3; update?: () => void } | null;
    if (ctrls?.target) {
      ctrls.target.copy(liveTarget.current);
      ctrls.update?.();
    }
  });

  return null;
}
