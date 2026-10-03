import { useRef } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { SHAPE } from "@/lib/design/shape";
import { MOVES, MOVES_COPY } from "../content";
import { restart, setPaused, useCue, useSectionPlay } from "../play";
import { Spot } from "../Spot";
import type { LandingMode } from "../stage/gate";
import { replayMoves } from "../stage/host";
import { MOVES_T, boardBox } from "../stage/scripts";
import { BOARD_ASPECT } from "../stage/spots";
import { BTN_GHOST, H2, LEDE, REAL, WRAP } from "../ui";
import { MovesBoard } from "./MovesBoard";
import { MovesHands } from "./MovesHands";

const CUES = MOVES_T.at;
const BOX = boardBox("moves");
/**
 * The board is the classroom board's width at its place, and a little taller, an outline's shape: nothing he does
 * points at it (each piece flies to its place), so it can be, and the outline's rows need the room.
 */
const BOARD_TALL = 1.18;

/**
 * One Lesson, Five Moves (V8.3b): the five moves in plain words (messaging.md), told as one story. Jake makes each
 * move's own gesture as a lesson's director plays it (stage/scripts.ts); what the gesture makes in his hands is then
 * set on the classroom's display beside him (MovesHands, MovesBoard), so the volcano lesson builds up there move by
 * move: what you know, the idea, its steps, the question and its answer, what comes next. The moves light in turn on
 * the section's clock; Pause stops it and Replay starts it again. Below 640px the board stands alone. On the lite
 * path and under reduced motion every move is in place, the board is whole and he is a still.
 */
export function Moves({ mode }: { mode: LandingMode | null }) {
  const stage = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const board = useRef<HTMLDivElement>(null);
  useSectionPlay("moves", stage, MOVES_T.length, { mode, spot: "moves" });
  const { cue, playing, paused } = useCue("moves", CUES);
  const armed = mode === "full";
  const now = armed ? cue : -1;
  const done = armed && cue === CUES.length - 1 && !playing && !paused;

  return (
    <section id="how" aria-labelledby="moves-title" className="overflow-x-clip py-24">
      <div ref={wrap} className={cn(WRAP, "landing-moves relative grid items-center gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-14")} data-armed={armed || undefined}>
        <div>
          <h2 id="moves-title" className={H2}>{MOVES_COPY.title}</h2>
          <p className={cn(LEDE, "mt-4")}>{MOVES_COPY.line}</p>
          <ol className="mt-8 flex flex-col gap-2" aria-label="The five moves">
            {MOVES.map((m, i) => {
              const Icon = m.icon;
              return (
                <li
                  key={m.phase}
                  aria-current={i === now ? "step" : undefined}
                  data-on={!armed || i <= now || undefined}
                  className={cn(SHAPE.surface, "landing-move grid grid-cols-[40px_minmax(0,1fr)] items-start gap-3 border px-3.5 py-3")}
                >
                  <span className={cn(SHAPE.control, "landing-move-icon inline-flex size-10 items-center justify-center border")}>
                    <Icon className="size-[18px]" aria-hidden />
                  </span>
                  <span className="flex flex-col gap-0.5 pt-0.5">
                    <span className="text-[15px] font-semibold text-ink">{m.name}</span>
                    <span className="text-[15px] leading-snug text-body">{m.does}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          {armed && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {done ? (
                <button type="button" onClick={() => { replayMoves(); restart("moves"); }} className={BTN_GHOST}>
                  <RotateCcw className="size-4" aria-hidden />
                  Replay
                </button>
              ) : (
                <button type="button" onClick={() => setPaused("moves", !paused)} className={BTN_GHOST}>
                  {paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
                  {paused ? "Play" : "Pause"}
                </button>
              )}
            </div>
          )}
          <p className={cn(REAL, "mt-2")}>{MOVES_COPY.label}</p>
        </div>
        <div ref={stage} className="mx-auto w-full max-w-[760px] lg:max-w-none">
          <Spot
            id="moves"
            still="/images/landing/v3b/moves.webp"
            alt="Jake beside the volcano lesson, set out on the board in five moves"
            className="hidden w-full sm:block"
            style={{ aspectRatio: String(BOARD_ASPECT) }}
            pool="left-[30%] -right-[4%] top-[4%] h-[80%]"
            under={
              <MovesBoard
                ref={board}
                armed={armed}
                className="absolute"
                style={{ left: `${BOX.left}%`, top: `${BOX.top}%`, width: `${BOX.width}%`, minHeight: `${BOX.height * BOARD_TALL}%` }}
              />
            }
          />
          <MovesBoard armed={false} className="relative aspect-[1/1.18] w-full sm:hidden" />
        </div>
        {armed && <MovesHands wrap={wrap} board={board} />}
      </div>
    </section>
  );
}
