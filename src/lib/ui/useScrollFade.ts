"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * A scroll area that fades the edge where more content continues (the top once scrolled, the bottom while more is
 * below), so a short scroller never cuts a line of text with a hard edge. Off when `on` is false. Re-measured on
 * resize and whenever `deps` change (a new question, a result, a dismissed notice).
 */
export function useScrollFade<T extends HTMLElement = HTMLDivElement>(on: boolean, ...deps: unknown[]) {
  const ref = useRef<T>(null);
  const [fade, setFade] = useState({ top: false, bottom: false });
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const top = el.scrollTop > 1;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setFade((f) => (f.top === top && f.bottom === bottom ? f : { top, bottom }));
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!on || !el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are the caller's re-measure triggers
  }, [on, measure, ...deps]);
  const style: CSSProperties | undefined = on && (fade.top || fade.bottom) ? {
    maskImage: `linear-gradient(to bottom, ${fade.top ? "transparent, black 20px" : "black"}, ${fade.bottom ? "black calc(100% - 28px), transparent" : "black"})`,
  } : undefined;
  return { ref, onScroll: on ? measure : undefined, style };
}
