/**
 * The example learner on the landing's map (V8.3, "It Remembers What You Know"): pure functions of the section's
 * progress. The map is a real course's concepts (kg-snapshot.json); this progress is illustrative, and the page
 * says so. Unit-tested.
 */
import snapshot from "@/data/landing/kg-snapshot.json";
import { seg, smooth } from "./stage/timeline";

export interface MapNode { id: string; name: string; layer: number; x: number; y: number }
export const NODES: readonly MapNode[] = snapshot.nodes;
export const EDGES: readonly (readonly [string, string])[] = snapshot.edges as [string, string][];
export const COURSE = snapshot.course.title;

/** Learning order: by layer (prerequisites first), then top to bottom. */
export const ORDER: readonly string[] = [...NODES].sort((a, b) => a.layer - b.layer || a.y - b.y).map((n) => n.id);
const rank = new Map(ORDER.map((id, i) => [id, i]));

/** When each concept is mastered, as the section's progress. */
export const learnedAt = (id: string): number => 0.14 + (0.38 * rank.get(id)!) / Math.max(1, ORDER.length - 1);

/** Three earlier concepts fade a little, then a review brings each back: when it is pulled back, and from where. */
export const REVIEWS = [ORDER[2], ORDER[5], ORDER[8]].map((id, i) => ({ id, at: 0.62 + i * 0.08 }));
const FADE: readonly [number, number] = [0.55, 0.6];
const TRAVEL = 0.05;

/** Mastery (0 to 1) of concept `id` at progress `p`. */
export function masteryAt(id: string, p: number): number {
  const t = learnedAt(id);
  let m = 0.95 * smooth(seg(p, t - 0.03, t));
  const review = REVIEWS.find((r) => r.id === id);
  if (review) {
    const dip = smooth(seg(p, FADE[0], FADE[1]));
    const back = smooth(seg(p, review.at + TRAVEL, review.at + TRAVEL + 0.03));
    m -= 0.4 * dip * (1 - back);
  }
  return m;
}

/** A concept is ready (the frontier) when all it builds on is mastered and it is not yet. */
export function stateAt(id: string, p: number): "done" | "ready" | "later" {
  if (masteryAt(id, p) >= 0.5) return "done";
  const prereqs = EDGES.filter(([, to]) => to === id).map(([from]) => from);
  return prereqs.every((pre) => masteryAt(pre, p) >= 0.5) ? "ready" : "later";
}

/** The day counter over the section. */
export const dayAt = (p: number): number => 1 + Math.round(seg(p, 0.1, 0.95) * 20);

/**
 * A review pulse's route: back along the links from the newest concept to the faded one (a breadth-first search
 * over the edges in either direction), as node ids.
 */
export function routeTo(from: string, to: string): string[] {
  const adj = new Map<string, string[]>();
  for (const [a, b] of EDGES) { (adj.get(a) ?? adj.set(a, []).get(a)!).push(b); (adj.get(b) ?? adj.set(b, []).get(b)!).push(a); }
  const prev = new Map<string, string>([[from, from]]);
  const queue = [from];
  while (queue.length) {
    const n = queue.shift()!;
    if (n === to) break;
    for (const m of adj.get(n) ?? []) if (!prev.has(m)) { prev.set(m, n); queue.push(m); }
  }
  if (!prev.has(to)) return [from, to];
  const path = [to];
  while (path[0] !== from) path.unshift(prev.get(path[0])!);
  return path;
}

/** Where a pulse is along its route (0 to 1), or null when it is not travelling. */
export function pulseAt(i: number, p: number): number | null {
  const r = REVIEWS[i];
  if (p < r.at || p > r.at + TRAVEL) return null;
  return seg(p, r.at, r.at + TRAVEL);
}

/** The newest concept: where the pulses start. */
export const NEWEST = ORDER[ORDER.length - 1];

// ─── One concept over three weeks (the curve beside the map) ───────────────────

/** Days the concept is reviewed (day 0: learned). Each review is spaced further out. */
export const CURVE_REVIEWS = [0, 2, 6, 13] as const;
/** How long the memory holds after each review (grows with every one). */
const STABILITY = [1.6, 4, 9, 22] as const;
export const CURVE_DAYS = 21;

/** Recall (0 to 1) on `day`: decays from 1 after the latest review, slower after each. */
export function recallOn(day: number): number {
  let k = 0;
  for (let i = 0; i < CURVE_REVIEWS.length; i++) if (day >= CURVE_REVIEWS[i]) k = i;
  return Math.exp(-(day - CURVE_REVIEWS[k]) / STABILITY[k]);
}
