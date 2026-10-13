"use client";

/**
 * Where the interactive visual lives in the classroom shell (V10).
 *
 * A DOM layer over the canvas, not an <Html> in the scene: the scene's image sits
 * in a bobbing <Float>, which a slider cannot live in, and part of the board is
 * already under the lesson panel at common widths. So the widget gets its own
 * slot in the free area beside the teacher (who points at it), or the large view.
 *
 *   board  >= 1180 x 600: a card left of the panel, above the caption band.
 *   large  anything smaller, or when Expand is pressed: a dialog over a scrim.
 *
 * It is ONE iframe whose container changes class, never remounted, so slider
 * positions survive Expand, Collapse and Hide. It stays mounted while hidden
 * (display: none) for the same reason, and a "Open interactive" pill brings it
 * back. The card is ink glass in both themes, like everything over the lit room,
 * so the widget is always the dark kit (no reload on theme change either).
 *
 * The lesson pauses on the explore segment (useLessonPlayback); the footer holds
 * the "try this" prompts and, while paused, Continue.
 */

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Maximize2, Minimize2, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InteractiveFrame } from "@/components/learn/InteractiveFrame";
import { useAristoStore } from "@/store/useAristoStore";
import { cn } from "@/lib/utils";

const BOARD_QUERY = "(min-width: 1180px) and (min-height: 600px)";

function useBoardLayout(): boolean {
  const [board, setBoard] = useState(
    () => typeof window !== "undefined" && window.matchMedia(BOARD_QUERY).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(BOARD_QUERY);
    const sync = () => setBoard(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return board;
}

const FOCUSABLE = 'button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

// The panel column is 400px at right-5; the card sits 20px left of it. The caption band (LessonPlayer)
// keeps its top edge at or below 80% of the height, so the card ends at 78%.
const BOARD_CARD =
  "absolute right-[calc(400px+2.5rem)] top-[76px] bottom-[22%] z-20 max-h-[680px] w-[clamp(340px,30vw,460px)]";
const LARGE_CARD =
  "absolute left-1/2 top-1/2 z-[60] h-[min(720px,calc(100%-6rem))] w-[min(960px,calc(100%-2.5rem))] -translate-x-1/2 -translate-y-1/2";

export function InteractiveStage() {
  const interactive = useAristoStore((s) => s.interactive);
  const shown       = useAristoStore((s) => s.interactiveShown);
  const expanded    = useAristoStore((s) => s.interactiveExpanded);
  const exploring   = useAristoStore((s) => s.exploring);
  const setInteractive         = useAristoStore((s) => s.setInteractive);
  const setInteractiveShown    = useAristoStore((s) => s.setInteractiveShown);
  const setInteractiveExpanded = useAristoStore((s) => s.setInteractiveExpanded);
  const requestContinue        = useAristoStore((s) => s.requestExploreContinue);

  const board = useBoardLayout();
  const { parts, spec, status } = interactive;
  const live = !!parts && status !== "failed" && status !== "idle";
  const large = shown && (expanded || !board);

  const cardRef = useRef<HTMLDivElement>(null);
  const close = () => (board ? setInteractiveExpanded(false) : setInteractiveShown(false));
  const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; });

  // The large view is a dialog: focus moves in, Tab wraps inside it, Escape closes, focus goes back.
  // Keys typed inside the frame never reach this document, so the frame's bridge posts Escape
  // (onEscape below); Tab out of the frame lands on the footer, and the wrap handles the card's ends.
  useEffect(() => {
    if (!large) return;
    const card = cardRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    card?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) { e.stopPropagation(); closeRef.current(); return; }
      if (e.key !== "Tab" || !card) return;
      const items = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) { e.preventDefault(); card.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === card || !card.contains(active))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (active === last || !card.contains(active))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, [large]);

  if (!live || !parts || !spec) return null;

  const markReady = () => {
    const cur = useAristoStore.getState().interactive;
    if (cur.parts === parts) setInteractive({ ...cur, status: "ready" });
  };
  const markFailed = () => {
    const cur = useAristoStore.getState().interactive;
    if (cur.parts === parts) setInteractive({ ...cur, status: "failed" });
  };

  return (
    <>
      {large && <div aria-hidden className="absolute inset-0 z-[55] bg-black/50 backdrop-blur-sm" onClick={close} />}

      <div
        ref={cardRef}
        data-testid="interactive-card"
        tabIndex={-1}
        role={large ? "dialog" : "group"}
        aria-modal={large || undefined}
        aria-label={parts.title}
        className={cn(
          "theme-ink flex flex-col overflow-hidden rounded-2xl border border-line bg-surface text-ink shadow-e2 outline-none",
          large ? LARGE_CARD : BOARD_CARD,
          !shown && "hidden",
        )}
      >
        <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-line pl-4 pr-1.5">
          <h2 className="truncate text-sm font-semibold text-ink">{parts.title}</h2>
          <div className="flex shrink-0 items-center">
            {board && (
              <Button
                variant="ghost" size="icon" className="rounded-full text-body hover:text-ink"
                onClick={() => setInteractiveExpanded(!expanded)}
                aria-label={expanded ? "Back to the board" : "Expand the interactive"}
              >
                {expanded ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
              </Button>
            )}
            <Button
              variant="ghost" size="icon" className="rounded-full text-body hover:text-ink"
              onClick={() => { setInteractiveExpanded(false); setInteractiveShown(false); }}
              aria-label="Hide the interactive"
            >
              <X aria-hidden />
            </Button>
          </div>
        </header>

        <div className="min-h-0 flex-1">
          <InteractiveFrame
            parts={parts}
            theme="dark"
            onReady={markReady}
            onFail={markFailed}
            onEscape={() => { if (large) closeRef.current(); }}
          />
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-line bg-sunk px-4 py-2">
          {/* The board card is short, so it shows one prompt; the large view shows them all. */}
          <div className="min-w-0 text-sm text-body">
            <span className="text-xs font-semibold text-muted">Try this</span>
            <ul className={cn("mt-0.5 space-y-0.5", !large && "line-clamp-2")}>
              {(large ? spec.try_this : spec.try_this.slice(0, 1)).map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
          {exploring && (
            <Button onClick={requestContinue} className="shrink-0">
              Continue
              <ArrowRight aria-hidden />
            </Button>
          )}
        </footer>
      </div>

      {!shown && status === "ready" && (
        <div className="theme-ink absolute left-5 top-[76px] z-20 flex items-center gap-2">
          <Button
            variant="secondary"
            className="border border-line bg-bg/[0.86] shadow-e1 backdrop-blur-md"
            onClick={() => setInteractiveShown(true)}
          >
            <SlidersHorizontal aria-hidden />
            Open interactive
          </Button>
          {/* Hiding the card must not strand the pause: Continue stays reachable. */}
          {exploring && (
            <Button onClick={requestContinue} className="shadow-e1">
              Continue
              <ArrowRight aria-hidden />
            </Button>
          )}
        </div>
      )}
    </>
  );
}
