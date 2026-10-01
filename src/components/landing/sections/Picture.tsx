import { useRef } from "react";
import { Palette, PenLine, RotateCcw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { SHAPE } from "@/lib/design/shape";
import { PICTURE_COPY } from "../content";
import { restart, useCue, useSectionPlay } from "../play";
import { Spot } from "../Spot";
import type { LandingMode } from "../stage/gate";
import { PICTURE_T } from "../stage/scripts";
import { BOARD_ASPECT } from "../stage/spots";
import { BTN_GHOST, H2, LEDE, REAL, WRAP } from "../ui";

const STEPS = [
  { label: "Noise", icon: Sparkles },
  { label: "Lines", icon: PenLine },
  { label: "Colour", icon: Palette },
] as const;
/** The picture's resolve, in its three looks (shaders.ts DIAGRAM_FRAG: noise to 0.35, lines to 0.6, then colour). */
const at = (p: number) => PICTURE_T.resolve[0] + p * (PICTURE_T.resolve[1] - PICTURE_T.resolve[0]);
const CUES = [at(0), at(0.35), at(0.6)] as const;

/**
 * It Draws a Diagram for the Lesson (V8.3b, the volcano lesson's cross-section). The picture resolves on the
 * classroom board's own place and at its size, from noise to lines to colour (stage/Diagram.tsx), and Jake points at
 * it once it has mostly formed, his hand aimed at the crater (scripts.ts PICTURE_AIM). It plays once Jake is live
 * here and the section is in view, then holds; Replay runs it again. On the lite path the spot is a still of the end.
 */
export function Picture({ mode }: { mode: LandingMode | null }) {
  const stage = useRef<HTMLDivElement>(null);
  useSectionPlay("picture", stage, PICTURE_T.length, { mode, spot: "picture" });
  const { cue } = useCue("picture", CUES);
  const step = Math.max(0, cue);
  return (
    <section id="picture" aria-labelledby="picture-title" className="overflow-x-clip py-24">
      <div className={cn(WRAP, "grid items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14")}>
        <div>
          <h2 id="picture-title" className={H2}>{PICTURE_COPY.title}</h2>
          <p className={cn(LEDE, "mt-4")}>{PICTURE_COPY.line}</p>
          <ol className="mt-6 flex flex-wrap gap-2" aria-label="The drawing">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <li
                  key={s.label}
                  aria-current={i === step ? "step" : undefined}
                  className={cn(
                    SHAPE.pill,
                    "inline-flex min-h-10 items-center gap-2 border py-0 pl-2.5 pr-3.5 text-sm font-semibold transition-colors duration-200",
                    i === step ? "border-accent bg-accent text-accent-ink" : i < step ? "border-line bg-surface text-ink" : "border-line bg-surface text-body"
                  )}
                >
                  <Icon className={cn("size-4", i < step && "text-accent-text")} aria-hidden />
                  {s.label}
                </li>
              );
            })}
          </ol>
          {mode === "full" && (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => restart("picture")} className={BTN_GHOST}>
                <RotateCcw className="size-4" aria-hidden />
                Replay
              </button>
            </div>
          )}
          <p className={cn(REAL, "mt-2")}>{PICTURE_COPY.real}</p>
        </div>
        <div ref={stage} className="mx-auto w-full max-w-[760px] lg:max-w-none">
          <Spot
            id="picture"
            still="/images/landing/v3b/picture.webp"
            start="/images/landing/v3b/picture-start.webp"
            alt="Jake points at the volcano lesson's cross-section, drawn on the board"
            className="w-full"
            style={{ aspectRatio: String(BOARD_ASPECT) }}
            pool="left-[30%] -right-[4%] top-[4%] h-[80%]"
          />
        </div>
      </div>
    </section>
  );
}
