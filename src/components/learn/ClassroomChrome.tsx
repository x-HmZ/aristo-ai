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

import { AristoMark } from "@/components/brand/AristoMark";
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
export function panelColumn(quizOnDesk: boolean) {
  return cn(
    "absolute bottom-5 right-5 z-10 flex w-[400px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-line shadow-e2",
    !quizOnDesk && "top-[76px]",
  );
}

/** The panel's scrolling middle: the page colour at 95% over the scene. */
export const PANEL_SLOT = "flex-1 overflow-hidden bg-bg/95 backdrop-blur-xl";
