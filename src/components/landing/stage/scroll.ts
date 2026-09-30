/**
 * The landing's scroll driver (V8.3): one source of truth for how far through the page the reader is.
 *
 * Each frame, `tick` reads `scrollY` once, turns it into each section's progress from offsets cached at the last
 * measure (resize, fonts, layout change), strings them into scene time `S` (timeline.ts) and damps it, then calls
 * every registered writer with the frame. Writers move things (DOM through refs, the 3D scene through objects);
 * nothing here sets React state, so a scroll frame never re-renders React.
 *
 * Who calls `tick`: the 3D stage's own render loop while it runs (one loop for the scene and the DOM, see
 * LandingStage), and otherwise this module's rAF loop, which runs only while something is still moving.
 *
 * Scroll itself stays native: no hijacking, no smooth-scroll library. The softness is the damping on what scroll
 * drives, so keyboard, find-in-page and screen readers behave as on any page.
 */
import { SECTIONS, damp, sceneTime } from "./timeline";

export interface StageFrame {
  /** Damped scene time. */
  S: number;
  /** Undamped scene time (where the scroll position is). */
  target: number;
  /** Each section's damped progress, in SECTIONS order. */
  progress: Float64Array;
  dt: number;
  vw: number;
  vh: number;
}
export type Writer = (f: StageFrame) => void;

/** Damping on S: about 0.3 s to cover most of a scroll step. Higher is snappier. */
export const LAMBDA = 8;
/** A jump larger than this (a nav link, Home, End) snaps instead of sweeping through every beat on the way. */
const SNAP_S = 0.75;

const n = SECTIONS.length;
const tops = new Float64Array(n);
const travels = new Float64Array(n);
const raw = new Float64Array(n);
const frame: StageFrame = { S: 0, target: 0, progress: new Float64Array(n), dt: 0, vw: 0, vh: 0 };
const writers = new Set<Writer>();

let started = false;
let measured = false;
let reduced = false;
let external = false;
let raf = 0;
let last = 0;
let first = true;

export function measure(): void {
  if (typeof window === "undefined") return;
  frame.vw = window.innerWidth;
  frame.vh = window.innerHeight;
  const y = window.scrollY;
  SECTIONS.forEach((s, i) => {
    const el = document.getElementById(s.id);
    if (!el) { tops[i] = Infinity; travels[i] = 1; return; }
    const r = el.getBoundingClientRect();
    tops[i] = r.top + y;
    // Pinned sections progress while their sticky frame is held; the others across their own height.
    // Under reduced motion nothing is pinned (the page is a plain stack, globals.css).
    const pinned = "vh" in s && !reduced;
    travels[i] = Math.max(1, pinned ? r.height - frame.vh : r.height);
  });
  measured = true;
}

function read(): number {
  const y = window.scrollY;
  for (let i = 0; i < n; i++) {
    const p = (y - tops[i]) / travels[i];
    raw[i] = p < 0 ? 0 : p > 1 ? 1 : p;
  }
  return sceneTime(raw);
}

/** One frame: read, damp, write. Returns true while S is still moving. */
export function tick(dt: number): boolean {
  if (!measured) measure();
  const target = read();
  const jump = Math.abs(target - frame.S) > SNAP_S;
  const S = reduced || jump || first ? target : damp(frame.S, target, LAMBDA, dt);
  first = false;
  frame.S = Math.abs(S - target) < 1e-4 ? target : S;
  frame.target = target;
  frame.dt = dt;
  // Per-section damped progress, recovered from S so the two never disagree.
  for (let i = 0; i < n; i++) frame.progress[i] = frame.S <= i ? 0 : frame.S >= i + 1 ? 1 : frame.S - i;
  writers.forEach((w) => w(frame));
  return frame.S !== target;
}

export const getFrame = (): StageFrame => frame;

function loop(now: number) {
  raf = 0;
  if (external) return;
  const dt = last ? (now - last) / 1000 : 1 / 60;
  last = now;
  if (tick(dt)) raf = requestAnimationFrame(loop);
  else last = 0;
}

/** Ask for frames until things settle (a scroll, a resize, a writer that joined). */
export function wake(): void {
  if (external || raf || typeof window === "undefined") return;
  raf = requestAnimationFrame(loop);
}

/** The 3D stage takes over the ticking (true) or hands it back (false). */
export function setExternal(on: boolean): void {
  external = on;
  if (on && raf) { cancelAnimationFrame(raf); raf = 0; }
  if (!on) { last = 0; wake(); }
}

export function addWriter(w: Writer): () => void {
  writers.add(w);
  if (measured) w(frame);
  wake();
  return () => { writers.delete(w); };
}

/** Start listening. Idempotent; the listeners live as long as the page. */
export function start(): () => void {
  if (started || typeof window === "undefined") return () => {};
  started = true;
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  reduced = mq.matches;
  const onMq = (e: MediaQueryListEvent) => { reduced = e.matches; measured = false; wake(); };
  const onScroll = () => wake();
  const onResize = () => { measured = false; wake(); };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
  mq.addEventListener("change", onMq);
  // Late layout (fonts, images) moves the sections: re-measure when the page's height changes.
  const ro = new ResizeObserver(onResize);
  ro.observe(document.body);
  measure();
  wake();
  return () => {
    started = false;
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
    mq.removeEventListener("change", onMq);
    ro.disconnect();
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
}
