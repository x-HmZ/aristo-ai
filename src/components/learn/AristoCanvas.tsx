"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Experience } from "@/components/three/Experience";
import { useHtmlLayer } from "@/components/three/SceneHtml";
import { MIN_POLAR_ANGLE } from "@/components/three/deskFraming";
import { useAristoStore } from "@/store/useAristoStore";
import { layoutModeOf, useClassroomLayout } from "@/store/useClassroomLayout";

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

/**
 * The room as the classroom pages lay it out: an input layer at the bottom (the canvas's event source: orbit, clicks on
 * the display) and the canvas above it with `pointer-events: none`. The widget's board card sits between the two
 * (InteractiveStage, z-[1]) and shows through the display's screen, so the teacher draws over it; a pointer over the
 * card reaches its iframe, anywhere else on the room it reaches the input layer. Panels and chrome sit above both.
 * A pointer over the teacher's hand where it covers the card still reaches the widget. The classroom pages use this,
 * not the bare AristoCanvas (dev pages only).
 */
export function ClassroomStage() {
  const [source, setSource] = useState<HTMLDivElement | null>(null);
  const setHtmlEl = useHtmlLayer((s) => s.setEl);
  const setLayout = useClassroomLayout((s) => s.set);
  // Which shape the page takes on this screen (desk, phone upright, phone on its side), kept as the window changes.
  // Before the first paint, so a phone never shows the desk layout for a frame.
  useLayoutEffect(() => {
    const read = () => {
      const w = window.innerWidth, h = window.innerHeight;
      setLayout({ mode: layoutModeOf(w, h), viewport: { w, h } });
    };
    read();
    window.addEventListener("resize", read);
    window.addEventListener("orientationchange", read);
    return () => {
      window.removeEventListener("resize", read);
      window.removeEventListener("orientationchange", read);
      // Leaving the classroom: the next page starts from the desk layout, with no panel over the canvas.
      setLayout({ mode: "desk", panelRight: 0, panelBottom: 0 });
    };
  }, [setLayout]);
  return (
    <>
      <div ref={setSource} className="absolute inset-0 z-0" />
      <div className="pointer-events-none absolute inset-0 z-[2]">
        {source && <AristoCanvas eventSource={source} />}
      </div>
      {/* The scene's Html overlays (SceneHtml) go here: above the canvas, same box, pointer-events on the content only. */}
      <div ref={setHtmlEl} className="pointer-events-none absolute inset-0 z-[3] overflow-hidden" />
    </>
  );
}

export function AristoCanvas({
  devOverrides,
  children,
  eventSource,
}: { devOverrides?: DevOverrides; children?: ReactNode; eventSource?: HTMLElement } = {}) {
  const modelInteracting = useAristoStore((s) => s.modelInteracting);
  // Scroll and drag on the display zoom and pan the picture there, not the camera.
  const boardInteracting = useAristoStore((s) => s.boardInteracting);
  // OrbitControls is disabled while the camera is locked on the desk for a
  // quiz — otherwise a stray drag would knock the framing off the paper
  // mid-question.  Re-enabled the moment activeQuiz clears (CameraController
  // also lerps the camera back to its lesson framing in parallel).
  const activeQuiz = useAristoStore((s) => s.activeQuiz);

  const controlsDisabled = modelInteracting || boardInteracting || !!activeQuiz;

  return (
    <Canvas
      shadows
      eventSource={eventSource}
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
        // Also the clamp on the desk camera (deskFraming.ts works from the clamped pose), hence the shared constant.
        minPolarAngle={MIN_POLAR_ANGLE}
        maxPolarAngle={Math.PI / 1.8}
        minAzimuthAngle={-Math.PI / 4}
        maxAzimuthAngle={Math.PI / 4}
        target={[0, 0, 0.4]}
      />
    </Canvas>
  );
}
