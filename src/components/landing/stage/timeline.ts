/**
 * The landing's choreography (V8.3), as pure functions of scroll. No DOM, no three.js: the scroll driver
 * (scroll.ts) turns the page's scroll position into section progress, and everything that moves (the camera, the
 * teacher's signals, the diagram, the model, the DOM overlays) reads it through these functions. Unit-tested.
 *
 * Scene time `S` strings the sections together: section i covers [i, i + 1), so S = 2.5 is halfway through the
 * centrepiece. The storyboard is `.claude/plans/V8.3-landing-plan.md`.
 */
import type { DirectorSignals } from "@/lib/avatar/director";

// ─── Sections ──────────────────────────────────────────────────────────────────

/** In page order. `vh` is the pinned height in viewport heights; unset = natural height (not pinned). */
export const SECTIONS = [
  { id: "top", vh: 220 },
  { id: "idea", vh: 220 },
  { id: "how", vh: 520 },
  { id: "moves", vh: 450 },
  { id: "map", vh: 300 },
  { id: "parents" },
  { id: "start", vh: 160 },
] as const satisfies readonly { id: string; vh?: number }[];

export type SectionId = (typeof SECTIONS)[number]["id"];
export const SECTION_INDEX = Object.fromEntries(SECTIONS.map((s, i) => [s.id, i])) as Record<SectionId, number>;

// ─── Small maths ───────────────────────────────────────────────────────────────

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Progress of `v` through [a, b], clamped. */
export const seg = (v: number, a: number, b: number): number => clamp01((v - a) / (b - a));
export const smooth = (t: number): number => t * t * (3 - 2 * t);
export const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
/** 1 inside [a, b] with `fade` ramps outside it, 0 elsewhere. */
export const window01 = (v: number, a: number, b: number, fade: number): number =>
  Math.min(seg(v, a - fade, a), 1 - seg(v, b, b + fade));
/** Frame-rate independent exponential approach (the CameraController's damping). */
export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  current + (target - current) * (1 - Math.exp(-lambda * Math.min(dt, 0.1)));

/**
 * Scene time from each section's progress (0 before it, 1 after it). The last section that has started wins, so
 * S only moves forward through the page.
 */
export function sceneTime(progress: ArrayLike<number>): number {
  for (let i = progress.length - 1; i >= 0; i--) if (progress[i] > 0) return i + Math.min(progress[i], 1);
  return 0;
}

// ─── Camera ───────────────────────────────────────────────────────────────────

export type V3 = readonly [number, number, number];
export interface Pose { pos: V3; target: V3 }
interface Key extends Pose { s: number }

/** The classroom's lesson framing (CameraController's LESSON_POS, looking straight down -z). */
export const LESSON: Pose = { pos: [0, 0, 0.9], target: [0, 0, -3] };
/** Outside the room, looking in through the window: where the opening starts. */
export const OUTSIDE: Pose = { pos: [0.3, 0.32, 3.4], target: [-0.15, -0.1, -3] };
/** Facing the display wall, the teacher at the left edge. */
const DISPLAY: Pose = { pos: [0.05, 0.12, 0.5], target: [0.5, 0.36, -6] };
/** A step back, so the question's ideas have room around the teacher. */
const PULLBACK: Pose = { pos: [0.05, 0.05, 1.45], target: [0, -0.02, -3] };
/** On the board anchor, where the diagram resolves and the model is built. */
const BOARD: Pose = { pos: [0.18, 0.08, 0.62], target: [0.26, 0.12, -3] };
const MODEL: Pose = { pos: [0.05, 0.06, 0.62], target: [0.1, 0.08, -3] };
const CLOSE: Pose = { pos: [-0.2, 0.02, 0.8], target: [-0.35, 0, -3] };

/** Where the camera is at each key; it holds on a key and eases (smoothstep) between neighbours. */
const KEYS: readonly Key[] = [
  { s: 0.0, ...OUTSIDE },
  { s: 0.62, ...LESSON },
  { s: 1.0, ...LESSON },
  { s: 1.16, ...DISPLAY },
  { s: 1.82, ...DISPLAY },
  { s: 2.0, ...PULLBACK },
  { s: 2.3, ...PULLBACK },
  { s: 2.48, ...BOARD },
  { s: 2.66, ...BOARD },
  { s: 2.74, ...MODEL },
  { s: 2.86, ...MODEL },
  { s: 2.97, ...LESSON },
  // One lesson, five moves: 0.2 each.
  { s: 3.2, ...LESSON },
  { s: 3.26, pos: [0, 0.02, 0.62], target: [-0.05, 0, -3] },
  { s: 3.4, pos: [0, 0.02, 0.62], target: [-0.05, 0, -3] },
  { s: 3.46, ...BOARD },
  { s: 3.6, ...BOARD },
  // 3.6 to 3.8, the challenge: the desk (deskPose, injected, because it depends on the canvas size).
  { s: 3.8, ...LESSON },
  { s: 3.88, ...PULLBACK },
  { s: 4.0, ...PULLBACK },
  { s: 5.9, ...CLOSE },
  { s: 7.0, ...CLOSE },
];
/** The challenge move's desk window: glide down after YourTurn, hold, glide back for Connect. */
export const DESK_IN: readonly [number, number] = [3.66, 3.72];
export const DESK_OUT: readonly [number, number] = [3.76, 3.8];

const lerp3 = (a: V3, b: V3, t: number): V3 => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

/** The camera's pose at scene time `S`. `desk` is the desk framing for the current canvas (deskFraming.ts). */
export function cameraAt(S: number, desk: Pose): Pose {
  let pose: Pose = KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++) {
    const a = KEYS[i], b = KEYS[i + 1];
    if (S <= b.s) {
      const t = smooth(seg(S, a.s, b.s));
      pose = { pos: lerp3(a.pos, b.pos, t), target: lerp3(a.target, b.target, t) };
      break;
    }
  }
  const d = S < DESK_IN[1] ? smooth(seg(S, DESK_IN[0], DESK_IN[1])) : 1 - smooth(seg(S, DESK_OUT[0], DESK_OUT[1]));
  if (d <= 0) return pose;
  return { pos: lerp3(pose.pos, desk.pos, d), target: lerp3(pose.target, desk.target, d) };
}

// ─── What is in the room ──────────────────────────────────────────────────────

/** The five moves: index (0 to 4) and progress through it, or null outside the section. */
export function moveAt(S: number): { index: number; q: number } | null {
  if (S < 3 || S >= 4) return null;
  const m = (S - 3) * 5;
  const index = Math.min(4, Math.floor(m));
  return { index, q: m - index };
}

export interface RoomState {
  /** The canvas's opacity: the room fades out for the map and the parents, and back for the close. */
  canvas: number;
  /** The window frame: 0 = the framed window, 1 = full bleed. */
  open: number;
  /** The diagram: how far it has resolved (0 to 1), and where it sits (0 the board anchor, 1 the display wall). */
  diagram: number;
  diagramPlace: number;
  /** The heart: 0 = the photo card, 1 = the finished model; `model` is its visibility at the anchor. */
  build: number;
  model: number;
  /** The challenge card on the desk (0 to 1). */
  desk: number;
}

export function roomAt(S: number): RoomState {
  const canvas = S < 4.5 ? 1 - smooth(seg(S, 4.0, 4.12)) : smooth(seg(S, 5.88, 6.0));
  const open = S < 6 ? smooth(seg(S, 0.05, 0.62)) : 1 - smooth(seg(S, 6.15, 6.6));
  const diagram = S < 2.48 ? 0 : seg(S, 2.48, 2.64);
  // To the wall as the model arrives; back to the anchor for Demonstrate, then up again.
  const up = seg(S, 2.66, 2.72);
  const down = window01(S, 3.44, 3.56, 0.04);
  const diagramPlace = smooth(up) * (1 - smooth(down));
  const build = seg(S, 2.68, 2.87);
  const model = S < 2.68 ? 0 : 1 - smooth(down);
  const desk = window01(S, 3.7, 3.77, 0.02);
  return { canvas, open, diagram, diagramPlace, build, model, desk };
}

// ─── The teacher ──────────────────────────────────────────────────────────────

const IDLE: DirectorSignals = {
  gesture: "idle", isLoading: false, isSpeaking: false, phase: null, role: null, segmentId: null,
  awaitingAnswer: false, modelShown: false, modelInteracting: false, previewImage: null, quizActive: false,
  quizResult: null, lessonComplete: false, sceneReady: false, reaction: null,
};

/** The teacher has two acts: the page (opening to the five moves) and the close, a fresh mount that waves goodbye. */
export const actAt = (S: number): "page" | "close" => (S >= 5 ? "close" : "page");

export interface TeacherContext {
  /** The opening turn has finished: the greeting may play. */
  greeted: boolean;
  /** The opt-in sound is playing a line. */
  speaking: boolean;
}

/**
 * The director's signals at scene time `S`. Every gesture is one the product plays for the same signal, so it
 * means the same thing here as in a lesson:
 * - the greeting wave on `sceneReady` (the opening, and the close's fresh mount as goodbye);
 * - OneMoment then Thinking while the lesson is "generating" (`isLoading`);
 * - HoldIdea on the explain phase, as the five moves are written;
 * - PresentModel when the diagram lands (`previewImage`) and when the model appears (`modelShown`);
 * - Pointing at the diagram (`gesture: pointing`);
 * - Imagine on the hook, StepBeat on a demo step, YourTurn on the challenge, BringTogether on connect, ThatsIt at
 *   the end (the segment's role and phase, keyed per beat so scrolling back replays them).
 */
export function teacherSignals(S: number, ctx: TeacherContext): DirectorSignals {
  const act = actAt(S);
  if (act === "close") return { ...IDLE, sceneReady: S >= 5.95 };
  const s: DirectorSignals = { ...IDLE, sceneReady: ctx.greeted, isSpeaking: ctx.speaking };
  // The idea: he turns to the display and points at the story as it lands.
  if (S >= 1.2 && S < 1.42) s.gesture = "pointing";
  // The centrepiece.
  if (S >= 2.02 && S < 2.3) s.isLoading = true;
  if (S >= 2.3 && S < 2.48) { s.phase = "explain"; s.segmentId = "how:cards"; }
  if (S >= 2.62) s.previewImage = "/demo/heart/teaching.jpg";
  if (S >= 2.64 && S < 2.7) s.gesture = "pointing";
  if (S >= 2.85) s.modelShown = true;
  if (S >= 2.9 && S < 3) { s.phase = "activate"; s.role = "hook"; s.segmentId = "how:seg_001"; }
  // The five moves.
  const move = moveAt(S);
  if (move) {
    const ids = ["seg_001", "seg_004", "seg_009", "seg_013", "seg_015"] as const;
    const phases = ["activate", "explain", "demonstrate", "challenge", "connect"] as const;
    s.phase = phases[move.index];
    s.segmentId = `moves:${ids[move.index]}`;
    if (move.index === 0) s.role = "hook";
    // modelShown stays true while the diagram takes the anchor: a second rising edge would play PresentModel
    // over the challenge's YourTurn.
    if (move.index === 2) {
      if (move.q < 0.4) s.role = "demo_step";
      else s.gesture = "pointing";
    }
    if (move.index === 3) {
      s.role = "challenge_setup";
      if (move.q >= 0.45 && move.q < 0.9) s.quizActive = true;
    }
    if (move.index === 4 && move.q > 0.85) s.lessonComplete = true;
  }
  if (S >= 4) s.lessonComplete = true;
  return s;
}

/** The opening turn: from three quarters to the board (yaw offset) round to the student, over TURN_S seconds. */
export const TURN_S = 1.1;
export const TURN_FROM = 1.15;
export const teacherYaw = (secondsSinceReady: number): number => TURN_FROM * (1 - easeInOut(seg(secondsSinceReady, 0.25, 0.25 + TURN_S)));
