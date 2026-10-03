import { useRef, type PointerEvent } from "react";
import { Box, Image as ImageIcon, RotateCcw, Rotate3d, Scan } from "lucide-react";
import { cn } from "@/lib/utils";
import { SHAPE } from "@/lib/design/shape";
import { MODEL_COPY } from "../content";
import { restart, useCue, useSectionPlay } from "../play";
import { Spot } from "../Spot";
import type { LandingMode } from "../stage/gate";
import { MODEL_ASPECT, MODEL_T, heartBox } from "../stage/scripts";
import { shared } from "../stage/shared";
import { BTN_GHOST, BTN_OUTLINE, H2, LEDE, REAL, WRAP } from "../ui";

const STEPS = [
  { label: "The picture", icon: ImageIcon },
  { label: "The points", icon: Scan },
  { label: "The model", icon: Box },
] as const;
const CUES = [0, MODEL_T.lift + 0.35, MODEL_T.built] as const;
/** The drag surface: the heart's own area in the spot (from the same frustum the stage draws with). */
const HEART_BOX = heartBox();
/** Radians per CSS pixel dragged. */
const DRAG_RATE = 0.012;

/**
 * It Builds a Model You Can Turn (V8.3b, round 3): Jake presents while the lesson's picture lifts into points and
 * settles onto the real heart. The heart is placed from Jake's own hand at PresentModel's peak (stage/scripts.ts). The
 * build plays once Jake is live at this spot and the section is in view, then holds; Replay runs it again. Once
 * built, the heart can be turned by dragging it or with Turn it. On the lite path the spot is a still of the end.
 */
export function ModelBuild({ mode }: { mode: LandingMode | null }) {
  const stage = useRef<HTMLDivElement>(null);
  useSectionPlay("model", stage, MODEL_T.length, { mode, spot: "model" });
  const { cue } = useCue("model", CUES);
  const step = Math.max(0, cue);
  const built = cue >= 2;
  const live = mode === "full";
  const drag = useRef<{ id: number; x: number } | null>(null);

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!built) return;
    drag.current = { id: e.pointerId, x: e.clientX };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    shared.heart.turn += (e.clientX - d.x) * DRAG_RATE;
    shared.heart.user = true;
    d.x = e.clientX;
  };
  const onUp = () => { drag.current = null; };

  return (
    <section id="model" aria-labelledby="model-title" className="overflow-x-clip py-24">
      <div className={cn(WRAP, "grid items-center gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14")}>
        <div ref={stage} className="relative mx-auto w-full max-w-[600px] lg:max-w-none">
          <Spot
            id="model"
            still="/images/landing/v3b/model.webp"
            start="/images/landing/v3b/model-start.webp"
            alt="Jake presents the 3D heart built from the lesson's picture"
            className="w-full"
            style={{ aspectRatio: String(MODEL_ASPECT) }}
            pool="left-[38%] -right-[2%] top-0 h-[72%]"
          >
            {live && (
              <>
                <div
                  data-peak-target
                  aria-hidden
                  onPointerDown={onDown}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={onUp}
                  className={cn("absolute z-20 touch-pan-y select-none", built ? "cursor-grab active:cursor-grabbing" : "pointer-events-none")}
                  style={{ left: `${HEART_BOX.left}%`, top: `${HEART_BOX.top}%`, width: `${HEART_BOX.width}%`, height: `${HEART_BOX.height}%` }}
                />
                <button
                  type="button"
                  disabled={!built}
                  aria-label="Turn the heart a quarter turn"
                  onClick={() => { shared.heart.turn += Math.PI / 2; shared.heart.user = true; }}
                  className={cn(BTN_OUTLINE, "absolute bottom-[4%] right-[6%] z-20 shadow-e1 transition-opacity duration-300 disabled:opacity-0")}
                >
                  <Rotate3d className="size-4" aria-hidden />
                  Turn it
                </button>
              </>
            )}
          </Spot>
        </div>
        <div>
          <h2 id="model-title" className={H2}>{MODEL_COPY.title}</h2>
          <p className={cn(LEDE, "mt-4")}>
            {MODEL_COPY.line}
            {live && ` ${MODEL_COPY.turn}`}
          </p>
          <ol className="mt-6 flex flex-wrap gap-2" aria-label="The build">
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
          {live && (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => restart("model")} className={BTN_GHOST}>
                <RotateCcw className="size-4" aria-hidden />
                Replay
              </button>
            </div>
          )}
          <p className={cn(REAL, "mt-2")}>{MODEL_COPY.real}</p>
        </div>
      </div>
    </section>
  );
}
