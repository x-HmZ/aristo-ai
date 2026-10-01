import { useEffect, useState, type RefObject } from "react";
import type { LandingMode } from "./stage/gate";
import { host, subscribe as subscribeHost } from "./stage/host";
import type { SpotId } from "./stage/spots";

/**
 * Section clocks (V8.3b). Each section's motion graphic, and what Jake does beside it, runs on its own clock in
 * seconds: it starts once the section's graphic is at least 40% in view, pauses when it has left the view or the
 * tab is hidden, and stops at the section's length (it then holds; Replay starts it again). Nothing is tied to the
 * scroll position.
 *
 * One requestAnimationFrame ticker runs while any clock plays. The DOM follows a clock through `useCue` (a re-render
 * per cue, not per frame); the 3D stage reads `clockOf(id).t` in its own frame loop.
 *
 * Under reduced motion no clock runs and every section shows its final state (`FINAL`).
 */
export interface Clock {
  t: number;
  playing: boolean;
  /** Seconds; the clock stops here and holds. Infinity for a loop. */
  length: number;
  /** Bumped on Replay, so anything that fired once can fire again. */
  run: number;
  /** The section wants it running (in view, and its teacher live): set by useSectionPlay. */
  want: boolean;
  /** The reader paused it (a Pause control); it stays paused through scrolling until they play it again. */
  paused: boolean;
}

/** The time a section shows under reduced motion, or with no JS: after every cue. */
export const FINAL = Number.POSITIVE_INFINITY;

const clocks = new Map<string, Clock>();
const listeners = new Map<string, Set<() => void>>();
let frame = 0;
let last = 0;

export function clockOf(id: string): Clock {
  let c = clocks.get(id);
  if (!c) { c = { t: 0, playing: false, length: FINAL, run: 0, want: false, paused: false }; clocks.set(id, c); }
  return c;
}

const emit = (id: string) => listeners.get(id)?.forEach((l) => l());

function tick(now: number) {
  // A hidden tab gets no frames; the first one back is capped, so nothing jumps ahead.
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  let any = false;
  for (const [id, c] of clocks) {
    if (!c.playing) continue;
    c.t = Math.min(c.length, c.t + dt);
    if (c.t >= c.length) c.playing = false;
    else any = true;
    emit(id);
  }
  frame = any ? requestAnimationFrame(tick) : 0;
}

export function setPlaying(id: string, on: boolean): void {
  const c = clockOf(id);
  c.want = on;
  const next = on && !c.paused && c.t < c.length;
  if (c.playing === next) return;
  c.playing = next;
  emit(id);
  if (next && !frame) { last = performance.now(); frame = requestAnimationFrame(tick); }
}

export function restart(id: string): void {
  const c = clockOf(id);
  c.t = 0;
  c.run += 1;
  c.playing = false;
  c.paused = false;
  setPlaying(id, true);
}

/** The reader pauses or plays a section (WCAG 2.2.2). Playing again resumes only if the section still wants to run. */
export function setPaused(id: string, paused: boolean): void {
  const c = clockOf(id);
  c.paused = paused;
  emit(id);
  setPlaying(id, c.want);
}

export function subscribeClock(id: string, l: () => void): () => void {
  let set = listeners.get(id);
  if (!set) { set = new Set(); listeners.set(id, set); }
  set.add(l);
  return () => { set!.delete(l); };
}

export const reducedMotion = (): boolean =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Plays section `id` while `ref` is in view: from 40% visible, paused once it is fully out. `length` in seconds.
 * With `spot`, the section is Jake's own graphic (the model build): see below.
 * Under reduced motion the clock is set to its end and never runs.
 */
export function useSectionPlay(
  id: string,
  ref: RefObject<HTMLElement | null>,
  length: number,
  opts: { mode?: LandingMode | null; spot?: SpotId } = {},
): void {
  const { mode, spot } = opts;
  useEffect(() => {
    const c = clockOf(id);
    c.length = length;
    // A graphic that is Jake's own spot waits for the gate: on the full path it plays once he is live there; on the
    // lite path the spot is a still of its end, so the section shows its end too.
    if (spot && !mode) return;
    // `?still`: the stills are captured at each section's end (the V8.3b eval, scripts/stills.cjs).
    const params = new URLSearchParams(window.location.search);
    // `?still&start`: the first frame instead, held.
    if (params.has("still") && params.has("start")) { c.t = 0; emit(id); return; }
    if (reducedMotion() || mode === "stack" || (spot && mode === "lite") || params.has("still")) { c.t = length; emit(id); return; }
    const el = ref.current;
    if (!el) return;
    let inView = false;
    const ready = () => !spot || host.live === spot;
    const apply = () => setPlaying(id, inView && ready());
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.intersectionRatio >= 0.4) inView = true;
        else if (!e.isIntersecting) inView = false;
        apply();
      },
      { threshold: [0, 0.4] },
    );
    io.observe(el);
    const off = spot ? subscribeHost(apply) : undefined;
    return () => { io.disconnect(); off?.(); setPlaying(id, false); };
  }, [id, ref, length, mode, spot]);
}

/** Index of the last cue the clock has passed (-1 before the first), re-rendering only when it changes. */
export function cueIndex(t: number, cues: readonly number[]): number {
  let i = -1;
  while (i + 1 < cues.length && t >= cues[i + 1]) i++;
  return i;
}

export function useCue(id: string, cues: readonly number[]): { cue: number; run: number; playing: boolean; paused: boolean } {
  const [state, setState] = useState(() => ({ cue: -1, run: 0, playing: false, paused: false }));
  useEffect(() => {
    const on = () => setState((s) => {
      const c = clockOf(id);
      const n = { cue: cueIndex(c.t, cues), run: c.run, playing: c.playing, paused: c.paused };
      return n.cue === s.cue && n.run === s.run && n.playing === s.playing && n.paused === s.paused ? s : n;
    });
    on();
    return subscribeClock(id, on);
  }, [id, cues]);
  return state;
}
