import { useRef } from "react";
import { cn } from "@/lib/utils";
import { SHAPE } from "@/lib/design/shape";
import { HOW, IDEA_LINKS, IDEAS, MOVES, TOPIC } from "../content";
import { Pinned, show, useStageWriter } from "../Pinned";
import { easeOut, seg, window01 } from "../stage/timeline";
import { CaptionBand, StepRail, Still } from "./parts";

/** Where each of the six steps starts, as the section's progress. The diagram and the model are in the 3D stage. */
export const HOW_STEPS = [0, 0.12, 0.3, 0.48, 0.66, 0.88, 1] as const;
const stepAt = (p: number) => Math.max(0, HOW_STEPS.findIndex((a, i) => p >= a && p < HOW_STEPS[i + 1]));

const GLASS = "theme-ink border border-line bg-bg/[0.86] text-ink shadow-e2 backdrop-blur-md";

/**
 * From a Question to a Lesson, the centrepiece (pinned, six steps). This is its DOM layer: the typed question, the
 * ideas it breaks into, the five move cards, the step captions and the caption band. The diagram resolving and the
 * model being built are drawn by the stage (Diagram, HeartBuild); on the lite path each step has a still.
 */
export function Question() {
  const head = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLOListElement>(null);
  const ask = useRef<HTMLDivElement>(null);
  const typed = useRef<HTMLSpanElement>(null);
  const ideas = useRef<HTMLDivElement>(null);
  const chips = useRef<(HTMLLIElement | null)[]>([]);
  const lines = useRef<(SVGLineElement | null)[]>([]);
  const cards = useRef<HTMLOListElement>(null);
  const cardEls = useRef<(HTMLLIElement | null)[]>([]);
  const captions = useRef<(HTMLParagraphElement | null)[]>([]);
  const stills = useRef<(HTMLDivElement | null)[]>([]);
  const band = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLParagraphElement>(null);
  const lastStep = useRef(-1);

  useStageWriter((f) => {
    const p = f.progress[2];
    const on = window01(p, 0.005, 0.995, 0.005);
    show(head.current, on);
    const k = stepAt(p);
    if (k !== lastStep.current && rail.current) {
      lastStep.current = k;
      rail.current.querySelectorAll("li").forEach((li, i) => { li.dataset.state = i < k ? "done" : i === k ? "now" : "next"; });
    }
    // 1. The question types itself; scrolling back un-types it.
    show(ask.current, window01(p, 0.01, 0.17, 0.02), 12 * (1 - easeOut(seg(p, 0, 0.03))));
    if (typed.current) {
      const n = Math.round(seg(p, 0.015, 0.1) * TOPIC.length);
      if (typed.current.textContent!.length !== n) typed.current.textContent = TOPIC.slice(0, n);
    }
    // 2. It breaks into ideas that float out at three depths and link up.
    show(ideas.current, window01(p, 0.12, 0.44, 0.03));
    IDEAS.forEach((idea, i) => {
      const t = easeOut(seg(p, 0.13 + i * 0.018, 0.16 + i * 0.018));
      const drift = -110 * idea.depth * (p - 0.21);
      show(chips.current[i], t * (p > 0.3 ? 1 - 0.8 * seg(p, 0.3, 0.34) : 1), drift + 24 * (1 - t), 0.9 + 0.1 * t);
    });
    IDEA_LINKS.forEach((_, i) => {
      const el = lines.current[i];
      if (el) el.style.strokeDashoffset = String(1 - seg(p, 0.2 + i * 0.012, 0.24 + i * 0.012));
    });
    // 3. Five moves stack in with each phase's first line.
    show(cards.current, window01(p, 0.3, 0.46, 0.03));
    MOVES.forEach((_, i) => {
      const t = easeOut(seg(p, 0.31 + i * 0.028, 0.34 + i * 0.028));
      show(cardEls.current[i], t, 28 * (1 - t));
    });
    HOW.steps.forEach((_, i) => {
      const a = HOW_STEPS[i], b = HOW_STEPS[i + 1];
      show(captions.current[i], window01(p, a + 0.01, b - 0.015, 0.015), 10 * (1 - seg(p, a, a + 0.03)));
      show(stills.current[i], window01(p, a, b, 0.02));
    });
    // 6. The teacher begins: the caption band with the hook.
    show(band.current, window01(p, 0.9, 0.995, 0.02), 16 * (1 - easeOut(seg(p, 0.88, 0.92))));
  });

  return (
    <Pinned id="how" labelledBy="how-title">
      {HOW.steps.map((step, i) => (
        <Still key={step.name} ref={(el) => { stills.current[i] = el; }} name={`how-${i + 1}`} />
      ))}

      <div className="relative mx-auto h-full w-full max-w-6xl px-5 pt-[92px] sm:px-8">
        <div ref={head} className="landing-beat relative z-10 flex flex-col items-start gap-3">
          <h2 id="how-title" className={cn(SHAPE.control, GLASS, "px-3 py-1.5 text-[24px] font-extrabold leading-tight tracking-[-0.02em] shadow-none sm:text-[30px]")}>
            {HOW.title}
          </h2>
          <StepRail ref={rail} steps={HOW.steps.map((s) => s.name)} />
          <p ref={label} className="max-w-[520px]">
            <span className={cn(SHAPE.control, GLASS, "inline-block px-3 py-1.5 text-xs text-body shadow-none")}>{HOW.realLabel}</span>
          </p>
        </div>

        {/* 1. The question. */}
        <div ref={ask} className="landing-beat absolute inset-x-5 top-[46%] z-10 mx-auto max-w-[560px] sm:inset-x-8">
          <div className={cn(SHAPE.control, GLASS, "flex min-h-[56px] items-center gap-3 px-5 text-lg font-medium")}>
            <span className="text-muted" aria-hidden>Topic</span>
            <span className="h-5 w-px bg-line" aria-hidden />
            <span className="relative">
              <span ref={typed} aria-hidden />
              <span className="landing-motion-only ml-0.5 inline-block h-5 w-[2px] translate-y-[3px] animate-pulse bg-accent" aria-hidden />
              <span className="sr-only">{TOPIC}</span>
            </span>
          </div>
        </div>

        {/* 2. The ideas, linked in teaching order. */}
        <div ref={ideas} className="landing-beat absolute inset-x-5 bottom-[22%] top-[30%] z-10 sm:left-[36%] sm:right-8">
          <svg aria-hidden className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
            {IDEA_LINKS.map(([a, b], i) => {
              const A = IDEAS.find((x) => x.id === a)!, B = IDEAS.find((x) => x.id === b)!;
              return (
                <line
                  key={a + b}
                  ref={(el) => { lines.current[i] = el; }}
                  x1={A.x * 100} y1={A.y * 100} x2={B.x * 100} y2={B.y * 100}
                  pathLength={1}
                  vectorEffect="non-scaling-stroke"
                  className="stroke-accent"
                  strokeWidth={1.5}
                  style={{ strokeDasharray: 1, strokeDashoffset: 1 }}
                />
              );
            })}
          </svg>
          <ul aria-label="The ideas the lesson is built from">
            {IDEAS.map((idea, i) => (
              <li
                key={idea.id}
                ref={(el) => { chips.current[i] = el; }}
                className="landing-beat absolute"
                style={{ left: `${idea.x * 100}%`, top: `${idea.y * 100}%` }}
              >
                <span className={cn(SHAPE.pill, GLASS, "block -translate-x-1/2 -translate-y-1/2 whitespace-nowrap px-3.5 py-2 text-sm font-semibold shadow-e1")}>
                  {idea.label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* 3. The five moves. */}
        <ol ref={cards} aria-label="The lesson's five moves" className="landing-beat absolute right-5 top-[24%] z-10 flex w-[min(420px,calc(100%-40px))] flex-col gap-2.5 sm:right-8">
          {MOVES.map((m, i) => {
            const Icon = m.icon;
            return (
              <li key={m.phase} ref={(el) => { cardEls.current[i] = el; }} className={cn(SHAPE.control, GLASS, "landing-beat flex gap-3 px-4 py-3 shadow-e1")}>
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink">{i + 1}</span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
                    <Icon className="size-4 text-accent-text" aria-hidden />
                    {m.name}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-body">{m.first}</p>
                </div>
              </li>
            );
          })}
        </ol>

        {/* Step captions, bottom left. */}
        <div className="landing-overlap absolute bottom-[10svh] left-5 z-10 max-w-[520px] sm:left-8">
          {/* Step 6 has no caption of its own: the caption band below carries it. */}
          {HOW.steps.slice(0, 5).map((step, i) => (
            <p key={step.name} ref={(el) => { captions.current[i] = el; }} className="landing-beat">
              <span className={cn(SHAPE.control, GLASS, "inline-block px-4 py-2.5 text-xl font-bold shadow-e1 sm:text-2xl")}>{step.caption}</span>
            </p>
          ))}
        </div>

        {/* 6. The teacher begins. */}
        <CaptionBand ref={band} line={MOVES[0].line} segment={MOVES[0].segment} label={HOW.steps[5].caption} />

      </div>
    </Pinned>
  );
}
