"use client";

/**
 * Where the interactive visual lives in the classroom (V10).
 *
 * On the room's display, like the teaching image: the widget plays ON the screen behind the teacher, who presents
 * it, and the learner uses it right there. Its controls sit in a strip under the screen, as the image's toolbar
 * does. An iframe cannot live in WebGL, so this is a DOM layer laid over the screen's face: the scene publishes
 * where that face is on the page every frame (Experience.tsx, ScreenRectReporter), after the framing has moved it.
 *
 *   board  the screen is at least MIN_BOARD_W wide on the page: the widget fills it.
 *   large  the screen is smaller (1280x720 and down), or Expand was pressed: a dialog over a scrim.
 *
 * It is ONE iframe whose container changes, never remounted, so slider positions survive Expand, Collapse and
 * Hide. It stays mounted while hidden (display: none) for the same reason, and "Open interactive" brings it back.
 * The widget is always the dark kit: it is a lit screen in the room, and a theme change would reload it.
 *
 * The lesson pauses on the explore segment (useLessonPlayback); "try this" and, while paused, Continue sit in
 * the strip (board) or the footer (large).
 */

import { useEffect, useRef } from "react";
import { ArrowRight, Maximize2, Minimize2, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InteractiveFrame } from "@/components/learn/InteractiveFrame";
import { useAristoStore } from "@/store/useAristoStore";
import { cn } from "@/lib/utils";
import { PANEL_INSET_PX } from "@/components/learn/ClassroomChrome";

/** Narrower than this on the page, the screen is too small to play on: the large view opens instead. */
export const MIN_BOARD_W = 520;

const FOCUSABLE = 'button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

const LARGE_CARD =
  "absolute left-1/2 top-1/2 z-[60] h-[min(720px,calc(100%-6rem))] w-[min(960px,calc(100%-2.5rem))] -translate-x-1/2 -translate-y-1/2";
// The strip's controls match the image toolbar under the screen (Experience.tsx SCENE_BUTTON / SCENE_CHIP).
const STRIP_BUTTON = "whitespace-nowrap border border-line shadow-e1";
const STRIP_CHIP =
  "min-w-0 max-w-[min(420px,40vw)] truncate rounded-full border border-line bg-bg/[0.86] px-3 py-1.5 text-xs font-medium text-body backdrop-blur-md";

export function InteractiveStage() {
  const interactive = useAristoStore((s) => s.interactive);
  const shown       = useAristoStore((s) => s.interactiveShown);
  const expanded    = useAristoStore((s) => s.interactiveExpanded);
  const exploring   = useAristoStore((s) => s.exploring);
  const rect        = useAristoStore((s) => s.screenRect);
  const setInteractive         = useAristoStore((s) => s.setInteractive);
  const setInteractiveShown    = useAristoStore((s) => s.setInteractiveShown);
  const setInteractiveExpanded = useAristoStore((s) => s.setInteractiveExpanded);
  const requestContinue        = useAristoStore((s) => s.requestExploreContinue);

  // Board only where the whole screen is in view and clear of the lesson panel, and big enough to play on.
  const board =
    !!rect && rect.w >= MIN_BOARD_W && rect.x >= 0 && rect.y >= 0 &&
    typeof window !== "undefined" && rect.x + rect.w <= window.innerWidth - PANEL_INSET_PX;
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

  // Under the screen, centred on it, like the image's toolbar.
  const stripStyle = rect
    ? { left: rect.x + rect.w / 2, top: rect.y + rect.h + 14, transform: "translateX(-50%)" }
    : undefined;
  const onBoard = board && shown && !large;

  return (
    <>
      {large && <div aria-hidden className="absolute inset-0 z-[55] bg-black/50 backdrop-blur-sm" onClick={close} />}

      <div
        ref={cardRef}
        data-testid="interactive-card"
        data-layout={large ? "large" : "board"}
        tabIndex={-1}
        role={large ? "dialog" : "group"}
        aria-modal={large || undefined}
        aria-label={parts.title}
        style={onBoard && rect ? { left: rect.x, top: rect.y, width: rect.w, height: rect.h } : undefined}
        className={cn(
          "theme-ink flex flex-col overflow-hidden bg-surface text-ink outline-none",
          large ? cn(LARGE_CARD, "rounded-2xl border border-line shadow-e2") : "fixed z-20 rounded-[3px]",
          !shown && "hidden",
        )}
      >
        {large && (
          <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-line pl-4 pr-1.5">
            <h2 className="truncate text-sm font-semibold text-ink">{parts.title}</h2>
            <div className="flex shrink-0 items-center">
              {board && (
                <Button
                  variant="ghost" size="icon" className="rounded-full text-body hover:text-ink"
                  onClick={() => setInteractiveExpanded(false)}
                  aria-label="Back to the board"
                >
                  <Minimize2 aria-hidden />
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
        )}

        <div className="min-h-0 flex-1">
          <InteractiveFrame
            parts={parts}
            theme="dark"
            onReady={markReady}
            onFail={markFailed}
            onEscape={() => { if (large) closeRef.current(); }}
          />
        </div>

        {large && (
          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-line bg-sunk px-4 py-2">
            <div className="min-w-0 text-sm text-body">
              <span className="text-xs font-semibold text-muted">Try this</span>
              <ul className="mt-0.5 space-y-0.5">
                {spec.try_this.map((line) => <li key={line}>{line}</li>)}
              </ul>
            </div>
            {exploring && (
              <Button onClick={requestContinue} className="shrink-0">
                Continue
                <ArrowRight aria-hidden />
              </Button>
            )}
          </footer>
        )}
      </div>

      {/* The strip under the screen: what to try, Expand, Hide, and Continue while the lesson waits. */}
      {onBoard && (
        <div data-testid="interactive-strip" className="theme-ink fixed z-20 flex items-center gap-1.5" style={stripStyle}>
          <span className={STRIP_CHIP} title={spec.try_this[0]}>
            <span className="font-semibold text-muted">Try this: </span>{spec.try_this[0]}
          </span>
          <Button variant="secondary" className={STRIP_BUTTON} onClick={() => setInteractiveExpanded(true)}>
            <Maximize2 aria-hidden />
            Expand
          </Button>
          <Button
            variant="secondary" size="icon" className={cn(STRIP_BUTTON, "rounded-full")}
            onClick={() => setInteractiveShown(false)}
            aria-label="Hide the interactive"
          >
            <X aria-hidden />
          </Button>
          {exploring && (
            <Button onClick={requestContinue} className="shadow-e1">
              Continue
              <ArrowRight aria-hidden />
            </Button>
          )}
        </div>
      )}

      {/* Hidden: bring it back from under the screen (or the corner when there is no board), and never strand
          the pause, so Continue stays reachable. */}
      {!shown && status === "ready" && (
        <div
          className={cn("theme-ink z-20 flex items-center gap-2", board ? "fixed" : "absolute left-5 top-[76px]")}
          style={board ? stripStyle : undefined}
        >
          <Button
            variant="secondary"
            className="border border-line bg-bg/[0.86] shadow-e1 backdrop-blur-md"
            onClick={() => setInteractiveShown(true)}
          >
            <SlidersHorizontal aria-hidden />
            Open interactive
          </Button>
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
