"use client";

/**
 * The page shell shared by /learn (LearnClient) and /demo (DemoClient): the
 * top bar's glass pills and wordmark, and the lesson panel's column.
 *
 * The theme split (V8.4c, decisions.md):
 *   - The top bar floats on the lit 3D room, which never follows the theme,
 *     so its pills are ink glass in both themes (`.theme-ink`), like the
 *     caption band and the in-scene toolbars. Only ink, body and accent-text
 *     are used on the glass: muted is 4.3:1 over a white room pixel.
 *   - The panel column is app chrome and follows the theme.
 */

import { useEffect, useRef, useState } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { AristoMark } from "@/components/brand/AristoMark";
import { useClassroomLayout, type SheetSnap } from "@/store/useClassroomLayout";
import { cn } from "@/lib/utils";

/** The top bar row. Its z-index is set by each page (above its picker scrim). */
export const TOP_BAR = "absolute left-0 right-0 top-0 flex items-center justify-between gap-2 px-5 pt-3";

/** An ink-glass pill on the room: 52px tall around 44px controls. */
export function GlassPill({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "theme-ink flex h-[52px] items-center gap-0.5 rounded-full border border-line bg-bg/[0.86] p-1 text-body shadow-e1 backdrop-blur-md",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The wordmark in its pill; the column alone below sm, where the bar is tight. */
export function ClassroomWordmark() {
  return (
    <GlassPill className="justify-center max-sm:w-[52px] sm:px-5">
      <AristoMark decorative={false} className="hidden h-[17px] text-ink sm:block" litClassName="text-accent" />
      <AristoMark decorative={false} variant="column" className="h-6 text-ink sm:hidden" litClassName="text-accent" />
    </GlassPill>
  );
}

/** A pill divider between groups (sm and up). */
export function PillDivider() {
  return <span aria-hidden className="mx-1 hidden h-5 w-px shrink-0 bg-line sm:block" />;
}

/**
 * The lesson panel's column. 400px, never wider than the viewport minus the
 * 20px gutters. While the quiz is on the desk it collapses to its bottom strip
 * (everything else is `hidden`, not unmounted) so the paper is not under it.
 */
/** How far the panel's left edge sits from the viewport's right edge (400px + the 20px gutter). */
export const PANEL_INSET_PX = 420;

export function panelColumn(quizOnDesk: boolean) {
  return cn(
    "absolute bottom-5 right-5 z-10 flex w-[400px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-line shadow-e2",
    !quizOnDesk && "top-[76px]",
  );
}

/** The panel's scrolling middle: the page colour at 95% over the scene. */
export const PANEL_SLOT = "flex-1 overflow-hidden bg-bg/95 backdrop-blur-xl";

// ─── The lesson panel on a phone ──────────────────────────────────────────────

const DRAWER_MAX_PX = 340;
const SHEET_PEEK_PX = 112;
/** A full sheet stops this far below the top: the top bar (64px) and a 12px margin, so the room band never vanishes. */
const SHEET_FULL_GAP_PX = 76;
const SNAPS: SheetSnap[] = ["peek", "half", "full"];

const drawerWidth = (viewportW: number) => Math.min(DRAWER_MAX_PX, Math.round(viewportW * 0.44));

/**
 * The lesson panel, in whichever shape the screen needs (useClassroomLayout):
 *   desk       the 400px column on the right (panelColumn).
 *   portrait   a bottom sheet over a room band, three heights: drag its handle, tap it, or use Up and Down.
 *   landscape  a drawer on the right that can be hidden, so the room fills the screen.
 * One element for all of them, so turning the phone never remounts the lesson. While the quiz is on the desk it is
 * the bottom strip alone in every shape. It reports how much of the canvas it covers, for the camera.
 * The handle: drag it; a tap goes up a height (half, full) and back from full to half; Up and Down step through
 * peek, half and full.
 */
export function ClassroomPanel({ quizOnDesk, children }: { quizOnDesk: boolean; children: React.ReactNode }) {
  const mode = useClassroomLayout((s) => s.mode);
  const { w: vw, h: vh } = useClassroomLayout((s) => s.viewport);
  const snap = useClassroomLayout((s) => s.snap);
  const drawerOpen = useClassroomLayout((s) => s.drawerOpen);
  const setLayout = useClassroomLayout((s) => s.set);
  const [drag, setDrag] = useState<number | null>(null);
  const press = useRef<{ y: number; h: number; moved: boolean; last: number } | null>(null);

  const heights: Record<SheetSnap, number> = { peek: SHEET_PEEK_PX, half: Math.round(vh * 0.55), full: Math.max(SHEET_PEEK_PX, vh - SHEET_FULL_GAP_PX) };
  const sheetH = drag ?? heights[snap];
  const dw = drawerWidth(vw);

  useEffect(() => {
    if (mode === "portrait") setLayout({ panelRight: 0, panelBottom: quizOnDesk ? 0 : sheetH });
    else if (mode === "landscape") setLayout({ panelRight: drawerOpen && !quizOnDesk ? dw + 12 : 0, panelBottom: 0 });
    else setLayout({ panelRight: PANEL_INSET_PX, panelBottom: 0 });
  }, [mode, quizOnDesk, sheetH, drawerOpen, dw, setLayout]);

  const nearest = (h: number): SheetSnap =>
    SNAPS.reduce((a, b) => (Math.abs(heights[b] - h) < Math.abs(heights[a] - h) ? b : a));
  const step = (dir: 1 | -1) => setLayout({ snap: SNAPS[Math.min(2, Math.max(0, SNAPS.indexOf(snap) + dir))] });

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    press.current = { y: e.clientY, h: heights[snap], moved: false, last: heights[snap] };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const p = press.current;
    if (!p) return;
    if (Math.abs(e.clientY - p.y) > 6) p.moved = true;
    if (p.moved) {
      p.last = Math.min(heights.full, Math.max(heights.peek, p.h + (p.y - e.clientY)));
      setDrag(p.last);
    }
  };
  const onPointerUp = () => {
    const p = press.current;
    press.current = null;
    // The release height comes from the press record: a quick flick can end before the last render of `drag`.
    if (p?.moved) setLayout({ snap: nearest(p.last) });
    setDrag(null);
    if (p && !p.moved) setLayout({ snap: snap === "full" ? "half" : snap === "half" ? "full" : "half" });
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") { e.preventDefault(); step(1); }
    else if (e.key === "ArrowDown") { e.preventDefault(); step(-1); }
  };

  const portrait = mode === "portrait";
  const landscape = mode === "landscape";
  const hidden = landscape && !drawerOpen && !quizOnDesk;

  return (
    <>
      <div
        className={cn(
          mode === "desk" && panelColumn(quizOnDesk),
          portrait && "fixed inset-x-0 bottom-0 z-10 flex flex-col overflow-hidden rounded-t-2xl border border-b-0 border-line bg-bg/95 shadow-e2 backdrop-blur-xl",
          portrait && drag === null && "transition-[height] duration-300 ease-out motion-reduce:transition-none",
          landscape && "absolute bottom-3 z-10 flex flex-col overflow-hidden rounded-2xl border border-line shadow-e2 transition-transform duration-300 ease-out motion-reduce:transition-none",
          landscape && (quizOnDesk ? "inset-x-3" : "right-3 top-[64px]"),
          hidden && "invisible translate-x-[calc(100%+12px)]",
        )}
        style={
          portrait && !quizOnDesk ? { height: sheetH, paddingBottom: "env(safe-area-inset-bottom, 0px)" }
          : landscape && !quizOnDesk ? { width: dw }
          : undefined
        }
      >
        {portrait && !quizOnDesk && (
          <button
            type="button"
            aria-label="Resize the lesson panel"
            aria-expanded={snap !== "peek"}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => { press.current = null; setDrag(null); }}
            onKeyDown={onKeyDown}
            // Enter, Space and a screen reader's activate arrive as a click without pointer events (detail 0).
            onClick={(e) => { if (e.detail === 0) step(snap === "full" ? -1 : 1); }}
            aria-valuetext={snap}
            className="flex h-11 w-full shrink-0 touch-none items-center justify-center rounded-t-2xl bg-surface/95 outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span aria-hidden className="h-1.5 w-10 rounded-full bg-muted/60" />
          </button>
        )}
        {children}
      </div>

      {landscape && !quizOnDesk && (
        <button
          type="button"
          onClick={() => setLayout({ drawerOpen: !drawerOpen })}
          aria-expanded={drawerOpen}
          aria-label="Lesson"
          className="theme-ink fixed top-[64px] z-[11] flex h-11 items-center gap-2 rounded-full border border-line bg-bg/[0.86] px-4 text-sm font-medium text-ink shadow-e1 backdrop-blur-md transition-[right] duration-300 ease-out motion-reduce:transition-none"
          style={{ right: drawerOpen ? dw + 24 : 12 }}
        >
          {drawerOpen ? <PanelRightClose aria-hidden className="size-4" /> : <PanelRightOpen aria-hidden className="size-4" />}
          {drawerOpen ? "Hide lesson" : "Lesson"}
        </button>
      )}
    </>
  );
}
