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
 * room stay ink in both themes).  Mounted via drei <Html /> inside
 * Experience.tsx's TeachingImageInner, bottom edge anchored just above the
 * frame, so the strip is tied to the panel's screen-space position.
 *
 * Where the board image runs under the lesson panel (1280px wide), the strip
 * slides left until it clears the panel instead of hiding a chip under it.
 */

import { memo, useLayoutEffect, useRef, useState } from "react";
import { PANEL_INSET_PX } from "@/components/learn/ClassroomChrome";

interface CalloutsProps {
  /** 1–3 short labels (≤3 words each).  Empty list → renders nothing. */
  callouts: string[];
}

const GAP_PX = 12;

function CalloutsImpl({ callouts }: CalloutsProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [dx, setDx] = useState(0);
  const dxRef = useRef(0);
  const key = callouts.join("|");

  useLayoutEffect(() => {
    const fit = () => {
      const el = ref.current;
      if (!el) return;
      // Measure where the strip would sit with no shift; the panel only floats beside the room from sm up.
      const r = el.getBoundingClientRect();
      const left = r.left + dxRef.current;
      const right = r.right + dxRef.current;
      const limit = window.innerWidth - PANEL_INSET_PX - GAP_PX;
      const next = window.innerWidth >= 640 && right > limit ? Math.min(right - limit, Math.max(0, left - GAP_PX)) : 0;
      dxRef.current = next;
      setDx(next);
    };
    // drei places the Html wrapper on the next frames, so measure again once it is where it will stay.
    const raf = requestAnimationFrame(() => requestAnimationFrame(fit));
    const late = window.setTimeout(fit, 600);
    window.addEventListener("resize", fit);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(late);
      window.removeEventListener("resize", fit);
    };
  }, [key]);

  if (!callouts || callouts.length === 0) return null;

  return (
    <div
      ref={ref}
      data-callouts
      style={dx ? { translate: `${-dx}px 0` } : undefined}
      // w-max: drei's Html wrapper has no width, so without it the strip shrinks and wraps after every chip.
      className="theme-ink pointer-events-none flex w-max max-w-[min(480px,36vw)] flex-wrap justify-center gap-1.5"
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
