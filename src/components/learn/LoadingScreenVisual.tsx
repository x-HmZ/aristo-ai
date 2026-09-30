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
//
// It is a page shown before the room exists, so it follows the theme (V8.4c):
// the page ground, a surface card, the accent progress fill on a sunk track.
// The pre-paint script in pages/_document.tsx applies a stored choice before
// this first paint.

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AristoMark } from "@/components/brand/AristoMark";
import { FOCUS, PRESS, SHAPE } from "@/lib/design/shape";
import { cn } from "@/lib/utils";

const MICROCOPY = [
  "Setting up your classroom…",
  "Your teacher is on the way…",
  "Arranging the desks…",
  "Switching on the board…",
  "Getting your notes ready…",
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
    // The caption cross-fades (opacity only, no slide), so there is no
    // motion to drop under prefers-reduced-motion.
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-bg">
      <div className={cn(SHAPE.surface, "flex w-[min(90vw,360px)] flex-col items-center gap-6 border border-line bg-surface px-8 py-10 shadow-e1")}>
        <AristoMark decorative={false} className="h-[22px] text-ink" litClassName="text-accent" />

        {/* Progress bar — slim, single element, no spinner stacked on top */}
        <div className="flex w-full flex-col gap-2">
          <div
            role="progressbar"
            aria-label="Loading the classroom"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            className="h-1.5 w-full overflow-hidden rounded-full bg-sunk"
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-slow ease-out-soft"
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Microcopy / stall hint */}
          <div className="flex min-h-4 items-center justify-center" aria-live="polite">
            <AnimatePresence mode="wait">
              {stalled ? (
                <motion.span
                  key="stalled"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center text-xs text-muted"
                >
                  This is taking longer than usual. Check your connection.
                </motion.span>
              ) : (
                <motion.span
                  key={lineIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-center text-xs text-muted"
                >
                  {MICROCOPY[lineIndex]}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* The system Button's default look, as a plain button: this file is
            in /learn and /demo's first load, and ui/button would add
            cva and Slot to it for one rarely shown control. */}
        {stalled && (
          <button
            type="button"
            onClick={handleReload}
            className={cn(SHAPE.control, PRESS, FOCUS, "inline-flex h-11 items-center justify-center bg-accent px-5 text-sm font-semibold text-accent-ink duration-fast ease-out-soft hover:bg-accent-hover")}
          >
            Reload
          </button>
        )}
      </div>
    </div>
  );
}
