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

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Maximize2, Minimize2, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InteractiveFrame } from "@/components/learn/InteractiveFrame";
import { useAristoStore, type ScreenRect } from "@/store/useAristoStore";
import { useClassroomLayout } from "@/store/useClassroomLayout";
import { cn } from "@/lib/utils";
import { PANEL_INSET_PX } from "@/components/learn/ClassroomChrome";

/** Narrower than this on the page, the screen is too small to play on: the large view opens instead. */
export const MIN_BOARD_W = 520;
/** How long the screen must hold still on the page before the layout is decided; and the wait for no screen at all. */
const SETTLE_MS = 450;
const NO_SCREEN_MS = 1500;

/** How much of the page's right side the lesson panel covers: the desk column, or what the phone layout reports. */
function panelInset(): number {
  const { mode, panelRight } = useClassroomLayout.getState();
  return mode === "desk" ? PANEL_INSET_PX : panelRight;
}

/** The whole screen in view, clear of the lesson panel, big enough to play on, and the strip (with Continue) under it. */
function boardFits(rect: ScreenRect): boolean {
  return rect.w >= MIN_BOARD_W && rect.x >= 0 && rect.y >= 0 &&
    rect.x + rect.w <= window.innerWidth - panelInset() &&
    rect.y + rect.h + STRIP_ROOM <= window.innerHeight;
}
/** The strip under the screen: its gap and its 44px controls. */
const STRIP_ROOM = 64;

const FOCUSABLE = 'button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

const LARGE_CARD =
  "absolute left-1/2 top-1/2 z-[60] h-[min(720px,calc(100%-6rem))] w-[min(960px,calc(100%-2.5rem))] -translate-x-1/2 -translate-y-1/2";
// On a phone the large view is the whole screen but for a thin margin: the widget needs every pixel of height.
const LARGE_CARD_PHONE = "absolute inset-2 z-[60]";
// The strip's controls match the image toolbar under the screen (Experience.tsx SCENE_BUTTON / SCENE_CHIP): 44px pills.
const STRIP_BUTTON = "whitespace-nowrap rounded-full border border-line shadow-e1";
const STRIP_CONTINUE = "whitespace-nowrap rounded-full shadow-e1";
const STRIP_CHIP =
  "block h-11 min-w-0 max-w-[min(420px,40vw)] truncate rounded-full border border-line bg-bg/[0.86] px-4 text-xs font-medium leading-[42px] text-body backdrop-blur-md";

/** The widget is ready but hidden (and no quiz is up): "Open interactive" brings it back. */
function useReopenable(): boolean {
  return useAristoStore((s) =>
    !!s.interactive.parts && s.interactive.status === "ready" && !s.interactiveShown && !s.activeQuiz);
}

/** A picture or model toolbar is under the screen (Experience.tsx), so the reopen controls join its row. */
function useSceneToolbar(): boolean {
  return useAristoStore((s) => !!s.activePreviewImageUrl || (!!s.activeModelUrl && s.viewMode3d));
}

/**
 * "Open interactive", and Continue while the lesson waits, in the scene toolbar's row under the screen. Two controls
 * centred under the same screen on separate layers drew over each other (Hmz, 2026-10-15). Renders nothing unless
 * the screen could hold the widget; otherwise InteractiveStage puts the controls in the corner.
 */
export function ReopenInteractiveControls({ buttonClassName }: { buttonClassName: string }) {
  const reopenable = useReopenable();
  const exploring = useAristoStore((s) => s.exploring);
  const rect = useAristoStore((s) => s.screenRect);
  const setInteractiveShown = useAristoStore((s) => s.setInteractiveShown);
  const requestContinue = useAristoStore((s) => s.requestExploreContinue);
  if (!reopenable || !rect || !boardFits(rect)) return null;
  return (
    <>
      <Button variant="secondary" className={buttonClassName} onClick={() => setInteractiveShown(true)}>
        <SlidersHorizontal aria-hidden />
        Open interactive
      </Button>
      {exploring && (
        <Button onClick={requestContinue} className={STRIP_CONTINUE}>
          Continue
          <ArrowRight aria-hidden />
        </Button>
      )}
    </>
  );
}

export function InteractiveStage() {
  const interactive = useAristoStore((s) => s.interactive);
  // Off while the quiz is on the desk: the camera looks down there and the display is out of view.
  const shown       = useAristoStore((s) => s.interactiveShown && !s.activeQuiz);
  const expanded    = useAristoStore((s) => s.interactiveExpanded);
  const exploring   = useAristoStore((s) => s.exploring);
  const rect        = useAristoStore((s) => s.screenRect);
  const setInteractive         = useAristoStore((s) => s.setInteractive);
  const setInteractiveShown    = useAristoStore((s) => s.setInteractiveShown);
  const setInteractiveExpanded = useAristoStore((s) => s.setInteractiveExpanded);
  const requestContinue        = useAristoStore((s) => s.requestExploreContinue);
  const reopenable             = useReopenable();
  const sceneToolbar           = useSceneToolbar();
  const setWidgetOnBoard       = useAristoStore((s) => s.setWidgetOnBoard);
  const setWidgetTouched       = useAristoStore((s) => s.setWidgetTouched);
  const mode                   = useClassroomLayout((s) => s.mode);
  const phone                  = mode !== "desk";
  const sideFooter             = mode === "landscape";
  // Portrait: "Try this" is its first line until asked for; the widget keeps the height.
  const [triesOpen, setTriesOpen] = useState(false);

  // Board or large view is decided each time the widget is shown, once the screen has held still on the page, and
  // again after a window resize; it then holds while the widget is up. Never from a passing frame (an orbit drag, the
  // framing's glide): that flipped the widget into a dialog mid-gesture. Until decided the card stays hidden (its frame
  // mounted); with no screen at all, the large view.
  const [board, setBoard] = useState<boolean | null>(null);
  const resized = useRef(false);
  useEffect(() => {
    const onResize = () => { resized.current = true; };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  useEffect(() => {
    if (!shown) { setBoard(null); return; }
    const id = window.setTimeout(() => {
      setBoard((prev) => {
        if (prev !== null && !resized.current) return prev;
        resized.current = false;
        return !!rect && boardFits(rect);
      });
    }, rect ? SETTLE_MS : NO_SCREEN_MS);
    return () => window.clearTimeout(id);
  }, [rect, shown]);
  const { parts, spec, status } = interactive;
  // A new widget starts untouched.
  useEffect(() => { setWidgetTouched(false); setTriesOpen(false); }, [parts, setWidgetTouched]);
  const live = !!parts && status !== "failed" && status !== "idle";
  const large = shown && board !== null && (expanded || !board);
  // On the board the widget sits under the canvas and shows through the display's screen (Classroom.tsx WallDisplay),
  // so the teacher's hand draws over it where they overlap. Not for the large view, a dialog over the scene, and
  // only while the card exists: a failed widget must close the hole.
  const onBoard = live && !!rect && shown && board === true && !large;
  useEffect(() => {
    setWidgetOnBoard(onBoard);
    return () => setWidgetOnBoard(false);
  }, [onBoard, setWidgetOnBoard]);

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

  // Under the screen and no wider than it, like the image's toolbar: the "Try this" chip shrinks first.
  const stripStyle = rect ? { left: rect.x, top: rect.y + rect.h + 14, width: rect.w } : undefined;
  // The "Open interactive" control sits under the screen whenever the screen could hold the widget.
  const pillOnBoard = !!rect && boardFits(rect);

  return (
    <>
      {large && <div aria-hidden className="absolute inset-0 z-[55] bg-black/50 backdrop-blur-sm" onClick={close} />}

      <div
        ref={cardRef}
        data-testid="interactive-card"
        data-layout={large ? "large" : "board"}
        data-board={String(board)}
        tabIndex={-1}
        role={large ? "dialog" : "group"}
        aria-modal={large || undefined}
        aria-label={parts.title}
        style={onBoard && rect ? { left: rect.x, top: rect.y, width: rect.w, height: rect.h } : undefined}
        className={cn(
          "theme-ink flex flex-col overflow-hidden bg-surface text-ink outline-none",
          large ? cn(phone ? LARGE_CARD_PHONE : LARGE_CARD, "rounded-2xl border border-line shadow-e2") : "fixed z-[1] rounded-[3px]",
          (!shown || board === null) && "hidden",
        )}
      >
        {large && (
          <header className={cn("flex shrink-0 items-center justify-between gap-2 border-b border-line pl-4 pr-1.5", sideFooter ? "h-11" : "h-12")}>
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

        <div className={cn("flex min-h-0 flex-1", large && sideFooter ? "flex-row" : "flex-col")}>
          <div className="min-h-0 min-w-0 flex-1">
            <InteractiveFrame
              parts={parts}
              theme="dark"
              onReady={markReady}
              onFail={markFailed}
              onEscape={() => { if (large) closeRef.current(); }}
              onTouch={() => { if (!useAristoStore.getState().widgetTouched) setWidgetTouched(true); }}
            />
          </div>

          {large && (
            <footer
              className={cn(
                "flex shrink-0 gap-3 bg-sunk px-4 py-2",
                sideFooter
                  ? "aristo-scroll w-[216px] flex-col justify-between overflow-y-auto border-l border-line"
                  : "items-center justify-between border-t border-line",
              )}
            >
              <div className="min-w-0 text-sm text-body">
                <span className="text-xs font-semibold text-muted">Try this</span>
                {phone && !sideFooter && !triesOpen ? (
                  <p className="mt-0.5 flex items-baseline gap-2">
                    <span className="line-clamp-1 min-w-0">{spec.try_this[0]}</span>
                    {(spec.try_this.length > 1 || spec.try_this[0].length > 44) && (
                      <button type="button" onClick={() => setTriesOpen(true)} className="inline-flex h-11 shrink-0 items-center px-2 text-xs font-semibold text-accent-text">
                        More
                      </button>
                    )}
                  </p>
                ) : (
                  <ul className="mt-0.5 space-y-0.5">
                    {spec.try_this.map((line) => <li key={line}>{line}</li>)}
                  </ul>
                )}
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
      </div>

      {/* The strip under the screen: what to try, Expand, Hide, and Continue while the lesson waits. */}
      {onBoard && (
        <div data-testid="interactive-strip" className="theme-ink fixed z-20 flex items-center justify-center gap-1.5" style={stripStyle}>
          <span className={STRIP_CHIP} title={spec.try_this[0]}>
            <span className="font-semibold text-muted">Try this: </span>{spec.try_this[0]}
          </span>
          <Button variant="secondary" className={STRIP_BUTTON} onClick={() => setInteractiveExpanded(true)}>
            <Maximize2 aria-hidden />
            Expand
          </Button>
          <Button
            variant="secondary" size="icon" className={STRIP_BUTTON}
            onClick={() => setInteractiveShown(false)}
            aria-label="Hide the interactive"
          >
            <X aria-hidden />
          </Button>
          {exploring && (
            <Button onClick={requestContinue} className={STRIP_CONTINUE}>
              Continue
              <ArrowRight aria-hidden />
            </Button>
          )}
        </div>
      )}

      {/* Hidden: bring it back from under the screen (or the corner when there is no board), and never strand
          the pause, so Continue stays reachable. Under a picture or model, ReopenInteractiveControls sits in that
          toolbar's row instead. */}
      {reopenable && !(pillOnBoard && sceneToolbar) && (
        <div
          className={cn("theme-ink z-20 flex items-center gap-2", pillOnBoard ? "fixed justify-center" : "absolute left-5 top-[76px]")}
          style={pillOnBoard ? stripStyle : undefined}
        >
          <Button
            variant="secondary"
            className="rounded-full border border-line bg-bg/[0.86] shadow-e1 backdrop-blur-md"
            onClick={() => setInteractiveShown(true)}
          >
            <SlidersHorizontal aria-hidden />
            Open interactive
          </Button>
          {exploring && (
            <Button onClick={requestContinue} className={STRIP_CONTINUE}>
              Continue
              <ArrowRight aria-hidden />
            </Button>
          )}
        </div>
      )}
    </>
  );
}
