"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useRef, type ReactNode } from "react";
import { Experience } from "@/components/three/Experience";
import { useAristoStore } from "@/store/useAristoStore";

interface DevOverrides {
  deskPos?:     [number, number, number];
  deskTarget?:  [number, number, number];
  lambda?:      number;
  paperAnchor?: [number, number, number];
}

// Bridge component: lives inside the same Suspense boundary as <Experience>,
// so it only mounts once the initial GLB/texture Suspense resolves. Flips
// `sceneReady` on the store the first time R3F actually paints a frame with
// that content — SceneLoadingOverlay (rendered in plain DOM outside the
// Canvas) waits on this before fading out, so it never drops a beat early
// onto a blank/unrendered canvas.
function SceneReadyReporter() {
  const setSceneReady = useAristoStore((s) => s.setSceneReady);
  const reported = useRef(false);
  useFrame(() => {
    if (reported.current) return;
    reported.current = true;
    setSceneReady(true);
  });
  return null;
}

export function AristoCanvas({
  devOverrides,
  children,
}: { devOverrides?: DevOverrides; children?: ReactNode } = {}) {
  const modelInteracting = useAristoStore((s) => s.modelInteracting);
  // OrbitControls is disabled while the camera is locked on the desk for a
  // quiz — otherwise a stray drag would knock the framing off the paper
  // mid-question.  Re-enabled the moment activeQuiz clears (CameraController
  // also lerps the camera back to its lesson framing in parallel).
  const activeQuiz = useAristoStore((s) => s.activeQuiz);

  const controlsDisabled = modelInteracting || !!activeQuiz;

  return (
    <Canvas
      shadows
      // Camera sits at z=0.9 instead of z≈0 — pulled back ~30% of the 3-unit
      // teacher distance so we frame the avatar from chest-up instead of
      // crowding their face.  Target stays on the teacher at z=-3.
      camera={{ position: [0, 0, 0.9], fov: 40, near: 0.01 }}
      className="w-full h-full"
      gl={{ antialias: true, alpha: true }}
    >
      <Suspense fallback={null}>
        <Experience devOverrides={devOverrides} />
        <SceneReadyReporter />
      </Suspense>
      {children}
      <OrbitControls
        makeDefault
        enabled={!controlsDisabled}
        enablePan={false}
        enableZoom={false}
        // Pivot 0.5 m in front of the camera (camera z=0.9, target z=0.4)
        // instead of on the teacher 3.9 m away.  Orbiting a far target swung
        // the camera through the classroom walls; a near pivot makes drag
        // feel like the student turning their head from their seat.
        // minPolar π/6 lets them look ~60° down — enough to see their own
        // desk (and the quiz placeholder paper) without leaving the chair.
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 1.8}
        minAzimuthAngle={-Math.PI / 4}
        maxAzimuthAngle={Math.PI / 4}
        target={[0, 0, 0.4]}
      />
    </Canvas>
  );
}
