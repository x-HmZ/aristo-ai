/**
 * Step Into the Classroom (V8.3b, "Immersive"): the product's own classroom, with Jake teaching the volcano demo
 * lesson while the camera tours the room. Everything above on the page is here at once, where the product puts it:
 * the lesson's picture on the board, the model that picture becomes, and the quiz on your desk.
 *
 * The tour runs on the section's clock (play.ts, "room"), as four shots the reader can also jump to:
 *   1. Your teacher: the camera comes in through the window to the seat, and he explains the idea (HoldIdea).
 *   2. The board: the cross-section lands and he points at it ("Take a look at this cross-section"); as he goes on
 *      about it, the camera leans in to it, him and the whole picture still in view.
 *   3. The model: the picture becomes the 3D model; he presents it (PresentModel), his palm at its edge.
 *   4. Your desk: the camera looks down at the quiz on your desk, as a lesson ends, and comes back up to him.
 * His words are the lesson's own lines, at their real pace (sound.ts), silent unless Hear it is on.
 *
 * Pure: no DOM, no three.js. Unit-tested.
 */
import { DESK_POSE, DESK_TARGET, PAPER_ANCHOR } from "@/components/three/deskFraming";
import type { DirectorSignals } from "@/lib/avatar/director";
import { IDLE, PICTURE_PLACE } from "./scripts";
import { EYE, type V3 } from "./spots";

export interface Pose { pos: V3; target: V3 }

/** The classroom's lesson camera (CameraController LESSON_POS, looking straight down -z), as in a lesson. */
export const LESSON: Pose = { pos: EYE, target: [0, 0, -3] };
/** Outside the room, looking in through its window (the V8.3 opening): where the tour starts. */
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

/** The four shots, in tour order: a tab per shot jumps the clock to its start. */
export const SHOTS = ["teacher", "board", "model", "desk"] as const;
export type Shot = (typeof SHOTS)[number];

/**
 * The tour, in seconds of its clock. `shots`: where each shot starts (a tab seeks there). `lines`: his lines, each
 * a segment of the volcano lesson from its start to `until` (the end of its last sentence shown, from the
 * recording's timings), starting at `at`. `picture`: the cross-section is on the board; `model`: the model replaces
 * it; `point`: he points (from just before the line, so his finger is up for "this cross-section", to just after
 * that sentence); `quiz`: the quiz is on the desk.
 */
export const ROOM_T = {
  shots: [2.8, 7.6, 17.2, 24.4],
  lines: [
    { segment: "seg_003", at: 3.0, until: 4.44 },
    { segment: "seg_008", at: 8.8, until: 8.36 },
    { segment: "seg_009", at: 18.1, until: 6.0 },
  ],
  picture: [8.1, 17.5],
  model: 17.5,
  point: [8.4, 8.8 + 2.3],
  quiz: [24.4, 30.6],
  length: 32.2,
} as const;

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

/** The shot at tour time `t` (the last one whose start has passed; the first before it). */
export function shotAt(t: number): number {
  let i = 0;
  while (i + 1 < ROOM_T.shots.length && t >= ROOM_T.shots[i + 1]) i++;
  return i;
}

/** The line being spoken at `t`: its index and seconds into its segment, or null between lines. */
export function lineAt(t: number): { index: number; t: number } | null {
  for (let i = 0; i < ROOM_T.lines.length; i++) {
    const l = ROOM_T.lines[i];
    if (t >= l.at && t < l.at + l.until) return { index: i, t: t - l.at };
  }
  return null;
}

/**
 * The box aspect the room's camera is composed at, and its poster captured at. Wider boxes keep this one's
 * horizontal view and lose some top and bottom, as the poster does under `object-fit: cover`; narrower ones keep
 * the vertical view (the classroom's own 40 degrees) and lose some sides.
 */
export const ROOM_ASPECT = 16 / 9;
export const ROOM_FOV = 40;

/** The vertical field of view (degrees) for a box of `aspect`: the classroom's, or less to keep ROOM_ASPECT's width. */
export function roomFov(aspect: number): number {
  if (aspect <= ROOM_ASPECT) return ROOM_FOV;
  const half = Math.atan((Math.tan((ROOM_FOV * Math.PI) / 360) * ROOM_ASPECT) / aspect);
  return (half * 360) / Math.PI;
}

/** How far the reader may look around by dragging (radians from the tour's own direction). */
export const LOOK_YAW = 0.6;
export const LOOK_PITCH = 0.3;

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

/**
 * Where the picture is on the board: the picture section's place (scripts.ts PICTURE_PLACE: the board's, set back
 * 0.3 m and enlarged to look the same), so his pointing hand passes in front of it, as it does there.
 */
export const ROOM_PICTURE = PICTURE_PLACE;
/** A point on the picture, from its top-left corner in shares of its side (0 to 1, down). */
export function onPicture(u: number, v: number): V3 {
  const [x, y, z] = ROOM_PICTURE.position, s = ROOM_PICTURE.size;
  return [x + (u - 0.5) * s, y + (0.5 - v) * s, z];
}
/**
 * His finger's target on the cross-section (volcano-picture.webp): "this cross-section", its middle, where the vent
 * runs (51%, 50%). (The magma chamber, at 74% and below, is past what aim.ts may turn his arm to: tried in the eval,
 * the finger ended pointing at the empty rock beside the vent. So he points once, at the picture.)
 */
export const AIM_PICTURE = onPicture(0.51, 0.5);

/**
 * His left index fingertip at PresentModel's furthest reach in the room, in world space: read from his bones in the
 * running stage (`?probe`; eval scripts/room-peaks.cjs, session 3), not by eye. His head turns to the model, which
 * moves his arm a little with it, so this was measured with the model where it is placed from it.
 */
export const ROOM_PRESENT_TIP: V3 = [-0.01, 0.33, -2.67];

/**
 * The volcano's model (the lesson's own, demo_model_url) at the product's spawn scale (Experience FloatingModel,
 * 0.825), placed from that fingertip (Hmz's second hard requirement), as the heart is. The GLB is +-0.495 x 0.295 x
 * 0.5 local, turned 45 degrees in its own node, so at the product's start turn its base reaches `half` (0.424 m,
 * measured) to his side of its centre. That edge sits `gap` past his fingertip, level with its base: he offers it
 * from beside its foot, and never reaches into it.
 */
export const VOLCANO = (() => {
  const scale = 0.825;
  const half = 0.424;
  const height = 0.59 * scale;
  const gap = 0.02;
  const [ix, iy, iz] = ROOM_PRESENT_TIP;
  return { url: "/demo/volcano-eruption/model.glb", scale, half, height, gap, position: [ix + gap + half, iy - 0.03 + height / 2, iz - 0.02] as V3 };
})();

/** The look targets: the board (his pointing), the model, and the desk (the quiz), as the classroom's. */
export const ROOM_LOOK = { board: AIM_PICTURE, model: VOLCANO.position, desk: PAPER_ANCHOR } as const;

/** What the tour shows of the room's lesson at `t`. */
export function roomStateAt(t: number): { picture: boolean; model: boolean; quiz: boolean } {
  return {
    picture: t >= ROOM_T.picture[0] && t < ROOM_T.picture[1],
    model: t >= ROOM_T.model,
    quiz: t >= ROOM_T.quiz[0] && t < ROOM_T.quiz[1],
  };
}

/** The phase of each line, as the lesson has it (seg_003 explain; seg_008 and seg_009 demonstrate). */
const LINE_PHASE = ["explain", "demonstrate", "demonstrate"] as const;

/**
 * The director's signals at tour time `t`, as a lesson sends them: speaking a line in its phase (seg_003's explain
 * beat plays HoldIdea once); pointing while he points at the picture; the model shown (PresentModel's edge, and his
 * head turns to it); the quiz on the desk (he looks at it, as in a lesson).
 */
export function roomSignals(t: number, speaking: boolean): DirectorSignals {
  const s: DirectorSignals = { ...IDLE, isSpeaking: speaking };
  const line = lineAt(t);
  if (line) {
    s.phase = LINE_PHASE[line.index];
    s.segmentId = `room:${ROOM_T.lines[line.index].segment}`;
  }
  if (t >= ROOM_T.point[0] && t < ROOM_T.point[1]) s.gesture = "pointing";
  s.modelShown = roomStateAt(t).model;
  s.quizActive = roomStateAt(t).quiz;
  return s;
}

/** His finger's target at `t` while he points, else null. */
export function roomAimAt(t: number): V3 | null {
  return t >= ROOM_T.point[0] && t < ROOM_T.point[1] ? AIM_PICTURE : null;
}
