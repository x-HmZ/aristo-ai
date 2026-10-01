import { useEffect, useRef, type CSSProperties } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { IDEAS_COPY } from "../content";
import { clockOf, subscribeClock, useCue, useSectionPlay } from "../play";
import { Spot } from "../Spot";
import type { LandingMode } from "../stage/gate";
import { IDEAS_T, boardBox } from "../stage/scripts";
import { BOARD_ASPECT } from "../stage/spots";
import { H2, LEDE, REAL, WRAP } from "../ui";

const BOX = boardBox("ideas");
const IDEAS = IDEAS_COPY.ideas;
const AT = Object.fromEntries(IDEAS.map((d) => [d.id, d])) as Record<string, (typeof IDEAS)[number]>;
/** Cues: thinking starts, thinking ends, then each idea in turn. */
const CUES = [IDEAS_T.think[0], IDEAS_T.think[1], ...IDEAS.map((_, i) => IDEAS_T.ideas + i * IDEAS_T.step)] as const;
const FIRST_IDEA_CUE = 2;
const indexOf = (id: string) => IDEAS.findIndex((d) => d.id === id);

/**
 * The board panel: the classroom's own dark display (the scoped dark tokens, `.theme-ink`, so it is the same in both
 * themes), where the lesson's ideas light up in the page's own language. The topic types itself; while he thinks a
 * glow gathers in the middle; then each idea comes out of it as an orb of light, the same light as the idea he holds
 * in A Teacher of Your Own (rings for what the topic builds on, filled for its own ideas), and the links draw between
 * them like a constellation once both ends are lit.
 */
function Panel({ armed, cue, aim, className, style }: { armed: boolean; cue: number; aim: boolean; className?: string; style?: CSSProperties }) {
  const shown = (i: number) => !armed || cue >= FIRST_IDEA_CUE + i;
  const thinking = armed && cue >= 0 && cue < FIRST_IDEA_CUE + 1;
  return (
    <div className={cn("theme-ink landing-display overflow-hidden rounded-[20px] border border-line bg-sunk shadow-e2", className)} style={style}>
      <div aria-hidden className="landing-display-glow absolute inset-0" />
      {/* The topic, as typed. The full topic is always in the accessible name. */}
      <div className="absolute inset-x-0 top-[6%] flex items-center justify-center gap-2 whitespace-nowrap text-[13px] font-semibold text-ink sm:text-[15px]" aria-label={`Topic: ${IDEAS_COPY.topic}`}>
        <Sparkles className="size-4 text-accent-text" aria-hidden />
        <span data-topic aria-hidden>{IDEAS_COPY.topic}</span>
        {armed && <span aria-hidden className="landing-caret" />}
      </div>
      <div aria-hidden data-on={thinking || undefined} className="landing-thinking absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
      <p aria-hidden className={cn("absolute inset-x-0 top-[57%] text-center text-xs text-muted transition-opacity duration-300", thinking ? "opacity-100" : "opacity-0")}>
        {IDEAS_COPY.thinking}
      </p>
      <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" aria-hidden>
        {IDEAS_COPY.links.map(([a, b]) => (
          <line
            key={`${a}-${b}`}
            x1={AT[a].x} y1={AT[a].y} x2={AT[b].x} y2={AT[b].y}
            pathLength={1}
            data-on={(shown(indexOf(a)) && shown(indexOf(b))) || undefined}
            className="landing-link"
          />
        ))}
      </svg>
      <ul aria-label={`The ideas inside ${IDEAS_COPY.topic}`}>
        {IDEAS.map((d, i) => (
          <li
            key={d.id}
            data-on={shown(i) || undefined}
            className="landing-idea-node absolute flex w-0 flex-col items-center"
            style={{ left: `${d.x}%`, top: `${d.y}%`, "--dx": 50 - d.x, "--dy": 50 - d.y } as CSSProperties}
          >
            <span
              aria-hidden
              data-aim={aim && d.id === IDEAS_COPY.aim ? "ideas" : undefined}
              className={cn("landing-idea-orb -translate-y-1/2", d.first ? "landing-idea-ring" : "landing-idea-lit", d.id === IDEAS_COPY.aim && "landing-idea-big")}
            />
            <span className="landing-idea-label mt-0.5 w-[8.5rem] text-center text-[11px] font-semibold leading-tight text-ink sm:text-[12.5px]">{d.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * It Finds the Ideas Inside (V8.3b, the volcano lesson). On a panel at the classroom board's own place and size, the
 * topic types itself while Jake thinks (the product's OneMoment and Thinking); then the ideas the lesson was built
 * from appear one by one and link up, and he points at them, his hand aimed at the magma chamber (`data-aim`,
 * LandingStage). The panel is under the canvas, so his hand is drawn in front of it. Below 640px the board would be
 * too small to read: the panel stands on its own, full width, and he is not shown (never pointing at nothing). On
 * the lite path, and under reduced motion, the panel is complete and he is a still, pointing.
 */
export function Ideas({ mode }: { mode: LandingMode | null }) {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  useSectionPlay("ideas", stage, IDEAS_T.length, { mode, spot: "ideas" });
  const { cue } = useCue("ideas", CUES);
  const armed = mode === "full";

  // The topic types itself, one character per change, without re-rendering the section.
  useEffect(() => {
    if (mode !== "full") return;
    const full = IDEAS_COPY.topic;
    const paint = () => {
      const t = clockOf("ideas").t;
      const n = String(Math.round(full.length * Math.min(1, Math.max(0, (t - IDEAS_T.type[0]) / (IDEAS_T.type[1] - IDEAS_T.type[0])))));
      section.current?.querySelectorAll<HTMLElement>("[data-topic]").forEach((el) => {
        if (el.dataset.n !== n) { el.dataset.n = n; el.textContent = full.slice(0, Number(n)); }
      });
    };
    paint();
    return subscribeClock("ideas", paint);
  }, [mode]);

  return (
    <section ref={section} id="how" aria-labelledby="ideas-title" className="overflow-x-clip py-24">
      <div className={cn(WRAP, "landing-ideas grid items-center gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-14")} data-armed={armed || undefined}>
        <div>
          <h2 id="ideas-title" className={H2}>{IDEAS_COPY.title}</h2>
          <p className={cn(LEDE, "mt-4")}>{IDEAS_COPY.line}</p>
          <p className="mt-6 flex items-center gap-2 text-sm text-body">
            <span aria-hidden className="landing-idea-orb landing-idea-ring inline-block" />
            {IDEAS_COPY.legend}
          </p>
          <p className={cn(REAL, "mt-3")}>{IDEAS_COPY.real}</p>
        </div>
        <div ref={stage} className="mx-auto w-full max-w-[760px] lg:max-w-none">
          <Spot
            id="ideas"
            still="/images/landing/v3b/ideas.webp"
            start="/images/landing/v3b/ideas-start.webp"
            alt="Jake points at the ideas the volcano lesson was built from"
            className="hidden w-full sm:block"
            style={{ aspectRatio: String(BOARD_ASPECT) }}
            pool="left-[30%] -right-[4%] top-[4%] h-[80%]"
            under={
              <Panel
                armed={armed}
                cue={cue}
                aim
                className="absolute"
                style={{ left: `${BOX.left}%`, top: `${BOX.top}%`, width: `${BOX.width}%`, height: `${BOX.height}%` }}
              />
            }
          />
          <Panel armed={armed} cue={cue} aim={false} className="relative aspect-square w-full sm:hidden" />
        </div>
      </div>
    </section>
  );
}
