"use client";

// Smart wrapper around LoadingScreenVisual — mounted inside LearnClient,
// outside the R3F <Canvas> (regular DOM, absolutely positioned over it).
//
// Progress source: drei's useProgress() is a plain Zustand store that
// subscribes to THREE.DefaultLoadingManager directly (see
// node_modules/@react-three/drei/core/Progress.js) — it does NOT need to be
// called inside the Canvas/Fiber tree, only inside the same JS realm as the
// GLTFLoader/TextureLoader instances doing the fetching, which is true here
// since AristoCanvas lives in the same client bundle.
//
// "Scene painted a frame" source: useProgress hitting 100 only means bytes
// finished downloading — it says nothing about the first actual paint (GPU
// upload / first R3F frame). AristoCanvas mounts a tiny bridge component
// (SceneReadyReporter) INSIDE the Canvas's Suspense boundary that flips
// `sceneReady` in the Zustand store on its first useFrame call. We gate the
// fade-out on both signals so the overlay never drops a beat early onto a
// blank/unrendered canvas.
import { useEffect, useRef, useState } from "react";
import { useProgress } from "@react-three/drei";
import { AnimatePresence, motion } from "framer-motion";
import { useAristoStore } from "@/store/useAristoStore";
import { LoadingScreenVisual } from "@/components/learn/LoadingScreenVisual";

// Cold-start payload is ~3.4 MB post T02 asset diet — on most connections
// useProgress can jump 0 -> 100 in well under this window. Enforcing a
// minimum display time avoids a spinner-blink strobe on fast loads while
// staying invisible on slow ones (where it never binds — the real load time
// dwarfs it).
const MIN_DISPLAY_MS = 400;
const FADE_MS = 280;
const STALL_MS = 20_000;

export function SceneLoadingOverlay() {
  const { progress } = useProgress();
  const sceneReady = useAristoStore((s) => s.sceneReady);

  const [mountedAt] = useState(() => Date.now());
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [stalled, setStalled] = useState(false);

  const progressRef = useRef(progress);
  const lastChangeAtRef = useRef(Date.now());

  const done = progress >= 100 && sceneReady;

  // Minimum display timer — starts once, independent of load speed.
  useEffect(() => {
    const remaining = Math.max(0, MIN_DISPLAY_MS - (Date.now() - mountedAt));
    const t = setTimeout(() => setMinTimeElapsed(true), remaining);
    return () => clearTimeout(t);
  }, [mountedAt]);

  // Track the last time progress actually moved, for stall detection.
  useEffect(() => {
    if (progress !== progressRef.current) {
      progressRef.current = progress;
      lastChangeAtRef.current = Date.now();
      if (stalled) setStalled(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  // Poll for a stall while still loading.
  useEffect(() => {
    if (done) return;
    const id = setInterval(() => {
      if (Date.now() - lastChangeAtRef.current > STALL_MS) setStalled(true);
    }, 1000);
    return () => clearInterval(id);
  }, [done]);

  useEffect(() => {
    if (done && minTimeElapsed) setDismissed(true);
  }, [done, minTimeElapsed]);

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          key="scene-loading-overlay"
          className="fixed inset-0 z-[100]"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: FADE_MS / 1000, ease: "easeInOut" }}
        >
          <LoadingScreenVisual progress={progress} stalled={stalled} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
