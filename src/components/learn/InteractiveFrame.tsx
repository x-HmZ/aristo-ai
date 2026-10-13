"use client";

/**
 * Runs one generated widget in a locked sandbox.
 *
 * `sandbox="allow-scripts"` with no `allow-same-origin` gives the page an opaque
 * origin: no cookies, no storage, no Supabase session, no reach into this
 * document. The CSP inside the srcdoc (lib/interactive/shell.ts) blocks every
 * network request. The only thing that crosses is a `ready` or `error`
 * postMessage, accepted only from this frame's own window.
 *
 * A widget that throws, or never says `ready` within `readyTimeoutMs`, is
 * reported through `onFail` so the lesson can fall back to the image.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { InteractiveParts } from "@/lib/interactive/spec";
import {
  WIDGET_SANDBOX,
  buildWidgetDoc,
  parseWidgetMessage,
  type WidgetTheme,
} from "@/lib/interactive/shell";

export type FrameStatus = "loading" | "ready" | "failed";

interface Props {
  parts:            InteractiveParts;
  theme:            WidgetTheme;
  onReady?:         () => void;
  onFail?:          (reason: string) => void;
  /** The learner pressed Escape while focus was inside the widget. */
  onEscape?:        () => void;
  readyTimeoutMs?:  number;
  className?:       string;
}

/** Nothing a widget needs from the browser; every powerful feature off. */
const FRAME_ALLOW =
  "autoplay 'none'; camera 'none'; clipboard-read 'none'; clipboard-write 'none'; display-capture 'none'; " +
  "fullscreen 'none'; geolocation 'none'; microphone 'none'; picture-in-picture 'none'; web-share 'none'";

export function InteractiveFrame({ parts, theme, onReady, onFail, onEscape, readyTimeoutMs = 4000, className }: Props) {
  const srcDoc   = useMemo(() => buildWidgetDoc(parts, theme), [parts, theme]);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<FrameStatus>("loading");

  const readyRef  = useRef(onReady);
  const failRef   = useRef(onFail);
  const escapeRef = useRef(onEscape);
  useEffect(() => { readyRef.current = onReady; failRef.current = onFail; escapeRef.current = onEscape; });
  const loads = useRef(0);
  const [navigated, setNavigated] = useState(false);

  useEffect(() => {
    setStatus("loading");
    loads.current = 0;
    setNavigated(false);
    let settled = false;
    const settle = (next: FrameStatus, reason = "") => {
      if (settled) return;
      settled = true;
      setStatus(next);
      if (next === "ready") readyRef.current?.();
      else failRef.current?.(reason);
    };

    const onMessage = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow) return;
      const msg = parseWidgetMessage(e.data);
      if (!msg) return;
      if (msg.event === "escape") { escapeRef.current?.(); return; }
      if (msg.event === "ready") settle("ready");
      else settle("failed", msg.message || "widget error");
    };
    window.addEventListener("message", onMessage);
    const timer = window.setTimeout(() => settle("failed", "no ready signal"), readyTimeoutMs);

    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
    };
  }, [srcDoc, readyTimeoutMs]);

  return (
    <div className={cn("relative size-full bg-surface", className)} data-widget-status={status}>
      {/* A second load means the page navigated itself away from the srcdoc: drop the frame. */}
      {!navigated && (
        <iframe
          key={srcDoc}
          ref={frameRef}
          title={parts.title}
          srcDoc={srcDoc}
          sandbox={WIDGET_SANDBOX}
          allow={FRAME_ALLOW}
          referrerPolicy="no-referrer"
          onLoad={() => {
            if (++loads.current > 1) { setNavigated(true); setStatus("failed"); failRef.current?.("navigated"); }
          }}
          className={cn("size-full border-0 bg-surface", status === "failed" && "invisible")}
        />
      )}
      {status === "loading" && (
        <div
          role="status"
          className="absolute inset-0 flex items-center justify-center bg-surface text-sm text-muted"
        >
          <span aria-hidden className="mr-2 size-1.5 rounded-full bg-accent-text motion-safe:animate-pulse" />
          Loading the interactive
        </div>
      )}
    </div>
  );
}
