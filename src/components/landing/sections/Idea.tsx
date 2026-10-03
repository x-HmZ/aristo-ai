import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { COLUMN } from "@/components/brand/markPaths";
import { IDEA } from "../content";
import { clockOf, subscribeClock, useCue, useSectionPlay } from "../play";
import { Spot } from "../Spot";
import type { LandingMode } from "../stage/gate";
import { IDEA_T } from "../stage/scripts";
import { shared } from "../stage/shared";
import { H2, WRAP } from "../ui";

/** The column's middle flute in its viewBox (markPaths COLUMN.lit): x 180 to 250, y 154 to 534. */
const SLOT = { x: 180, y: 154, w: 70, h: 380, vw: 430, vh: 686 } as const;
const CUES = [...IDEA_T.beats, IDEA_T.draw[0]] as const;
/** The idea between his palms: an orb this share of the gap between their centres, so it sits held, not squeezed. */
const ORB_OF_GAP = 0.62;
/** How far below its highest his hands may sink before the idea leaves them. */
const LET_GO_PX = 10;
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

/**
 * A Teacher of Your Own (V8.3b): the story told once (messaging.md, the idea), in three beats beside the mark.
 *
 * On the live path the beats rise one after another and the colonnade draws itself with its middle flute's place
 * empty. Jake holds the idea (the product's HoldIdea, palms facing with a gap): while his hands are up, the idea
 * shows between them as an orb of warm light, sized to the gap and following his palms as the stage reports them
 * (shared.hands). As his hands come down it flies into the empty place, stretching into the flute's shape, and
 * lights it: the mark's own story, the colonnade with its middle flute lit. On the lite path, and under reduced
 * motion, everything is in place.
 */
export function Idea({ mode }: { mode: LandingMode | null }) {
  const wrap = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const slot = useRef<SVGRectElement>(null);
  const orb = useRef<HTMLDivElement>(null);
  useSectionPlay("idea", stage, IDEA_T.length, { mode, spot: "idea" });
  const { cue } = useCue("idea", CUES);
  const [litNow, setLitNow] = useState(false);
  const armed = mode === "full";
  const beatsOn = (i: number) => !armed || cue >= i;
  const drawn = !armed || cue >= 3;
  const lit = !armed || litNow;

  // The orb: between his palms while they are up, then into the column's empty place.
  useEffect(() => {
    if (mode !== "full") return;
    let phase: "wait" | "held" | "fly" | "done" = "wait";
    let heldAt = 0, flyAt = 0, size = 0, top = 0;
    let from = { x: 0, y: 0 };
    const tick = () => {
      const el = orb.current, box = wrap.current?.getBoundingClientRect(), s = slot.current?.getBoundingClientRect();
      if (!el || !box || !s) return;
      const t = clockOf("idea").t;
      const palms = shared.hands.spot === "idea" ? shared.hands.palms : null;
      const up = shared.hands.raised && !!palms && t >= IDEA_T.hold;
      const mid = palms ? { x: (palms.l.x + palms.r.x) / 2, y: (palms.l.y + palms.r.y) / 2 } : from;
      if (phase === "wait" && up) { phase = "held"; heldAt = t; top = mid.y; from = mid; }
      if (phase === "wait" && t >= IDEA_T.giveUp) { phase = "done"; setLitNow(true); }
      // It leaves as soon as his hands start down (a few px below their highest), from where it was held highest.
      if (phase === "held" && (!up || mid.y > top + LET_GO_PX)) { phase = "fly"; flyAt = t; }
      if (phase === "wait" || phase === "done") { el.style.opacity = "0"; return; }
      let x = mid.x, y = mid.y, w: number, h: number, radius: string, o: number;
      if (phase === "held") {
        const gap = palms ? Math.hypot(palms.l.x - palms.r.x, palms.l.y - palms.r.y) : size;
        size = gap * ORB_OF_GAP;
        if (mid.y <= top) { top = mid.y; from = mid; }
        w = h = size;
        radius = "50%";
        o = Math.min(1, (t - heldAt) / 0.3);
      } else {
        const k = ease(Math.min(1, (t - flyAt) / IDEA_T.flyS));
        x = from.x + (s.left + s.width / 2 - from.x) * k;
        y = from.y + (s.top + s.height / 2 - from.y) * k;
        w = size + (s.width - size) * k;
        h = size + (s.height - size) * k;
        radius = `${Math.round(size / 2 + (6 - size / 2) * k)}px`;
        o = 1;
        if (k >= 1) { phase = "done"; setLitNow(true); el.style.opacity = "0"; return; }
      }
      el.style.opacity = String(o);
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.style.borderRadius = radius;
      el.style.transform = `translate3d(${x - box.left - w / 2}px, ${y - box.top - h / 2}px, 0)`;
    };
    return subscribeClock("idea", tick);
  }, [mode]);

  return (
    <section id="idea" aria-labelledby="idea-title" className="overflow-x-clip py-24">
      <div ref={wrap} className={cn(WRAP, "landing-idea relative grid items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14")} data-armed={armed || undefined}>
        <div>
          <h2 id="idea-title" className={H2}>{IDEA.title}</h2>
          <ol className="mt-8 flex flex-col gap-6">
            {IDEA.beats.map((beat, i) => (
              <li key={i} data-on={beatsOn(i) || undefined} className="landing-idea-beat grid grid-cols-[72px_minmax(0,1fr)] gap-4">
                <span className="pt-0.5 text-[13px] font-semibold uppercase tracking-[0.12em] text-accent-text">{IDEA.marks[i]}</span>
                <p className={cn("text-[17px] leading-relaxed", i === 2 ? "font-semibold text-ink" : "text-body")}>{beat}</p>
              </li>
            ))}
          </ol>
        </div>
        <div ref={stage} className="grid grid-cols-[minmax(0,2fr)_minmax(0,5fr)] items-center gap-6 sm:gap-10">
          <figure className="m-0 flex flex-col items-center gap-4">
            <svg viewBox={COLUMN.viewBox} className="landing-column w-full max-w-[170px]" data-drawn={drawn || undefined} aria-hidden>
              <path d={COLUMN.ink} pathLength={1} className="landing-column-ink" />
              {/* The middle flute's place: outlined until the idea he holds is set in it, then lit. */}
              <rect ref={slot} x={SLOT.x} y={SLOT.y} width={SLOT.w} height={SLOT.h} rx={6} className="landing-column-slot" data-lit={lit || undefined} />
            </svg>
            <figcaption className="max-w-[200px] text-center text-[13px] leading-snug text-muted">{IDEA.mark}</figcaption>
          </figure>
          <Spot
            id="idea"
            still="/images/landing/v3b/idea.webp"
            alt="Jake holds his hands together as if holding an idea"
            className="h-[470px] sm:h-[600px]"
            pool="inset-x-[8%] -bottom-[6%] h-3/5"
          />
        </div>
        {/* The idea he holds. Lives in the section's own box, above the canvas (z-20); placed by the effect above. */}
        <div ref={orb} aria-hidden className="landing-orb pointer-events-none absolute left-0 top-0 z-20" style={{ opacity: 0 }} />
      </div>
    </section>
  );
}
