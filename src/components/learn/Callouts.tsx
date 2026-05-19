"use client";

/**
 * Callouts — small chip strip rendered above the teaching image panel.
 *
 * Shows the current segment's `visual.callouts` so the student can see at
 * a glance what the avatar is actually pointing at right now (e.g. "Left
 * atrium", "Mitral valve", "Left ventricle" while the narration is about
 * the mitral valve).
 *
 * Pure presentational — accepts the chip strings and renders them in a
 * frosted, pastel-orange row.  Intended to be mounted via drei <Html />
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
      style={{
        display:        "flex",
        flexWrap:       "wrap",
        justifyContent: "center",
        gap:            "5px",
        pointerEvents:  "none",
        maxWidth:       "260px",
      }}
    >
      {callouts.map((label, i) => (
        <span
          key={`${label}-${i}`}
          style={{
            background:    "rgba(255, 245, 236, 0.94)",
            border:        "1px solid rgba(249, 123, 47, 0.4)",
            color:         "#C05A1C",
            borderRadius:  "20px",
            padding:       "3px 9px",
            fontSize:      "10px",
            fontWeight:    700,
            letterSpacing: "0.02em",
            whiteSpace:    "nowrap",
            boxShadow:     "0 2px 8px rgba(249, 123, 47, 0.18)",
          }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

export const Callouts = memo(CalloutsImpl);
