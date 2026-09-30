"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { cn } from "@/lib/utils";
import { displayFont } from "./fonts";
import { MOVES } from "./content";
import { LandingNav } from "./LandingNav";
import { SiteFooter } from "./SiteFooter";
import { ForParents } from "./ForParents";
import { useStageWriter } from "./Pinned";
import { Opening } from "./sections/Opening";
import { Idea } from "./sections/Idea";
import { Question } from "./sections/Question";
import { Moves } from "./sections/Moves";
import { MapStory } from "./sections/MapStory";
import { Close } from "./sections/Close";
import { decideMode, readEnv, type LandingMode } from "./stage/gate";
import { measure as measureScroll, start } from "./stage/scroll";
import { shared } from "./stage/shared";
import { want } from "./stage/sound";
import { SECTIONS, mix, moveAt, roomAt } from "./stage/timeline";

interface StageProps { active: boolean; onLive: () => void; onSlow: () => void }

/** A window's box inside its pinned frame, and the section's scroll span, measured on resize. */
interface WindowBox { dx: number; dy: number; w: number; h: number; top: number; travel: number }

function measureWindow(name: "top" | "start"): WindowBox | null {
  const el = document.querySelector<HTMLElement>(`[data-window="${name}"]`);
  const section = document.getElementById(name);
  const frame = el?.closest<HTMLElement>(".landing-pin-frame");
  if (!el || !section || !frame) return null;
  const r = el.getBoundingClientRect(), fr = frame.getBoundingClientRect(), sr = section.getBoundingClientRect();
  return { dx: r.left - fr.left, dy: r.top - fr.top, w: r.width, h: r.height, top: sr.top + window.scrollY, travel: sr.height - window.innerHeight };
}

/** Where a pinned frame's top is on screen for a scroll position: below, stuck at 0, or scrolling away. */
const frameTop = (b: WindowBox, y: number) => (y < b.top ? b.top - y : y <= b.top + b.travel ? 0 : b.top + b.travel - y);

/**
 * The landing (V8.3). Server-rendered as the lite layout (pinned sections over stills, the poster as LCP); on mount
 * the gate picks the mode, and on the full path the 3D stage is imported after the page's `load` and an idle
 * moment, then fades in over the poster once it has painted the room with the teacher in it.
 *
 * This component owns the stage layer: a fixed box painted first, under every pinned frame (a sticky frame is its own
 * stacking context, so the canvas cannot sit between a frame's poster and its text; the poster fades out instead), clipped to the opening's window and opened to
 * full bleed by the scroll (then closed into the close's window), faded out for the map and the parents (where the
 * stage stops rendering), and handed over to the lite path if the stage turns out slow.
 */
export function LandingRoot() {
  const [mode, setMode] = useState<LandingMode>("lite");
  const [Stage, setStage] = useState<ComponentType<StageProps> | null>(null);
  const [active, setActive] = useState(true);
  const layer = useRef<HTMLDivElement>(null);
  const boxes = useRef<{ top: WindowBox | null; start: WindowBox | null }>({ top: null, start: null });
  const liveAt = useRef<number | null>(null);
  const activeRef = useRef(true);

  useEffect(() => start(), []);

  useEffect(() => {
    const m = decideMode(readEnv());
    shared.mode = m;
    setMode(m);
    const root = document.documentElement;
    if (m !== "full") { root.dataset.stage = "off"; return; }
    root.dataset.stage = "loading";
    let cancelled = false;
    const go = () => {
      if (cancelled) return;
      void import("./stage/LandingStage").then((mod) => { if (!cancelled) setStage(() => mod.default); });
    };
    const idle = () => {
      if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(go, { timeout: 1500 });
      else setTimeout(go, 200);
    };
    if (document.readyState === "complete") idle();
    else window.addEventListener("load", idle, { once: true });
    return () => { cancelled = true; window.removeEventListener("load", idle); };
  }, []);

  useEffect(() => {
    const onResize = () => { boxes.current = { top: measureWindow("top"), start: measureWindow("start") }; };
    onResize();
    window.addEventListener("resize", onResize, { passive: true });
    const ro = new ResizeObserver(onResize);
    ro.observe(document.body);
    return () => { window.removeEventListener("resize", onResize); ro.disconnect(); };
  }, [mode]);

  useStageWriter((f) => {
    const S = f.S;
    const r = roomAt(S);
    // The opt-in sound follows the line on screen (the stack has no scroll-driven beats; its buttons play in place).
    if (S < SECTIONS.length) {
      const move = moveAt(S);
      want(S >= 2.9 && S < 3 ? MOVES[0].segment : move ? MOVES[move.index].segment : null);
    }
    const el = layer.current;
    if (!el) return;
    // Pause the stage while the room is faded out.
    const on = r.canvas > 0 || (S > 3.9 && S < 4.2) || S > 5.75;
    if (on !== activeRef.current) { activeRef.current = on; setActive(on); }
    // Shown once live (the poster above it fades out, globals.css); then the room's own fade.
    const o = liveAt.current === null ? 0 : r.canvas;
    const os = o < 0.001 ? "0" : o.toFixed(3);
    if (el.style.opacity !== os) el.style.opacity = os;
    // The window: the stage is clipped to the opening's (or the close's) window and opened to full bleed.
    const box = S < 3 ? boxes.current.top : S > 5 ? boxes.current.start : null;
    let clip = "none";
    shared.lens.x = 0;
    shared.lens.y = 0;
    if (box && r.open < 0.999) {
      const top = frameTop(box, window.scrollY) + box.dy;
      const k = r.open;
      const t = mix(top, 0, k), l = mix(box.dx, 0, k);
      const b = mix(f.vh - (top + box.h), 0, k), rr = mix(f.vw - (box.dx + box.w), 0, k);
      shared.lens.x = (box.dx + box.w / 2 - f.vw / 2) * (1 - k);
      shared.lens.y = (top + box.h / 2 - f.vh / 2) * (1 - k);
      clip = `inset(${t.toFixed(1)}px ${rr.toFixed(1)}px ${b.toFixed(1)}px ${l.toFixed(1)}px round ${(16 * (1 - k)).toFixed(1)}px)`;
    }
    if (el.style.clipPath !== clip) el.style.clipPath = clip;
  });

  const onLive = () => {
    shared.live = true;
    liveAt.current = performance.now();
    document.documentElement.dataset.stage = "live";
    measureScroll();
  };
  const onSlow = () => {
    shared.live = false;
    shared.mode = "lite";
    liveAt.current = null;
    document.documentElement.dataset.stage = "off";
    setStage(null);
    setMode("lite");
  };

  return (
    <div
      data-mode={mode}
      className={cn(displayFont.variable, "landing relative min-h-screen overflow-x-clip bg-bg text-ink")}
    >
      {/* Without JS nothing pins and every beat shows in flow (the same rules as reduced motion, globals.css). */}
      <noscript>
        <style>{`.landing-pin{height:auto}.landing-pin-frame{position:relative;height:auto;overflow:visible}.landing-beat{position:relative!important;inset:auto!important;opacity:1!important;transform:none!important;visibility:visible!important}.landing-motion-only{display:none!important}.landing-overlap>*{grid-area:auto}.landing-reveal{opacity:1;transform:none}`}</style>
      </noscript>

      <header>
        <LandingNav />
      </header>

      <div ref={layer} aria-hidden className="pointer-events-none fixed inset-0 z-0" style={{ opacity: 0 }}>
        {Stage && <Stage active={active} onLive={onLive} onSlow={onSlow} />}
      </div>

      <main>
        <Opening />
        <Idea />
        <Question />
        <Moves />
        <MapStory />
        <ForParents />
        <Close />
      </main>

      <SiteFooter />
    </div>
  );
}

