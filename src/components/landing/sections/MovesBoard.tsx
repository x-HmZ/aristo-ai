import { forwardRef, type CSSProperties } from "react";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOVES_COPY } from "../content";

const B = MOVES_COPY.board;

/** Every place on the board, by id: what you know, the idea, the three steps, the question, what comes next. */
export const BOARD_NODES = {
  k0: { ...B.known[0], kind: "ring" },
  k1: { ...B.known[1], kind: "ring" },
  idea: { ...B.idea, kind: "idea" },
  s0: { ...B.steps[0], kind: "step" },
  s1: { ...B.steps[1], kind: "step" },
  s2: { ...B.steps[2], kind: "step" },
  q: { ...B.question, kind: "question" },
  next: { ...B.next, kind: "ring" },
} as const;
export type BoardNode = keyof typeof BOARD_NODES;

/**
 * The board's links, each drawn once both its ends are on the board: the lesson's spine, top to bottom. What comes
 * next hangs from the answer, because that is where the next lesson starts: the volcano lesson's answer (thick magma
 * traps the gas) is why eruptions differ, and its next concept is the types of volcano and their eruption styles.
 */
export const BOARD_LINKS: readonly [BoardNode, BoardNode][] = [
  ["k0", "k1"], ["k1", "idea"], ["idea", "s0"], ["s0", "s1"], ["s1", "s2"], ["s2", "q"], ["q", "next"],
];

/** A link's path in the board's 0 to 100 box: straight down the spine. */
function linkPath(a: BoardNode, b: BoardNode): string {
  const p = BOARD_NODES[a], q = BOARD_NODES[b];
  return `M ${p.x} ${p.y} L ${q.x} ${q.y}`;
}

/**
 * One Lesson, Five Moves' board (V8.3b): the classroom's dark display (`.theme-ink`, the same in both themes), where
 * the volcano lesson is set down one move at a time from what Jake makes in his hands (MovesHands): the rings of what
 * you already know, the idea and the way to picture it, the three steps, the question and its answer, and what comes
 * next. On the live path each place lights as its piece lands (`data-on`, set by MovesHands); on the lite path and
 * under reduced motion the whole lesson is on it.
 */
export const MovesBoard = forwardRef<HTMLDivElement, { armed: boolean; className?: string; style?: CSSProperties }>(
  function MovesBoard({ armed, className, style }, ref) {
    return (
      <div
        ref={ref}
        data-armed={armed || undefined}
        className={cn("theme-ink landing-display landing-board overflow-hidden rounded-[20px] border border-line bg-sunk shadow-e2", className)}
        style={style}
      >
        <div aria-hidden className="landing-display-glow absolute inset-0" />
        <p className="absolute inset-x-0 top-[3.5%] flex items-center justify-center gap-2 whitespace-nowrap text-[13px] font-semibold text-ink sm:text-[14px]">
          <Sparkles className="size-4 text-accent-text" aria-hidden />
          {MOVES_COPY.topic}
        </p>
        <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" aria-hidden>
          {BOARD_LINKS.map(([a, b]) => (
            <path key={`${a}-${b}`} d={linkPath(a, b)} pathLength={1} data-link={`${a}-${b}`} className="landing-link fill-none" />
          ))}
        </svg>
        <ol aria-label={`${MOVES_COPY.topic}, in five moves`}>
          {(Object.keys(BOARD_NODES) as BoardNode[]).map((id) => {
            const n = BOARD_NODES[id];
            return (
              <li
                key={id}
                data-node={id}
                className="landing-board-node absolute h-0 w-0"
                style={{ left: `${n.x}%`, top: `${n.y}%` }}
              >
                <span
                  aria-hidden
                  data-orb
                  className={cn(
                    "landing-board-orb absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2",
                    n.kind === "ring" && "landing-idea-orb landing-idea-ring",
                    n.kind === "idea" && "landing-idea-orb landing-idea-lit landing-board-idea",
                    n.kind === "step" && "landing-idea-orb landing-idea-lit",
                    n.kind === "question" && "landing-board-question",
                  )}
                >
                  {n.kind === "question" && "?"}
                </span>
                {/* Its words, to the right of the spine; the first line level with the orb. */}
                <span className="absolute left-[18px] top-0 flex w-[18rem] max-w-[70cqw] -translate-y-[0.65em] flex-col items-start gap-0.5">
                  <span className="text-[11.5px] font-semibold leading-tight text-ink sm:text-[12px] lg:text-[12.5px]">{n.label}</span>
                  {"tag" in n && <span className="text-[11px] italic leading-tight text-body">{n.tag}</span>}
                  {"answer" in n && (
                    <span data-part="answer" className="landing-board-answer mt-0.5 inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink sm:text-[12px]">
                      {n.answer}
                      <Check data-part="tick" className="landing-board-tick size-3.5 text-success" aria-label="marked right" />
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    );
  },
);
