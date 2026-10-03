import { forwardRef, useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Check, Mountain } from "lucide-react";
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
 * Each move's group on the board, top to bottom, under the move's own name (the list beside the board), so the board
 * reads as the five moves.
 */
export const BOARD_GROUPS: readonly { move: string; nodes: readonly BoardNode[] }[] = [
  { move: "Activate", nodes: ["k0", "k1"] },
  { move: "Explain", nodes: ["idea"] },
  { move: "Demonstrate", nodes: ["s0", "s1", "s2"] },
  { move: "Challenge", nodes: ["q"] },
  { move: "Connect", nodes: ["next"] },
];

/**
 * The board's links, each drawn once both its ends are on the board. What you already know is two separate things,
 * and both feed the idea (neither leads to the other); the idea leads into its steps, one after another; the steps
 * raise the question; and what comes next hangs from the answer, because that is where the next lesson starts: the
 * volcano lesson's answer (thick magma traps the gas) is why eruptions differ, and its next concept is the types of
 * volcano and their eruption styles.
 */
export const BOARD_LINKS: readonly [BoardNode, BoardNode][] = [
  ["k0", "idea"], ["k1", "idea"], ["idea", "s0"], ["s0", "s1"], ["s1", "s2"], ["s2", "q"], ["q", "next"],
];

type Pt = { x: number; y: number };

/**
 * A link between two orbs' centres (board px). Straight down the spine, except where that would run through another
 * orb between its ends: the first thing you know reaches the idea round the left of the second.
 */
function linkPath(p: Pt, q: Pt, others: Pt[]): string {
  const through = others.some((o) => Math.abs(o.x - p.x) < 2 && o.y > Math.min(p.y, q.y) + 1 && o.y < Math.max(p.y, q.y) - 1);
  if (Math.abs(p.x - q.x) < 2 && through) {
    const bow = p.x - 16;
    return `M ${p.x} ${p.y} C ${bow} ${p.y + (q.y - p.y) * 0.2}, ${bow} ${p.y + (q.y - p.y) * 0.8}, ${q.x} ${q.y}`;
  }
  return `M ${p.x} ${p.y} L ${q.x} ${q.y}`;
}

/** The type size every row shares, so an orb sits level with its first line at every width. */
const ROW_TEXT = "text-[11.5px] leading-[1.3] sm:text-[12px] lg:text-[12.5px]";

/**
 * One Lesson, Five Moves' board (V8.3b): the classroom's dark display (`.theme-ink`, the same in both themes), where
 * the volcano lesson is set down one move at a time from what Jake makes in his hands (MovesHands): the rings of what
 * you already know, the idea and the way to picture it, the three steps, the question and its answer, and what comes
 * next, each group under the name of its move. It is a list in normal flow (it holds at every width, and reads in
 * order), and its links are drawn from where its orbs actually are, measured on every resize, so a line always meets
 * its orbs. On the live path each place lights as its piece lands (`data-on`, set by MovesHands), with its move's name;
 * on the lite path and under reduced motion the whole lesson is on it.
 */
export const MovesBoard = forwardRef<HTMLDivElement, { armed: boolean; className?: string; style?: CSSProperties }>(
  function MovesBoard({ armed, className, style }, ref) {
    const root = useRef<HTMLDivElement | null>(null);
    const [lines, setLines] = useState<{ w: number; h: number; paths: { id: string; d: string }[] }>({ w: 0, h: 0, paths: [] });
    const setRoot = useCallback((el: HTMLDivElement | null) => {
      root.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    }, [ref]);

    useLayoutEffect(() => {
      const el = root.current;
      if (!el) return;
      const measure = () => {
        const box = el.getBoundingClientRect();
        if (!box.width) return;
        const centre: Partial<Record<BoardNode, Pt>> = {};
        el.querySelectorAll<HTMLElement>("[data-node]").forEach((n) => {
          const o = n.querySelector("[data-orb]")?.getBoundingClientRect();
          if (o) centre[n.dataset.node as BoardNode] = { x: o.left + o.width / 2 - box.left, y: o.top + o.height / 2 - box.top };
        });
        const all = Object.values(centre) as Pt[];
        const paths = BOARD_LINKS.flatMap(([a, b]) => {
          const p = centre[a], q = centre[b];
          return p && q ? [{ id: `${a}-${b}`, d: linkPath(p, q, all.filter((o) => o !== p && o !== q)) }] : [];
        });
        setLines((prev) => (prev.w === box.width && prev.h === box.height && prev.paths.every((x, i) => paths[i]?.d === x.d) && prev.paths.length === paths.length
          ? prev
          : { w: box.width, h: box.height, paths }));
      };
      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      void document.fonts?.ready.then(measure);
      return () => ro.disconnect();
    }, []);

    return (
      <div
        ref={setRoot}
        data-armed={armed || undefined}
        className={cn("theme-ink landing-display landing-board flex flex-col overflow-hidden rounded-[20px] border border-line bg-sunk px-[7%] pb-[6%] pt-[4%] shadow-e2", className)}
        style={style}
      >
        <div aria-hidden className="landing-display-glow absolute inset-0" />
        <p className="relative flex items-center justify-center gap-2 whitespace-nowrap text-[13px] font-semibold text-ink sm:text-[14px]">
          <Mountain className="size-4 text-accent-text" aria-hidden />
          {MOVES_COPY.topic}
        </p>
        {lines.w > 0 && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${lines.w} ${lines.h}`} aria-hidden>
            {lines.paths.map((l) => (
              <path key={l.id} d={l.d} pathLength={1} data-link={l.id} className="landing-link fill-none" />
            ))}
          </svg>
        )}
        <ol aria-label={`${MOVES_COPY.topic}, in five moves`} className="relative mt-[5%] flex flex-1 flex-col justify-between gap-3">
          {BOARD_GROUPS.map((g) => (
            <li key={g.move} className="flex flex-col gap-1.5">
              <p
                data-group={g.nodes.join(" ")}
                className="landing-board-group pl-8 text-[10px] font-bold uppercase leading-none tracking-[0.14em] text-muted sm:text-[10.5px]"
              >
                {g.move}
              </p>
              <ol className="flex flex-col gap-1.5">
                {g.nodes.map((id) => {
                  const n = BOARD_NODES[id];
                  return (
                    <li key={id} data-node={id} className={cn("landing-board-node grid grid-cols-[22px_minmax(0,1fr)] items-start gap-x-2.5", ROW_TEXT)}>
                      {/* The orb, centred on the row's first line. */}
                      <span className="flex h-[1.3em] items-center justify-center">
                        <span
                          aria-hidden
                          data-orb
                          className={cn(
                            "landing-board-orb shrink-0",
                            n.kind === "ring" && "landing-idea-orb landing-idea-ring",
                            n.kind === "idea" && "landing-idea-orb landing-idea-lit landing-board-idea",
                            n.kind === "step" && "landing-idea-orb landing-idea-lit",
                            n.kind === "question" && "landing-board-question",
                          )}
                        >
                          {n.kind === "question" && "?"}
                        </span>
                      </span>
                      <span className="flex min-w-0 flex-col items-start gap-0.5">
                        <span className="font-semibold text-ink">{n.label}</span>
                        {"tag" in n && <span className="text-[11px] italic leading-tight text-body">{n.tag}</span>}
                        {"answer" in n && (
                          <span data-part="answer" className="landing-board-answer mt-1 inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink sm:text-[12px]">
                            {n.answer}
                            <Check data-part="tick" className="landing-board-tick size-3.5 text-success" aria-label="marked right" />
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </li>
          ))}
        </ol>
      </div>
    );
  },
);
