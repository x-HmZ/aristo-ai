"use client";

import { useEffect } from "react";
import { Info, X } from "lucide-react";
import { useAristoStore } from "@/store/useAristoStore";
import { useLessonStatus } from "@/hooks/useLessonStatus";
import { FOCUS } from "@/lib/design/shape";
import { cn } from "@/lib/utils";

/** How long a notice stays before it goes away by itself. */
const AUTO_DISMISS_MS = 9000;

/**
 * Short, non-blocking notices for lesson pieces that failed (quiz, picture, 3D model, widget, narration). It sits in
 * the panel column's flow between the lesson and the bottom bar, so it never covers a control; the lesson carries on
 * underneath. Announced politely to screen readers.
 *
 * It also watches the interactive widget: that failure is reported through the store, not by a request this
 * component makes, so noticing it here covers both /learn and /demo.
 */
export function LessonNotices() {
  const notices = useLessonStatus((s) => s.notices);
  const dismiss = useLessonStatus((s) => s.dismissNotice);
  const push = useLessonStatus((s) => s.pushNotice);
  const widgetStatus = useAristoStore((s) => s.interactive.status);

  useEffect(() => {
    if (widgetStatus === "failed") push("widget");
  }, [widgetStatus, push]);

  useEffect(() => {
    if (notices.length === 0) return;
    const timers = notices.map((n) => setTimeout(() => dismiss(n.id), AUTO_DISMISS_MS));
    return () => timers.forEach(clearTimeout);
  }, [notices, dismiss]);

  return (
    <div role="status" aria-live="polite" className={cn(notices.length === 0 && "hidden")}>
      {notices.map((n) => (
        <div
          key={n.id}
          className="flex items-start gap-2 border-t border-line bg-surface/95 px-4 py-2 text-xs leading-snug text-body backdrop-blur-md"
        >
          <Info aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted" />
          <p className="min-w-0 flex-1">{n.message}</p>
          <button
            type="button"
            onClick={() => dismiss(n.id)}
            aria-label="Dismiss this message"
            className={cn("-my-2 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:text-ink", FOCUS)}
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
