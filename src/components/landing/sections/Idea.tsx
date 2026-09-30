import { useRef } from "react";
import { cn } from "@/lib/utils";
import { SHAPE } from "@/lib/design/shape";
import { COLUMN } from "@/components/brand/markPaths";
import { IDEA } from "../content";
import { Pinned, show, useStageWriter } from "../Pinned";
import { easeOut, seg, window01 } from "../stage/timeline";
import { shared } from "../stage/shared";
import { Still } from "./parts";

/**
 * The Idea: the Column draws itself, its middle flute lights, and the story appears on the classroom display in
 * three beats. The beats are real text in an ink-glass card placed over the display's projected rectangle (the
 * stage publishes it in `shared.display`); on the lite path the card sits over a still of the display instead.
 */
export function Idea() {
  const head = useRef<HTMLDivElement>(null);
  const outline = useRef<SVGPathElement>(null);
  const fill = useRef<SVGGElement>(null);
  const lit = useRef<SVGPathElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const beats = useRef<(HTMLParagraphElement | null)[]>([]);
  const still = useRef<HTMLDivElement>(null);

  useStageWriter((f) => {
    const p = f.progress[1];
    const inOut = window01(p, 0.02, 0.86, 0.08);
    show(head.current, inOut, 16 * (1 - easeOut(seg(p, 0, 0.1))));
    // The column: outline drawn 0 to 0.12, filled by 0.18, the flute lit by 0.22.
    if (outline.current) outline.current.style.strokeDashoffset = String(1 - seg(p, 0, 0.12));
    if (fill.current) fill.current.style.opacity = String(seg(p, 0.1, 0.18));
    if (lit.current) lit.current.style.opacity = String(seg(p, 0.16, 0.22));
    // The card over the display, and the three beats inside it.
    const d = shared.display;
    if (card.current && !shared.live && card.current.style.left) card.current.removeAttribute("style");
    if (card.current && d && shared.live) {
      const s = card.current.style;
      s.left = `${Math.round(d.x + d.w * 0.08)}px`;
      s.top = `${Math.round(d.y + d.h * 0.18)}px`;
      s.width = `${Math.round(d.w * 0.84)}px`;
      s.right = "auto";
      s.bottom = "auto";
      s.maxWidth = "none";
    }
    show(card.current, window01(p, 0.2, 0.84, 0.05));
    const windows: [number, number][] = [[0.22, 0.42], [0.46, 0.64], [0.68, 0.84]];
    windows.forEach(([a, b], i) => show(beats.current[i], window01(p, a, b, 0.04), 10 * (1 - seg(p, a - 0.04, a))));
    show(still.current, window01(p, 0.05, 0.9, 0.08));
  }, 1);

  return (
    <Pinned id="idea" labelledBy="idea-title">
      {/* The section for screen readers, whole and in order: the beats below take turns on screen. */}
      <div className="sr-only">
        <h2 id="idea-title">{IDEA.title}</h2>
        {IDEA.beats.map((b) => <p key={b}>{b}</p>)}
      </div>
      <Still ref={still} name="idea" />
      <div className="relative mx-auto h-full w-full max-w-6xl px-5 pt-[96px] sm:px-8">
        <div ref={head} className="landing-beat relative z-10 flex items-center gap-4">
          <svg viewBox={COLUMN.viewBox} aria-hidden className="h-14 w-auto shrink-0 sm:h-16">
            <path ref={outline} d={COLUMN.ink + COLUMN.lit} pathLength={1} className="fill-none stroke-ink" strokeWidth={10} style={{ strokeDasharray: 1, strokeDashoffset: 1 }} />
            <g ref={fill} style={{ opacity: 0 }}>
              <path d={COLUMN.ink} className="fill-ink" />
            </g>
            <path ref={lit} d={COLUMN.lit} className="fill-accent" style={{ opacity: 0, filter: "drop-shadow(0 0 18px rgb(var(--glow) / 0.8))" }} />
          </svg>
          <p aria-hidden className="text-[28px] font-extrabold leading-[1.08] tracking-[-0.02em] sm:text-4xl">
            <span className={cn(SHAPE.control, "theme-ink inline-block bg-bg/[0.86] px-3 py-1.5 text-ink backdrop-blur-md")}>{IDEA.title}</span>
          </p>
        </div>

        {/* Default place (lite, before the stage publishes the display): centred low in the frame. */}
        <div
          ref={card}
          className={cn(
            SHAPE.surface,
            "theme-ink landing-beat absolute bottom-[14svh] left-5 right-5 z-10 border border-line bg-bg/[0.86] px-6 py-5 shadow-e2 backdrop-blur-md sm:left-8 sm:right-auto sm:max-w-[560px] sm:px-8 sm:py-7"
          )}
        >
          <div className="landing-overlap" aria-hidden>
            {IDEA.beats.map((beat, i) => (
              <p
                key={beat}
                ref={(el) => { beats.current[i] = el; }}
                className="landing-beat text-lg font-medium leading-snug text-ink sm:text-xl lg:text-2xl"
              >
                {beat}
              </p>
            ))}
          </div>
        </div>
      </div>
    </Pinned>
  );
}
