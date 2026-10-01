/**
 * Step Into the Classroom (V8.3b, "Immersive"): the product's own classroom, with Jake teaching the volcano demo
 * lesson while the camera tours the room. Everything above on the page is here at once, where the product puts it:
 * the lesson's picture on the board, the model that picture becomes, and the quiz on your desk.
 *
 * The tour runs on the section's clock (play.ts, "room"), as four shots the reader can also jump to:
 *   1. Your teacher: the camera comes in from the back of the room to the seat, and he explains the idea (HoldIdea).
 *   2. The board: the cross-section lands and he points at it ("Take a look at this cross-section"); as he goes on
 *      about it, the camera leans in to it, him and the whole picture still in view.
 *   3. The model: the picture becomes the 3D model; he presents it (PresentModel), his palm at its edge.
 *   4. Your desk: the camera looks down at the quiz on your desk, as a lesson ends, and comes back up to him.
 * His words are the lesson's own lines, at their real pace (sound.ts), silent unless Hear it is on.
 *
 * The camera's poses are in roomCamera.ts, which only the lazy stage imports: this module is the section's too.
 *
 * Pure: no DOM, no three.js. Unit-tested.
 */
import type { DirectorSignals } from "@/lib/avatar/director";
import { IDLE, PICTURE_PLACE } from "./scripts";
import type { V3 } from "./spots";


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
