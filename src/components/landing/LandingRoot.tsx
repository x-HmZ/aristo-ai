"use client";

import { Component, useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { displayFont } from "./fonts";
import { LandingNav } from "./LandingNav";
import { SiteFooter } from "./SiteFooter";
import { ForParents } from "./sections/ForParents";
import { Hero } from "./sections/Hero";
import { Idea } from "./sections/Idea";
import { Picture } from "./sections/Picture";
import { Close } from "./sections/Close";
import { ModelBuild } from "./sections/ModelBuild";
import { Moves } from "./sections/Moves";
import { Remember } from "./sections/Remember";
import { Immersive } from "./sections/Immersive";
import { decideMode, readEnv, type LandingMode } from "./stage/gate";
import { host, resetHost, spotBox, subscribe } from "./stage/host";
import { resetShared, shared } from "./stage/shared";
import { resetClocks } from "./play";
import { stopAll } from "./stage/sound";
import { INTRO_DONE_EVENT, introPending } from "./intro/gate";

interface StageProps { onLive: () => void; onSlow: () => void }

/** Anything the stage throws (a model that will not load, a lost context) hands the page to the lite path. */
class StageBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

/**
 * The landing (V8.3b, direction E "Jake Presents"; `.claude/plans/V8.3b-landing-plan.md`). A website: a floating
 * nav, then one section per feature, each with Jake beside its own short motion graphic. Nothing is pinned or
 * scrubbed; anything that plays starts when its section comes into view (play.ts).
 *
 * Server-rendered with every spot showing its still; on mount the gate picks the mode (gate.ts), and on the full
 * path the 3D stage is imported after the page's `load` and an idle moment. Its one canvas lives in a layer placed
 * over the active spot's box in page coordinates (host.ts), so it scrolls with the page on its own: nothing is
 * written per frame while the reader scrolls. The layer moves only when the active spot changes or the layout does.
 */
export function LandingRoot() {
  // null until the gate has run (the server render and the first paint).
  const [mode, setMode] = useState<LandingMode | null>(null);
  const [Stage, setStage] = useState<ComponentType<StageProps> | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  // The opening (intro/Intro.tsx), imported at once when `_document` turned its cover on (intro/gate.ts).
  const [Intro, setIntro] = useState<ComponentType<{ onDone: () => void }> | null>(null);
  useEffect(() => {
    if (!introPending()) return;
    let cancelled = false;
    import("./intro/Intro")
      .then((mod) => { if (!cancelled) setIntro(() => mod.default); })
      // The chunk did not load: the cover's failsafe lifts it (globals.css); the page carries on without it.
      .catch(() => { document.documentElement.dataset.intro = "done"; window.dispatchEvent(new Event(INTRO_DONE_EVENT)); });
    return () => { cancelled = true; };
  }, []);
  const introDone = useCallback(() => setIntro(null), []);

  // Leaving / by a client-side link: nothing of the landing plays or lingers on the next page, and coming back starts
  // it fresh (its clocks and shared state are module-level, and outlive this component).
  useEffect(() => () => {
    stopAll();
    resetHost();
    resetClocks();
    resetShared();
    delete document.documentElement.dataset.stage;
  }, []);

  useEffect(() => {
    const m = decideMode(readEnv());
    shared.mode = m;
    setMode(m);
    const html = document.documentElement;
    if (m !== "full") { html.dataset.stage = "off"; return; }
    html.dataset.stage = "loading";
    let cancelled = false;
    const go = () => {
      if (cancelled) return;
      import("./stage/LandingStage")
        .then((mod) => { if (!cancelled) setStage(() => mod.default); })
        // The chunk did not load (offline, a failed deploy): stay on the stills.
        .catch(() => { if (cancelled) return; html.dataset.stage = "off"; shared.mode = "lite"; setMode("lite"); });
    };
    const idle = () => {
      if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(go, { timeout: 1500 });
      else setTimeout(go, 200);
    };
    // During the opening the stage waits: its shader warm-up would take the opening's frames. It ends on the poster
    // the live teacher then replaces.
    const afterIntro = () => {
      if (!introPending()) { idle(); return; }
      window.addEventListener(INTRO_DONE_EVENT, idle, { once: true });
    };
    if (document.readyState === "complete") afterIntro();
    else window.addEventListener("load", afterIntro, { once: true });
    return () => { cancelled = true; window.removeEventListener("load", afterIntro); window.removeEventListener(INTRO_DONE_EVENT, idle); };
  }, []);

  // The layer follows the active spot: its box in the root's coordinates, and shown once the teacher is live there.
  useEffect(() => {
    if (!Stage) return;
    // `?probe&wide=m` (verification only): the layer reaches past the box, m of its width each side and m of its
    // height above (LandingStage's Framing grows the view to match), so what falls outside the box can be measured.
    const params = new URLSearchParams(window.location.search);
    const wide = params.has("probe") ? Number(params.get("wide")) || 0 : 0;
    const place = () => {
      const el = layer.current, r = root.current;
      const spot = host.active ? spotBox(host.active) : null;
      if (!el || !r || !spot) return;
      const a = spot.getBoundingClientRect(), b = r.getBoundingClientRect();
      const s = el.style;
      const dx = wide * a.width, dy = wide * a.height;
      const t = `translate3d(${Math.round(a.left - b.left - dx)}px, ${Math.round(a.top - b.top - dy)}px, 0)`;
      if (s.transform !== t) s.transform = t;
      if (s.width !== `${Math.round(a.width + 2 * dx)}px`) s.width = `${Math.round(a.width + 2 * dx)}px`;
      if (s.height !== `${Math.round(a.height + dy)}px`) s.height = `${Math.round(a.height + dy)}px`;
      // It fades in once live; it goes out at once, so a move never shows the teacher mid-mount at the new spot.
      // The room is edge to edge: no fade at its foot (globals.css, by the layer's spot).
      if (el.dataset.at !== host.active) el.dataset.at = host.active ?? "";
      const on = host.live !== null && host.live === host.active;
      s.transition = on ? "" : "none";
      s.opacity = on ? "1" : "0";
    };
    place();
    const off = subscribe(place);
    const ro = new ResizeObserver(place);
    if (root.current) ro.observe(root.current);
    document.querySelectorAll("[data-spot]").forEach((el) => ro.observe(el));
    window.addEventListener("resize", place, { passive: true });
    return () => { off(); ro.disconnect(); window.removeEventListener("resize", place); };
  }, [Stage]);

  const onLive = useCallback(() => {
    shared.live = true;
    document.documentElement.dataset.stage = "live";
  }, []);
  const onSlow = useCallback(() => {
    shared.live = false;
    shared.mode = "lite";
    resetHost();
    document.documentElement.dataset.stage = "off";
    setStage(null);
    setMode("lite");
  }, []);

  return (
    <div
      ref={root}
      data-mode={mode ?? undefined}
      className={cn(displayFont.variable, "landing relative min-h-screen overflow-x-clip bg-bg font-sans text-ink antialiased")}
    >
      {/* The opening's ink, there from the first paint when it plays (globals.css); the opening itself over it. */}
      <div aria-hidden className="landing-intro-cover" />
      {Intro && <Intro onDone={introDone} />}
      <header>
        <LandingNav />
      </header>

      {/* The canvas layer: above each spot's still and pool, under its overlays (z-20) and the nav. */}
      <div
        ref={layer}
        data-stage-layer
        aria-hidden
        className="landing-fade pointer-events-none absolute left-0 top-0 z-10 transition-opacity duration-200"
        style={{ opacity: 0, width: 0, height: 0 }}
      >
        {Stage && (
          <StageBoundary onError={onSlow}>
            <Stage onLive={onLive} onSlow={onSlow} />
          </StageBoundary>
        )}
      </div>

      <main>
        <Hero mode={mode} />
        <Idea mode={mode} />
        <Picture mode={mode} />
        <ModelBuild mode={mode} />
        <Moves mode={mode} />
        <Remember mode={mode} />
        <Immersive mode={mode} />
        <ForParents />
        <Close />
      </main>

      <SiteFooter />
    </div>
  );
}
