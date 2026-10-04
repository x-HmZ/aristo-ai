/**
 * Step Into the Classroom (V8.3b, "Immersive"; the brain lesson since V8.3c): the product's own classroom, with the
 * chosen teacher teaching the brain demo lesson while the camera tours the room. Everything above on the page is here
 * at once, where the product puts it: the lesson's picture on the board, the model, and the quiz on your desk.
 *
 * The tour runs on the section's clock (play.ts, "room"), as four shots the reader can also jump to:
 *   1. Your teacher: the camera comes in from the back of the room to the seat, and he explains the idea (HoldIdea).
 *   2. The board: the lesson's labelled diagram lands and he points at it ("The top floor rooms are called lobes");
 *      as he goes on about it, the camera leans in to it, him and the whole picture still in view.
 *   3. The model: the picture becomes the 3D model (the lesson's own, real Tripo3D output); he presents it
 *      (PresentModel), his palm at its edge. It turns so its back comes round as he names the cerebellum and the
 *      brainstem, and their labels come in on it.
 *   4. Your desk: the camera looks down at the quiz on your desk, as a lesson ends, and comes back up to him.
 * His words are three of the lesson's own sentences, recorded in each teacher's voice (scripts/landing-voice.mjs) and
 * played at their real pace (sound.ts), silent unless Hear it is on.
 *
 * The camera's poses are in roomCamera.ts, which only the lazy stage imports: this module is the section's too.
 *
 * Pure: no DOM, no three.js. Unit-tested.
 */
import type { DirectorSignals } from "@/lib/avatar/director";
import type { LandingTeacher } from "../teacher";
import { IDLE, PICTURE_PLACE } from "./scripts";
import type { V3 } from "./spots";


/** The four shots, in tour order: a tab per shot jumps the clock to its start. */
export const SHOTS = ["teacher", "board", "model", "desk"] as const;
export type Shot = (typeof SHOTS)[number];

/**
 * The tour, in seconds of its clock. `shots`: where each shot starts (a tab seeks there). `lines`: his lines, each a
 * sentence of the brain lesson (`from` its segment; content.test.ts pins them verbatim), starting at `at` and lasting
 * as long as the teacher's own recording (LINE_LENGTH). `picture`: the diagram is on the board; `model`: the model
 * replaces it; `point`: he points (from just before the line, so his finger is up for "lobes", to just after that
 * phrase); `quiz`: the quiz is on the desk.
 */
export const ROOM_T = {
  shots: [2.8, 7.6, 17.2, 24.4],
  lines: [
    { line: "line_1", from: "seg_003", at: 2.9 },
    { line: "line_2", from: "seg_003", at: 8.8 },
    { line: "line_3", from: "seg_004", at: 18.1 },
  ],
  picture: [8.1, 17.5],
  model: 17.5,
  point: [8.4, 8.8 + 2.3],
  quiz: [24.4, 30.6],
  length: 32.2,
} as const;

/**
 * Each line's length in each teacher's recording (seconds: the end of its last character in the `.align.json`
 * sidecar, plus a breath), so the caption, the mouth and Hear it all end with the voice.
 */
export const LINE_LENGTH: Record<LandingTeacher, readonly [number, number, number]> = {
  jake: [4.65, 6.93, 3.86],
  mj: [4.47, 6.46, 3.58],
};
export const lineUntil = (i: number, teacher: LandingTeacher): number => LINE_LENGTH[teacher][i];
/** A line's recording, as sound.ts names it: `<teacher>/line_<n>` under /landing/voice. */
export const voiceOf = (i: number, teacher: LandingTeacher): string => `${teacher}/${ROOM_T.lines[i].line}`;

/** The shot at tour time `t` (the last one whose start has passed; the first before it). */
export function shotAt(t: number): number {
  let i = 0;
  while (i + 1 < ROOM_T.shots.length && t >= ROOM_T.shots[i + 1]) i++;
  return i;
}

/** The line being spoken at `t` in the teacher's voice: its index and seconds into it, or null between lines. */
export function lineAt(t: number, teacher: LandingTeacher = "jake"): { index: number; t: number } | null {
  for (let i = 0; i < ROOM_T.lines.length; i++) {
    const l = ROOM_T.lines[i];
    if (t >= l.at && t < l.at + lineUntil(i, teacher)) return { index: i, t: t - l.at };
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


/**
 * Where the picture is on the board: the picture section's place (scripts.ts PICTURE_PLACE: the board's, set back
 * 0.3 m and enlarged to look the same), so his pointing hand passes in front of it, as it does there.
 */
export const ROOM_PICTURE = PICTURE_PLACE;
/** The lesson's board picture: its labelled diagram of the brain (the lesson's own NB Pro teaching image, resized). */
export const ROOM_PICTURE_URL = "/landing/brain-picture.webp";
/** A point on the picture, from its top-left corner in shares of its side (0 to 1, down). */
export function onPicture(u: number, v: number): V3 {
  const [x, y, z] = ROOM_PICTURE.position, s = ROOM_PICTURE.size;
  return [x + (u - 0.5) * s, y + (0.5 - v) * s, z];
}
/**
 * His finger's target on the diagram (brain-picture.webp): "the top floor rooms", the lobes, where they meet in the
 * middle of the cerebrum (50%, 46%). Kept near the middle of the picture, as on the volcano, within aim.ts's reach.
 */
export const AIM_PICTURE = onPicture(0.5, 0.46);

/**
 * The teacher's left index fingertip at PresentModel's furthest reach in the room, in world space: read from the bones
 * in the running stage (`?probe`; eval scripts/room-peaks.cjs), not by eye. The head turns to the model, which moves
 * the arm a little with it, so this is measured with the model where it is placed from it.
 */
export const ROOM_PRESENT_TIP: Record<LandingTeacher, V3> = {
  jake: [-0.01, 0.33, -2.67],
  mj: [-0.136, 0.278, -2.797],
};

/**
 * The brain's model (the lesson's own demo_model_url, resized for the landing as the heart is), placed from that
 * fingertip (Hmz's second hard requirement). The GLB is centred, +-0.497 x 0.454 x 0.5 local, its back (the
 * cerebellum) at -z. A brain has no foot to offer it from (the volcano's base was): it floats beside the open hand, its
 * middle a little above the fingertip, where it is widest, its near side `gap` past the fingertip. `half` is its
 * surface's reach to that side at that height, in any of its turns (read from the bones and the mesh: room-peaks.cjs).
 */
const MODEL_SCALE = 0.72;
export function roomModel(teacher: LandingTeacher) {
  const scale = MODEL_SCALE;
  // Measured per teacher: her head turns her arm a little further in as it follows the model.
  const half = teacher === "mj" ? 0.345 : 0.32;
  const height = 0.907 * scale;
  const lift = 0.06;
  const gap = 0.03;
  const [ix, iy, iz] = ROOM_PRESENT_TIP[teacher];
  return { url: "/landing/brain.glb", scale, half, height, lift, gap, position: [ix + gap + half, iy + lift, iz - 0.02] as V3 };
}

/**
 * The model's turn at tour time `t` (radians about y): slow, so it is seen to be a model you can turn, and timed so its
 * back comes round to the camera, a little to the far side, in the middle of "the cerebellum and the brainstem".
 */
export const TURN_RATE = 0.3;
export const BACK_AT = 20.2;
export const turnAt = (t: number): number => Math.PI + 0.45 + TURN_RATE * (t - BACK_AT);

/**
 * The picture becoming the model (V8.3c): from the model's cue, the diagram's drawn brain lifts off the board as
 * points that fly onto the real mesh, then the solid fades in and the points go. The model holds its turn until it is
 * built (\`modelTurnAt\`), so the points land where the solid then is.
 */
export const MODEL_BUILD = [17.5, 19.1] as const;
export const modelTurnAt = (t: number): number => turnAt(Math.max(t, MODEL_BUILD[1]));
/** Where the brain is drawn in the board picture (brain-picture.webp), in shares of its side: the points start there. */
export const PICTURE_BRAIN = { u0: 0.15, u1: 0.86, v0: 0.22, v1: 0.84 } as const;
/** The build's progress at \`t\`, 0 to 1. */
export const modelBuildAt = (t: number): number =>
  Math.min(1, Math.max(0, (t - MODEL_BUILD[0]) / (MODEL_BUILD[1] - MODEL_BUILD[0])));

/**
 * The parts named on the model (V8.3c): their places on the GLB (model units, read from its grey texels and placed by
 * eye on marked renders: eval scripts/brain-parts.mjs, markers.cjs), the way each faces, and when each comes in (seconds
 * into the third line, as its word is said). A label shows only while its part faces the camera. Only parts the model
 * shows the same from every side: Tripo3D guessed the lobes' colours on the sides it could not see, so no lobe is named.
 */
export const MODEL_LABELS = [
  { name: "Cerebellum", at: [0, -0.29, -0.31] as V3, facing: [0, -0.2, -1] as V3, from: 1.6 },
  { name: "Brainstem", at: [-0.03, -0.38, -0.13] as V3, facing: [0, -0.6, -0.8] as V3, from: 2.6 },
] as const;


/** What the tour shows of the room's lesson at `t`. */
export function roomStateAt(t: number): { picture: boolean; model: boolean; quiz: boolean } {
  return {
    picture: t >= ROOM_T.picture[0] && t < ROOM_T.picture[1],
    model: t >= ROOM_T.model,
    quiz: t >= ROOM_T.quiz[0] && t < ROOM_T.quiz[1],
  };
}

/** The phase of each line, as the lesson has it (seg_003 and seg_004 both explain). */
const LINE_PHASE = ["explain", "explain", "explain"] as const;

/**
 * The director's signals at tour time `t`, as a lesson sends them: speaking a line in its phase (the explain beat plays
 * HoldIdea once); pointing while he points at the picture; the model shown (PresentModel's edge, and his head turns to
 * it); the quiz on the desk (he looks at it, as in a lesson).
 */
export function roomSignals(t: number, speaking: boolean, teacher: LandingTeacher = "jake"): DirectorSignals {
  const s: DirectorSignals = { ...IDLE, isSpeaking: speaking };
  const line = lineAt(t, teacher);
  if (line) {
    s.phase = LINE_PHASE[line.index];
    s.segmentId = `room:${voiceOf(line.index, teacher)}`;
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
