import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SECTIONS, type SectionId } from "./stage/timeline";
import { addWriter, type Writer } from "./stage/scroll";

/**
 * A pinned landing section: `vh` viewport heights tall (timeline.ts SECTIONS), its frame stuck to the viewport while
 * the reader scrolls through it. Beats inside are `landing-beat` and placed absolutely; under reduced motion or
 * without JS they fall into a plain stack (globals.css).
 */
export function Pinned({
  id, labelledBy, className, frameClassName, children,
}: { id: SectionId; labelledBy?: string; className?: string; frameClassName?: string; children: ReactNode }) {
  const spec = SECTIONS.find((s) => s.id === id)!;
  const vh = "vh" in spec ? spec.vh : 100;
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn("landing-pin relative", className)}
      style={{ "--pin-h": `${vh}svh` } as CSSProperties}
    >
      <div className={cn("landing-pin-frame", frameClassName)}>{children}</div>
    </section>
  );
}

/**
 * Register a writer with the scroll driver for the component's lifetime. The writer runs once per frame the page
 * moves, reads the frame and writes to refs; it must never set React state. The latest closure is always used.
 */
export function useStageWriter(writer: Writer): void {
  const ref = useRef(writer);
  ref.current = writer;
  useEffect(() => addWriter((f) => ref.current(f)), []);
}

/** Opacity and a vertical offset in one write; skips the style write when nothing changed. */
export function show(el: HTMLElement | SVGElement | null, opacity: number, y = 0, scale = 1): void {
  if (!el) return;
  const o = opacity < 0.001 ? 0 : opacity > 0.999 ? 1 : +opacity.toFixed(3);
  const t = y === 0 && scale === 1 ? "none" : `translate3d(0, ${y.toFixed(1)}px, 0)${scale === 1 ? "" : ` scale(${scale.toFixed(4)})`}`;
  const s = (el as HTMLElement).style;
  if (s.opacity !== String(o)) s.opacity = String(o);
  if (s.transform !== t) s.transform = t;
  const vis = o === 0 ? "hidden" : "visible";
  if (s.visibility !== vis) s.visibility = vis;
}
