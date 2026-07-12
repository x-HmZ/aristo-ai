"use client";

// Shared, presentational loading visual for /learn's cold-start path.
//
// Rendered in TWO places that must stay pixel-identical so the handoff
// between them is invisible:
//   1. pages/learn.tsx — the next/dynamic() `loading:` fallback (0% state,
//      no real data available yet — the LearnClient/Canvas bundle hasn't
//      loaded). This file has zero dependency on @react-three/drei or the
//      Zustand store so it stays safe to import from the Pages Router file
//      and can even be server-rendered as the first paint.
//   2. SceneLoadingOverlay.tsx — the "smart" wrapper mounted once the Canvas
//      is live, which feeds this component real GLB progress from drei's
//      useProgress() plus stall detection.
//
// This component owns no timers besides the microcopy rotation — all
// visibility/fade/stall *decisions* live in SceneLoadingOverlay.

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const MICROCOPY = [
  "Setting up your classroom...",
  "Your teacher is on the way...",
  "Arranging the desks...",
  "Warming up the whiteboard...",
  "Getting your notes ready...",
];

const MICROCOPY_INTERVAL_MS = 2400;

interface LoadingScreenVisualProps {
  /** 0–100. */
  progress: number;
  /** True after ~20s with no progress change — shows a retry hint. */
  stalled?: boolean;
  onReload?: () => void;
}

export function LoadingScreenVisual({ progress, stalled = false, onReload }: LoadingScreenVisualProps) {
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    if (stalled) return; // freeze on the last line once we show the stall hint
    const id = setInterval(() => {
      setLineIndex((i) => (i + 1) % MICROCOPY.length);
    }, MICROCOPY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [stalled]);

  const pct = Math.max(0, Math.min(100, Math.round(progress)));

  const handleReload = () => {
    if (onReload) return onReload();
    if (typeof window !== "undefined") window.location.reload();
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-aristo-gradient">
      {/* Atmosphere — soft blurred fields, calm not busy */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-aristo-orange-light/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-16 w-[28rem] h-[28rem] rounded-full bg-aristo-orange-pale/40 blur-3xl" />

      <div className="relative flex flex-col items-center gap-6 px-8 py-10 rounded-3xl glass shadow-aristo-lg w-[min(90vw,360px)]">
        {/* Wordmark */}
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-[#3D2110] text-2xl tracking-tight">aristo</span>
          <span className="text-aristo-orange text-2xl font-bold animate-pulse-soft">✦</span>
        </div>

        {/* Progress bar — slim, single element, no spinner stacked on top */}
        <div className="w-full flex flex-col gap-2">
          <div className="w-full h-1.5 rounded-full bg-aristo-beige-dark/60 overflow-hidden">
            <div
              className="h-full rounded-full bg-aristo-orange transition-[width] duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Microcopy / stall hint */}
          <div className="h-4 flex items-center justify-center">
            <AnimatePresence mode="wait">
              {stalled ? (
                <motion.span
                  key="stalled"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-[#8B6E5A] text-center"
                >
                  Taking longer than usual — check your connection.
                </motion.span>
              ) : (
                <motion.span
                  key={lineIndex}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.3 }}
                  className="text-xs text-[#8B6E5A] text-center"
                >
                  {MICROCOPY[lineIndex]}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {stalled && (
          <button
            onClick={handleReload}
            className="text-xs font-semibold text-white bg-aristo-orange hover:bg-[#E06A20] rounded-full px-4 py-1.5 transition-colors shadow-aristo-sm"
          >
            Reload
          </button>
        )}
      </div>
    </div>
  );
}
