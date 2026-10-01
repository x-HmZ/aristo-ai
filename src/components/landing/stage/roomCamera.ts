/**
 * Step Into the Classroom's camera (V8.3b): the tour's poses and the look around. Its own module because the desk view
 * is the classroom's (deskFraming, which needs three.js): only the lazy stage imports it, so nothing of three reaches
 * the page's first load through the section (room.ts, which Immersive.tsx imports, stays pure and three-free).
 *
 * Pure: no DOM; three only through deskFraming's constants. Unit-tested.
 */
import { DESK_POSE, DESK_TARGET } from "@/components/three/deskFraming";
import { EYE, type V3 } from "./spots";

export interface Pose { pos: V3; target: V3 }

/** The classroom's lesson camera (CameraController LESSON_POS, looking straight down -z), as in a lesson. */
export const LESSON: Pose = { pos: EYE, target: [0, 0, -3] };
/** Behind the room's back wall, looking in (the V8.3 opening): where the tour starts, and its poster. */
export const OUTSIDE: Pose = { pos: [0.3, 0.32, 3.4], target: [-0.15, -0.1, -3] };
/** A little nearer him while he explains: the seat, leaning in. */
const LEAN: Pose = { pos: [-0.12, 0.02, 0.55], target: [-0.42, -0.02, -3] };
/** On the board: Jake at the left, the picture in the middle (the V8.3 board pose). */
const BOARD: Pose = { pos: [0.16, 0.08, 0.6], target: [0.24, 0.12, -3] };
/**
 * Leaning in to the board while he talks it through: as near as keeps the top of his head (0.87) and the foot of the
 * picture (-0.59) in a 16:9 view with a margin, and him and the picture's right edge across it.
 */
const LEAN_BOARD: Pose = { pos: [-0.06, 0.13, -0.3], target: [-0.04, 0.12, -3.1] };
/** On the model: him and it, a little lower and nearer. */
const MODEL: Pose = { pos: [0.02, 0.0, 0.45], target: [0.02, 0.06, -3] };
/** Your desk: the classroom's own desk view, as its OrbitControls clamp it (deskFraming DESK_POSE). */
const DESK: Pose = { pos: DESK_POSE, target: [DESK_TARGET.x, DESK_TARGET.y, DESK_TARGET.z] };

/** The camera's keys: it holds on a key and eases (smoothstep) between neighbours. */
const KEYS: readonly (Pose & { t: number })[] = [
  // The poster is the first frame: the tour holds it a moment before it moves in, so going live never jumps.
  { t: 0, ...OUTSIDE },
  { t: 0.6, ...OUTSIDE },
  { t: 2.8, ...LESSON },
  { t: 3.2, ...LESSON },
  { t: 7.4, ...LEAN },
  { t: 8.8, ...BOARD },
  { t: 10.6, ...BOARD },
  { t: 13.4, ...LEAN_BOARD },
  { t: 17.2, ...LEAN_BOARD },
  { t: 18.5, ...MODEL },
  // A glance down to the desk and back up: quick, as a head tilts (a slow tilt dwells on his legs on the way).
  { t: 24.7, ...MODEL },
  { t: 25.6, ...DESK },
  { t: 30.5, ...DESK },
  { t: 31.4, ...LESSON },
];

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t: number) => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mix3 = (a: V3, b: V3, t: number): V3 => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

/** A pose's view as a heading (yaw, from -z towards +x), an elevation (pitch) and a distance to its target. */
function aimOf(p: Pose): { yaw: number; pitch: number; dist: number } {
  const dx = p.target[0] - p.pos[0], dy = p.target[1] - p.pos[1], dz = p.target[2] - p.pos[2];
  const dist = Math.hypot(dx, dy, dz);
  return { yaw: Math.atan2(dx, -dz), pitch: Math.asin(dy / dist), dist };
}

/**
 * The camera's pose at tour time `t`. Between keys the position eases along a line and the view turns, heading and
 * elevation each easing on their own: a turn down to the desk is a head tilting, not a look target sliding across the
 * floor (which sweeps the view over his legs).
 */
export function roomCameraAt(t: number): Pose {
  for (let i = 0; i < KEYS.length - 1; i++) {
    const a = KEYS[i], b = KEYS[i + 1];
    if (t <= b.t) {
      const k = smooth(clamp01((t - a.t) / (b.t - a.t)));
      const pos = mix3(a.pos, b.pos, k);
      const A = aimOf(a), B = aimOf(b);
      const yaw = mix(A.yaw, B.yaw, k), pitch = mix(A.pitch, B.pitch, k), dist = mix(A.dist, B.dist, k);
      const target: V3 = [pos[0] + dist * Math.cos(pitch) * Math.sin(yaw), pos[1] + dist * Math.sin(pitch), pos[2] - dist * Math.cos(pitch) * Math.cos(yaw)];
      return { pos, target };
    }
  }
  const last = KEYS[KEYS.length - 1];
  return { pos: last.pos, target: last.target };
}

/** The tour's direction turned by the reader's look (`yaw` right, `pitch` up), at the same distance. */
export function lookAround(pose: Pose, yaw: number, pitch: number): V3 {
  const [px, py, pz] = pose.pos;
  const dx = pose.target[0] - px, dy = pose.target[1] - py, dz = pose.target[2] - pz;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-6 || (yaw === 0 && pitch === 0)) return pose.target;
  const y0 = Math.atan2(dx, -dz), p0 = Math.asin(dy / len);
  const y1 = y0 + yaw, p1 = Math.max(-1.3, Math.min(1.3, p0 + pitch));
  return [px + len * Math.cos(p1) * Math.sin(y1), py + len * Math.sin(p1), pz - len * Math.cos(p1) * Math.cos(y1)];
}
