import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAP_COPY } from "../content";
import { COURSE, CURVE_DAYS, CURVE_REVIEWS, EDGES, NODES, ORDER, recallOn } from "../mapStory";
import { clockOf, restart, setPaused, subscribeClock, useCue, useSectionPlay } from "../play";
import { Spot } from "../Spot";
import type { LandingMode } from "../stage/gate";
import { REMEMBER_T, boardBox, curveDayAt, curveTimeOf } from "../stage/scripts";
import { BOARD as BOARD_PLACE, BOARD_ASPECT } from "../stage/spots";
import { BTN_GHOST, H2, LEDE, REAL, WRAP } from "../ui";

/**
 * The card: on the classroom board's place, from just past his pointing hand (CARD_FROM of the board's width) to the
 * board's right edge, and nearly the board's height (CARD_Y, from its top), so its words have room at every width.
 */
const BOARD = boardBox("remember");
const CARD_FROM = 0.22;
const CARD_Y = [0.04, 0.96] as const;
const CARD = {
  left: BOARD.left + BOARD.width * CARD_FROM, width: BOARD.width * (1 - CARD_FROM),
  top: BOARD.top + BOARD.height * CARD_Y[0], height: BOARD.height * (CARD_Y[1] - CARD_Y[0]),
};
/** His fingertip's height while PointNear holds (world m), as a share down the board (BOARD_PLACE: centre, side). */
const FINGER_Y = 0.33;
const lineOnBoard = (BOARD_PLACE.center[1] + BOARD_PLACE.size / 2 - FINGER_Y) / BOARD_PLACE.size;
/** A share of the board's width (from its left edge) as a share of the card's, in %. */
const onCard = (ofBoard: number) => ((ofBoard - CARD_FROM) / (1 - CARD_FROM)) * 100;

/**
 * The plot inside the card, in % of it: days across, recall up. Placed from his pointing hand (eval rtrack1): PointNear
 * holds his fingertip at about (0.1, 0.33) m, 35% across the board and on the card's 36% line, so the first review
 * point (day 2) is there and the others lie further along his finger's line, never short of it (days 0 to 21 run from
 * 29.6% to 89% of the board).
 */
const PLOT = {
  x0: onCard(0.296), x1: onCard(0.89),
  top: ((lineOnBoard - CARD_Y[0]) / (CARD_Y[1] - CARD_Y[0])) * 100,
  bottom: 80,
} as const;
const px = (day: number) => PLOT.x0 + ((PLOT.x1 - PLOT.x0) * day) / CURVE_DAYS;
const py = (recall: number) => PLOT.bottom - (PLOT.bottom - PLOT.top) * recall;

/** The curve as a path in the card's 0 to 100 box: it fades after each review and jumps back up at the next one. */
const CURVE_PATH = (() => {
  const pt = (day: number, r: number) => `${px(day).toFixed(2)} ${py(r).toFixed(2)}`;
  let d = `M ${pt(0, 1)}`;
  for (let i = 0; i < CURVE_REVIEWS.length; i++) {
    const from = CURVE_REVIEWS[i], to = i + 1 < CURVE_REVIEWS.length ? CURVE_REVIEWS[i + 1] : CURVE_DAYS;
    for (let day = from + 0.1; day < to; day += 0.1) d += ` L ${pt(day, recallOn(day))}`;
    // Just before the review, then the review lifting it back to the top.
    d += ` L ${pt(to, recallOn(to - 1e-6))}`;
    if (i + 1 < CURVE_REVIEWS.length) d += ` L ${pt(to, 1)}`;
  }
  return d;
})();

/** The reviews he taps (day 0 is learning it). */
const TAPS = CURVE_REVIEWS.slice(1);
/** The labels on the curve: where each sits, and the day the line must reach before it shows. */
const MARKS = [
  // Above the line: learning it, at the start, and coming back, over the last review (the first two are too close to
  // the start for a second label). Below it: the fade. (That each lasts longer is said beside the card: on a narrow
  // card a fourth label crowds the line.)
  // (Higher than the others: at the first tap his hand is just below it.)
  { text: MAP_COPY.marks.learn, day: 0, x: px(0) - 4, y: py(1) - 15, align: "start" },
  { text: MAP_COPY.marks.fade, day: 1.4, x: px(1.5) + 1.5, y: py(recallOn(1.4)) + 6, align: "start" },
  { text: MAP_COPY.marks.back, day: TAPS[2], x: px(TAPS[2]), y: py(1) - 10, align: "center" },
] as const satisfies readonly { text: string; day: number; x: number; y: number; align: "start" | "center" }[];

/**
 * One concept over three weeks, on paper (`.theme-paper`, ink on paper in both themes). On the live path the line is
 * drawn on the section's clock; each review point waits ringed until the line reaches it, then lights, and the next one
 * is marked as his finger's target (`data-aim`). Under reduced motion and on the lite path it is whole.
 */
function MemoryCard({ armed, aim, className, style }: { armed: boolean; aim: boolean; className?: string; style?: CSSProperties }) {
  const root = useRef<HTMLDivElement>(null);
  const clip = useRef<SVGRectElement>(null);
  const head = useRef<HTMLSpanElement>(null);
  const clipId = useMemo(() => `curve-clip-${aim ? "a" : "b"}`, [aim]);

  useEffect(() => {
    if (!armed) return;
    const paint = () => {
      const el = root.current;
      if (!el) return;
      const t = clockOf("remember").t;
      const day = curveDayAt(t, CURVE_DAYS);
      const w = (px(day) - PLOT.x0 + (day > 0 ? 0.6 : 0)).toFixed(2);
      if (clip.current && clip.current.getAttribute("width") !== w) clip.current.setAttribute("width", w);
      const drawing = day > 0 && day < CURVE_DAYS;
      if (head.current) {
        head.current.style.opacity = drawing ? "1" : "0";
        head.current.style.left = `${px(day)}%`;
        head.current.style.top = `${py(recallOn(day))}%`;
      }
      // A review point lights as the line reaches it; the next one is his finger's target, a moment after the last.
      let target = -1;
      TAPS.forEach((d, i) => {
        const dot = el.querySelector<HTMLElement>(`[data-tap="${i}"]`);
        const on = day >= d;
        if (dot) { if (on) dot.setAttribute("data-on", ""); else dot.removeAttribute("data-on"); }
        if (target < 0 && t < curveTimeOf(d, CURVE_DAYS) + REMEMBER_T.hold) target = i;
      });
      if (aim) TAPS.forEach((_, i) => {
        const dot = el.querySelector<HTMLElement>(`[data-tap="${i}"]`);
        if (!dot) return;
        if (i === Math.max(0, target === -1 ? TAPS.length - 1 : target)) dot.setAttribute("data-aim", "remember");
        else dot.removeAttribute("data-aim");
      });
      el.querySelectorAll<HTMLElement>("[data-mark]").forEach((m) => {
        if (day >= Number(m.dataset.mark)) m.setAttribute("data-on", ""); else m.removeAttribute("data-on");
      });
    };
    paint();
    return subscribeClock("remember", paint);
  }, [armed, aim]);

  return (
    <div
      ref={root}
      data-armed={armed || undefined}
      className={cn("theme-paper landing-memory overflow-hidden rounded-[20px] border border-line bg-surface text-ink shadow-e2", className)}
      style={style}
    >
      <div className="absolute right-[6%] top-[7%] text-right">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent-text">{MAP_COPY.curveTitle}</p>
        <p className="mt-0.5 text-[14px] font-semibold leading-tight text-ink sm:text-[15px]">{MAP_COPY.concept}</p>
      </div>
      <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <defs>
          <clipPath id={clipId}>
            <rect ref={clip} x={PLOT.x0} y="0" width={armed ? 0 : 100} height="100" />
          </clipPath>
        </defs>
        <line x1={PLOT.x0} x2={PLOT.x1} y1={py(1)} y2={py(1)} className="landing-memory-grid" vectorEffect="non-scaling-stroke" />
        <line x1={PLOT.x0} x2={PLOT.x1} y1={py(0)} y2={py(0)} className="landing-memory-grid" vectorEffect="non-scaling-stroke" />
        <path d={CURVE_PATH} clipPath={`url(#${clipId})`} className="landing-memory-line" vectorEffect="non-scaling-stroke" />
      </svg>
      {/* The day it was learned, and each review: orbs of the idea's light, waiting ringed until the line reaches them. */}
      <span aria-hidden className="landing-idea-orb landing-idea-ring absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${px(0)}%`, top: `${py(1)}%` }} />
      {TAPS.map((d, i) => (
        <span key={d} data-tap={i} data-track={`tap${i}`} aria-hidden className="landing-memory-tap absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${px(d)}%`, top: `${py(1)}%` }} />
      ))}
      <span ref={head} aria-hidden className="landing-memory-head absolute -translate-x-1/2 -translate-y-1/2" style={{ opacity: 0 }} />
      {MARKS.map((m) => (
        <span
          key={m.text}
          data-mark={m.day}
          className={cn("landing-memory-mark absolute text-[11px] font-semibold leading-tight text-body sm:text-[12px]", "whitespace-nowrap", m.align === "center" && "-translate-x-1/2")}
          style={{ left: `${m.x}%`, top: `${m.y}%` }}
        >
          {m.text}
        </span>
      ))}
      <div className="absolute bottom-[5%] flex justify-between text-[11px] text-muted" style={{ left: `${PLOT.x0}%`, right: `${100 - PLOT.x1}%` }}>
        {MAP_COPY.axis.map((a) => <span key={a}>{a}</span>)}
      </div>
      <p className="sr-only">
        {MAP_COPY.concept}: {MAP_COPY.marks.learn}, {MAP_COPY.marks.fade.toLowerCase()}, and each review on days {TAPS.join(", ")} brings it back. {MAP_COPY.curveLine}
      </p>
    </div>
  );
}

/** The map: how many concepts the example learner has mastered, in learning order, and the next one. */
const MASTERED = 11;
const DONE = new Set(ORDER.slice(0, MASTERED));
const NEXT = ORDER.find((id) => !DONE.has(id) && EDGES.filter(([, to]) => to === id).every(([from]) => DONE.has(from)))!;
const NEXT_NAME = NODES.find((n) => n.id === NEXT)!.name;
/** The links the next lesson starts from: each from a mastered concept into it. */
const INTO_NEXT = new Set(EDGES.filter(([, to]) => to === NEXT).map(([from, to]) => `${from}-${to}`));
const CONCEPT_ID = NODES.find((n) => n.name === MAP_COPY.concept)!.id;
const MAP_LENGTH = 2.6;
/** Cues: each mastered concept lights in learning order, then the next one's ring, then the two labels. */
const MAP_CUES = [...ORDER.slice(0, MASTERED).map((_, i) => 0.2 + i * 0.11), 1.6, 2.0] as const;
const NODE_AT = Object.fromEntries(NODES.map((n) => [n.id, { x: 4 + n.x * 92, y: 14 + n.y * 74 }]));

/**
 * The real course map (kg-snapshot.json, its first 20 concepts) on the classroom's display: the example learner's
 * mastered concepts light in learning order, the curve's concept among them; then the next lesson's ring pulses and
 * its link from what it builds on draws in, lit, because the next lesson starts from what you have mastered. The next
 * concept sits in the densest column of the course, so it is named in the legend under the map, not over its
 * neighbours. Plays once when it comes into view; on the lite path and under reduced motion it is whole.
 */
function CourseMap({ mode }: { mode: LandingMode | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useSectionPlay("map", ref, MAP_LENGTH, { mode });
  const { cue } = useCue("map", MAP_CUES);
  const armed = mode === "full";
  const lit = (id: string) => DONE.has(id) && (!armed || cue >= ORDER.indexOf(id));
  const nextOn = !armed || cue >= MASTERED;
  const marksOn = !armed || cue >= MASTERED + 1;
  const c = NODE_AT[CONCEPT_ID];
  return (
    <div ref={ref} className="theme-ink landing-map relative mt-10 overflow-hidden rounded-[20px] border border-line bg-sunk px-5 pb-5 pt-5 text-ink shadow-e2 sm:px-7">
      <div aria-hidden className="landing-display-glow absolute inset-0" />
      <div className="relative">
        <h3 className="text-[17px] font-semibold text-ink">{MAP_COPY.mapTitle}</h3>
        <p className="mt-1 text-[13px] text-body">{MAP_COPY.mapLine[0]} {COURSE.split(":")[0]}, {MAP_COPY.mapLine[1]}</p>
      </div>
      <div className="relative mt-4 h-[220px] sm:h-[240px]" role="img" aria-label={`${MAP_COPY.mapTitle}: ${MASTERED} of ${NODES.length} concepts mastered, ${MAP_COPY.concept} among them; next, ${NEXT_NAME}.`}>
        <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {EDGES.map(([a, b]) => (
            <line
              key={`${a}-${b}`}
              x1={NODE_AT[a].x} y1={NODE_AT[a].y} x2={NODE_AT[b].x} y2={NODE_AT[b].y}
              vectorEffect="non-scaling-stroke"
              className={cn(
                "landing-map-edge",
                lit(a) && lit(b) && "landing-map-edge-lit",
                INTO_NEXT.has(`${a}-${b}`) && "landing-map-edge-next",
                INTO_NEXT.has(`${a}-${b}`) && nextOn && "landing-map-edge-drawn",
              )}
            />
          ))}
        </svg>
        {NODES.map((node) => {
          const p = NODE_AT[node.id];
          const isNext = node.id === NEXT;
          return (
            <span
              key={node.id}
              aria-hidden
              title={node.name}
              className={cn(
                "landing-idea-orb absolute -translate-x-1/2 -translate-y-1/2",
                lit(node.id) ? "landing-idea-lit" : isNext && nextOn ? "landing-idea-ring landing-map-next" : "landing-map-later",
              )}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
            />
          );
        })}
        {/* Each on a chip of the display's own ground, so the links behind never run through its words. */}
        <span aria-hidden data-on={marksOn || undefined} className="landing-map-mark absolute -translate-x-1/2 whitespace-nowrap rounded-md bg-sunk px-1.5 py-0.5 text-center text-[12px] font-semibold text-ink" style={{ left: `${c.x}%`, top: `calc(${c.y}% + 12px)` }}>
          {MAP_COPY.concept}
          <span className="block text-[11px] font-normal text-body">{MAP_COPY.conceptMark}</span>
        </span>
      </div>
      {/* The legend, which also names the next lesson. */}
      <ul aria-hidden className="relative mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-body sm:text-[13px]">
        <li className="flex items-center gap-2"><span className="landing-idea-orb landing-idea-lit" />{MAP_COPY.legend.done}</li>
        <li data-on={nextOn || undefined} className="landing-map-mark flex items-center gap-2">
          <span className="landing-idea-orb landing-idea-ring" />
          <span>{MAP_COPY.legend.next} <span className="font-semibold text-accent-text">{NEXT_NAME}</span></span>
        </li>
        <li className="flex items-center gap-2"><span className="landing-idea-orb landing-map-later" />{MAP_COPY.legend.later}</li>
      </ul>
    </div>
  );
}

/**
 * It Remembers What You Know (V8.3b): one concept's memory over three weeks, drawn on a paper card at the classroom
 * board's place while Jake taps each review point as the line reaches it (the product's pointing, aimed at the point:
 * LandingStage, aim.ts), then the real course map, where what you have mastered lights and the next lesson starts from
 * it. Pause stops the curve and Replay starts it again. Below 640px the card stands alone. On the lite path and under
 * reduced motion the curve and the map are whole and he is a still at rest.
 */
export function Remember({ mode }: { mode: LandingMode | null }) {
  const stage = useRef<HTMLDivElement>(null);
  useSectionPlay("remember", stage, REMEMBER_T.length, { mode, spot: "remember" });
  const { cue, playing, paused } = useCue("remember", [0, REMEMBER_T.length]);
  const armed = mode === "full";
  const done = armed && cue >= 1 && !playing && !paused;

  return (
    <section id="map" aria-labelledby="remember-title" className="overflow-x-clip py-24">
      <div className={WRAP}>
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-14">
          <div>
            <h2 id="remember-title" className={H2}>{MAP_COPY.title}</h2>
            <p className={cn(LEDE, "mt-4")}>{MAP_COPY.line}</p>
            <p className="mt-4 max-w-[34rem] text-[15px] leading-relaxed text-body">{MAP_COPY.curveLine}</p>
            {armed && (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                {done ? (
                  <button type="button" onClick={() => restart("remember")} className={BTN_GHOST}>
                    <RotateCcw className="size-4" aria-hidden />
                    Replay
                  </button>
                ) : (
                  <button type="button" onClick={() => setPaused("remember", !paused)} className={BTN_GHOST}>
                    {paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
                    {paused ? "Play" : "Pause"}
                  </button>
                )}
              </div>
            )}
          </div>
          <div ref={stage} className="mx-auto w-full max-w-[760px] lg:max-w-none">
            <Spot
              id="remember"
              still="/images/landing/v3b/remember.webp"
              alt="{teacher} beside one concept's memory over three weeks"
              className="hidden w-full sm:block"
              style={{ aspectRatio: String(BOARD_ASPECT) }}
              pool="left-[30%] -right-[4%] top-[4%] h-[80%]"
              under={
                <MemoryCard
                  armed={armed}
                  aim
                  className="absolute"
                  style={{ left: `${CARD.left}%`, top: `${CARD.top}%`, width: `${CARD.width}%`, height: `${CARD.height}%` }}
                />
              }
            />
            <MemoryCard armed={false} aim={false} className="relative aspect-[4/3] w-full sm:hidden" />
          </div>
        </div>
        <CourseMap mode={mode} />
        <p className={cn(REAL, "mt-3")}>{MAP_COPY.label}</p>
      </div>
    </section>
  );
}
