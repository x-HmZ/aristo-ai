"use client";

/**
 * Callouts — small chip strip rendered above the teaching image panel.
 *
 * Shows the current segment's `visual.callouts` so the student can see at
 * a glance what the avatar is actually pointing at right now (e.g. "Left
 * atrium", "Mitral valve", "Left ventricle" while the narration is about
 * the mitral valve).
 *
 * Pure presentational — accepts the chip strings and renders them as ink
 * glass chips (`.theme-ink`, like the caption band: things placed on the lit
 * room stay ink in both themes).  Intended to be mounted via drei <Html />
 * inside Experience.tsx's TeachingImageInner so the strip is anchored to
 * the panel's screen-space position without leaving R3F coordinate space.
 */

import { memo } from "react";

interface CalloutsProps {
  /** 1–3 short labels (≤3 words each).  Empty list → renders nothing. */
  callouts: string[];
}

function CalloutsImpl({ callouts }: CalloutsProps) {
  if (!callouts || callouts.length === 0) return null;

  return (
    <div
      data-callouts
      className="theme-ink pointer-events-none flex max-w-[260px] flex-wrap justify-center gap-1.5"
    >
      {callouts.map((label, i) => (
        <span
          key={`${label}-${i}`}
          className="whitespace-nowrap rounded-full border border-line bg-bg/[0.86] px-2.5 py-1 text-xs font-semibold text-ink shadow-e1 backdrop-blur-md"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

export const Callouts = memo(CalloutsImpl);
