"use client";

/**
 * The opening (V8.3c, "Spark to Teacher"): the whole product in about five seconds, on the page's ink, before the
 * page. A spark draws the Column mark and lights its flute; the mark bursts into a question; the question breaks into
 * the lesson's ideas, linked; they fold into a brain that turns; and it pours into the hero, becoming the teacher's
 * poster exactly where it is, as the page's lights come on and the headline rises. The live teacher then takes over
 * and waves, as on any visit.
 *
 * Its own chunk (LandingRoot imports it at once when `_document` turned the cover on; gate.ts). A skip (the button,
 * Esc or any key, a scroll, a tap) runs the rest five times faster; it never cuts. Under reduced motion it never plays.
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { FOCUS, PRESS, SHAPE } from "@/lib/design/shape";
import { getTeacher, TEACHER_NAME } from "../teacher";
import { Engine, type Frame } from "./engine";
import { INTRO_DONE_EVENT, INTRO_KEY } from "./gate";
import { markCloud, posterCloud, textCloud } from "./sample";
import { BEATS, COVER, FADE, HEADLINE_AT, LENGTH, LINKS, SKIP_RATE, brainTurn, morphAt, ramp } from "./timeline";
import { CREAM, brain, constellation, fill, orbs, rng, type Cloud } from "./targets";

const QUESTION = "How does your brain work?";
/** The lesson's ideas, as the brain lesson names them: the centre orb, then the ring. */
const IDEAS = ["Your brain", "Thinking", "Touch", "Hearing", "Memory", "Vision", "Balance", "Breathing"] as const;

export default function Intro({ onDone }: { onDone: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const labels = useRef<(HTMLSpanElement | null)[]>([]);
  const skip = useRef<() => void>(() => {});
  const [ideaAt, setIdeaAt] = useState<[number, number][]>([]);

  useEffect(() => {
    const html = document.documentElement;
    // Too late (the failsafe lifted the cover while this loaded): never cover a page being read.
    if (html.dataset.intro !== "on") { onDone(); return; }
    html.dataset.intro = "playing";
    // The page under the cover is out of reach (no focus, no reading) until the lights come on.
    const under = Array.from(document.querySelectorAll<HTMLElement>(".landing > header, .landing > main, .landing > footer"));
    for (const el of under) el.inert = true;
    try { sessionStorage.setItem(INTRO_KEY, "1"); } catch { /* plays again next load: fine */ }
    const cv = canvas.current;
    let rate = 1, t = 0, last = performance.now(), raf = 0, headline = false, cover = false, ended = false;
    let engine: Engine | null = null;
    const small = innerWidth < 768;
    const n = small ? 7000 : 16000;
    try { if (cv) engine = new Engine(cv, n, rng(3)); } catch { engine = null; }
    if (!engine) { finish(); return; }

    const vw = innerWidth, vh = innerHeight;
    const font = getComputedStyle(document.getElementById("hero-title") ?? document.body).fontFamily;
    const ideas = constellation(IDEAS.length, Math.min(vw * 0.34, 430), Math.min(vh * 0.27, 230), 5);
    setIdeaAt(ideas.centres);
    const linkPts = new Float32Array(ideas.links.flatMap(([a, b]) => [...ideas.centres[a], ...ideas.centres[b]]));
    // Where the spark starts: a pinpoint at the centre.
    const spark: Cloud = fill(n, 1, 2, 3, (_, p, c) => { p[0] = 0; p[1] = 0; p[2] = 0; c[0] = 1; c[1] = 0.55; c[2] = 0.25; });
    const shapes: Record<string, () => Cloud> = {
      mark: () => markCloud(n, Math.min(vh * 0.42, 300)),
      question: () => textCloud(n, QUESTION, "brain", font, Math.min(vw * 0.86, 1100)),
      ideas: () => orbs(n, ideas.centres, small ? 34 : 46, 9),
      brain: () => brain(n, Math.min(vw, vh) * (small ? 0.78 : 0.62), 21),
      teacher: () => {
        const spot = document.querySelector<HTMLElement>('[data-spot="hero"]');
        const img = spot?.querySelector<HTMLImageElement>(`img.landing-teacher-${getTeacher()}`);
        const cloud = spot && img ? posterCloud(n, img, spot.getBoundingClientRect()) : null;
        // No poster to form (not loaded, scrolled away): the points go out to the light instead.
        return cloud ?? fill(n, 1, 4, Math.max(vw, vh), (_, p, c) => { p[0] = 0; p[1] = 0; p[2] = 0; c.splice(0, 3, ...CREAM); });
      },
    };
    engine.morphTo(spark);
    // Each shape is built ahead of its beat, in an idle moment (a beat that starts before its shape is ready builds it
    // then): built on the frame its morph starts, the samplers cost that frame 50 to 180 ms.
    const ready = new Map<number, Cloud>();
    const ahead = (i: number) => {
      if (i >= BEATS.length || ready.has(i) || BEATS[i].shape === "teacher") return; // the poster is read at its beat
      const run = () => { if (!ended && !ready.has(i)) ready.set(i, shapes[BEATS[i].shape]()); };
      if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(run, { timeout: 400 });
      else window.setTimeout(run, 30);
    };
    ready.set(0, shapes.mark());
    ahead(1);
    // `?introdebug` (verification only): the clock holds and the capture script seeks it (eval intro.cjs).
    const debug = process.env.NODE_ENV !== "production" && new URLSearchParams(location.search).has("introdebug");
    if (debug) (window as unknown as { __introSeek?: (to: number) => void }).__introSeek = (to: number) => { t = to; };
    let current = -1;
    let built: Cloud | null = null;
    let markHead: Float32Array | null = null;

    const frame = (now: number) => {
      try { step(now); } catch { finish(); }
    };
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!debug) t += dt * rate;
      const { beat, k } = morphAt(t);
      if (beat !== current && beat >= 0) {
        current = beat;
        built = ready.get(beat) ?? shapes[BEATS[beat].shape]();
        ready.delete(beat);
        ahead(beat + 1);
        if (BEATS[beat].shape === "mark") markHead = built.pos;
        engine!.morphTo(built, "next");
      }
      const b = BEATS[Math.max(0, current)];
      const isBrain = b.shape === "brain", isTeacher = b.shape === "teacher";
      const f: Frame = {
        t: current < 0 ? 0 : k,
        time: t,
        rotA: isTeacher ? brainTurn(t) : 0,
        rotB: isBrain ? brainTurn(t) : 0,
        spread: b.spread,
        swirl: b.swirl,
        size: isTeacher ? 2.2 + (1 - k) * 1.2 : isBrain ? (small ? 2.8 : 3.3) : small ? 2.4 : 2.8,
        alpha: (current < 0 ? ramp(t, [0, 0.15]) : 1) * (1 - ramp(t, FADE)),
        soft: isTeacher ? 1 - k : 1,
        jitter: k >= 1 && !isTeacher ? 0.8 : 0,
        // Light on the ink until the points become the picture, which must look like the picture.
        additive: !(isTeacher && k > 0.5),
        links: { pts: linkPts, alpha: ramp(t, LINKS.in) * (1 - ramp(t, LINKS.out)) },
        spark: null,
      };
      // The spark's head: where the drawing has got to along the mark, then it settles into the lit flute.
      if (b.shape === "mark" && markHead) {
        const i = Math.min(n - 1, Math.floor(Math.min(1, k / (1 - b.spread * 0.35)) * (n - 1)));
        f.spark = { x: markHead[i * 3], y: markHead[i * 3 + 1], size: 34, alpha: 1 - ramp(t, [0.95, 1.15]) };
      } else if (current < 0) {
        f.spark = { x: 0, y: 0, size: 10 + 24 * ramp(t, [0, 0.15]), alpha: ramp(t, [0, 0.1]) };
      }
      engine!.draw(f);
      // The ideas' names, with their links.
      const la = ramp(t, [LINKS.in[0] + 0.05, LINKS.in[1]]) * (1 - ramp(t, LINKS.out));
      for (const el of labels.current) if (el) el.style.opacity = la.toFixed(2);
      if (!cover && t >= COVER[0]) { cover = true; html.dataset.intro = "lifting"; for (const el of under) el.inert = false; }
      if (!headline && t >= HEADLINE_AT) { headline = true; html.dataset.introHeadline = ""; }
      if (t >= LENGTH) { finish(); return; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    // Whatever happens (a hidden tab, a stalled frame loop), the page is never left covered.
    const watchdog = window.setTimeout(() => finish(), (LENGTH + 4) * 1000);

    function finish() {
      if (ended) return;
      ended = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(watchdog);
      for (const el of under) el.inert = false;
      html.dataset.intro = "done";
      delete html.dataset.introHeadline;
      window.dispatchEvent(new Event(INTRO_DONE_EVENT));
      onDone();
    }
    // Any of these runs the rest faster.
    const hurry = () => { rate = SKIP_RATE; };
    skip.current = hurry;
    // Tab moves to Skip: it does not hurry.
    const onKey = (e: KeyboardEvent) => { if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key !== "Tab" && e.key !== "Shift") hurry(); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", hurry, { passive: true });
    window.addEventListener("touchmove", hurry, { passive: true });
    return () => {
      ended = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(watchdog);
      for (const el of under) el.inert = false;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", hurry);
      window.removeEventListener("touchmove", hurry);
      engine?.dispose();
      if (html.dataset.intro !== "done") html.dataset.intro = "done";
      delete html.dataset.introHeadline;
    };
    // Mounted once: everything it needs is read on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="landing-intro fixed inset-0 z-[71]" onPointerDown={() => skip.current()}>
      <canvas ref={canvas} aria-hidden className="absolute inset-0 h-full w-full" />
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2">
        {ideaAt.map(([x, y], i) => (
          <span
            key={IDEAS[i]}
            ref={(el) => { labels.current[i] = el; }}
            className={cn("absolute -translate-x-1/2 whitespace-nowrap text-[13px] font-semibold tracking-[0.04em] sm:text-sm", i === 0 ? "text-[#FFB27A]" : "text-[#F4ECE1]/85")}
            style={{ left: x, top: y + (i === 0 ? 34 : 30), opacity: 0 }}
          >
            {IDEAS[i]}
          </span>
        ))}
      </div>
      <p className="sr-only" role="status">Aristo: {TEACHER_NAME[getTeacher()]}, your own AI teacher, is getting ready.</p>
      <button
        type="button"
        onClick={() => skip.current()}
        className={cn(SHAPE.pill, PRESS, FOCUS, "landing-intro-skip absolute right-4 top-4 inline-flex min-h-[44px] items-center px-4 text-sm font-semibold text-[#F4ECE1]/80 hover:bg-white/10 hover:text-[#F4ECE1] sm:right-6 sm:top-6")}
      >
        Skip intro
      </button>
    </div>
  );
}
