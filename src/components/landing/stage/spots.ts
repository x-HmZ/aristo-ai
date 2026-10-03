/**
 * Where Jake stands on the landing (V8.3b, direction E): a "spot" is a box in a section that he presents from. One
 * canvas moves to whichever spot is most in view (host.ts), and its camera frames the spot as a crop of the
 * classroom's own lesson view.
 *
 * The camera never moves: it is the classroom's lesson camera (AristoCanvas: [0, 0, 0.9], looking straight down -z),
 * and Jake stands where the classroom puts him (Experience: [-1, -1.7, -3], turned 0.3). A spot only chooses which
 * rectangle of that view fills its box, as an off-axis frustum. So his proportions, the perspective and the light
 * are exactly the lesson's, at any box size (Hmz's first hard requirement, plan round 3).
 *
 * Pure: no DOM, no three.js. Unit-tested.
 */

export type V3 = readonly [number, number, number];

/** The classroom's lesson camera (AristoCanvas, CameraController LESSON_POS). */
export const EYE: V3 = [0, 0, 0.9];
/** Jake as the classroom places him (Experience SafeTeacher). */
export const TEACHER: { position: [number, number, number]; rotationY: number } = { position: [-1, -1.7, -3], rotationY: 0.3 };
/** The depth of the plane a spot's rectangle is measured on: the teacher's. */
export const PLANE_Z = TEACHER.position[2];

/** A box Jake presents from. "room" is Step Into the Classroom: the room itself, toured by its own camera (room.ts). */
export type SpotId = "hero" | "idea" | "picture" | "model" | "moves" | "remember" | "room" | "close";
/** The spots framed as a crop of the classroom's lesson view (all but the room). */
export type FramedSpotId = Exclude<SpotId, "room">;

export interface SpotFraming {
  /** World y at the teacher's plane shown at the box's top and bottom edges. */
  top: number;
  bottom: number;
  /** A world x at the teacher's plane, and where across the box it sits (0 = left edge, 1 = right edge). */
  x: number;
  fx: number;
  /**
   * A world x range at the teacher's plane that must stay in the box (a gesture's full reach). When the box is too
   * narrow for it at the spot's vertical range, the range grows downwards (the top stays, he gets smaller) until it
   * fits; when it is wide enough, the view slides so the range is inside.
   */
  need?: readonly [number, number];
}

/**
 * Jake is 2.57 m in world units (standScale 1.3824 x 1.859): feet at -1.7, the top of his head at about 0.87.
 * Each spot shows him from above the head to about the knee; the box's CSS mask fades him out below mid-thigh.
 */
export const SPOTS: Record<FramedSpotId, SpotFraming> = {
  // The hero has him on the left, a little closer, with his reach to his left (screen right, towards the buttons)
  // kept in frame: his right arm at rest (-1.42, its hand to about -1.47, with a margin) to past his offering
  // fingertip, aimed at the button (PresentModel: to about 0.1; measured 3 px from the edge with 0.1, so 0.22).
  hero: { top: 1.02, bottom: -0.7, x: -1, fx: 0.26, need: [-1.56, 0.22] },
  // A Teacher of Your Own: him alone, centred, his hands in front of his chest (HoldIdea).
  idea: { top: 1.02, bottom: -0.98, x: -1, fx: 0.5, need: [-1.55, -0.45] },
  // It Draws a Diagram: him on the left and, to his left, the classroom board's own place (Experience SCENE_*: centre
  // 0.37, 0.18, the image 1.455 m square), where the product's pointing clips land. Fixed aspect (BOARD_ASPECT), so
  // the composition and the stills are the same at every width. `need` keeps his right hand in the box with a margin
  // (eval bounds.cjs) and the picture's right edge (set back and enlarged, it reaches 1.18).
  picture: { top: 1.02, bottom: -1.1, x: -1, fx: 0.2, need: [-1.7, 1.24] },
  model: { top: 1.02, bottom: -1.1, x: -1, fx: 0.24 },
  // One Lesson, Five Moves: as the picture spot, him on the left and the classroom's display at the board's place,
  // where what each move's gesture makes in his hands is set down. `need` keeps Imagine's spread in the box (his right
  // fingertips reach -1.88; eval bounds.cjs) with the board's right edge (1.1): the view grows, he and the board are
  // drawn a little smaller, and nothing of him is cut off.
  moves: { top: 1.02, bottom: -1.1, x: -1, fx: 0.2, need: [-1.98, 1.16] },
  // It Remembers What You Know: as the picture spot, him on the left and, at the board's place, the paper card whose
  // review points he taps (PointNear, aimed).
  remember: { top: 1.02, bottom: -1.1, x: -1, fx: 0.2, need: [-1.7, 1.24] },
  // The close: as the hero, him on the left and Try a lesson to his left (screen right). `need` keeps his offered
  // fingertip (PresentModel towards the button, about 0.1) and either wave (the right hand reaches about -1.75) in the box.
  close: { top: 1.02, bottom: -0.98, x: -1, fx: 0.42, need: [-1.85, 0.2] },
};

/** The board spots' box aspect (width / height): Jake and the board, -1.55 to 1.21 m across, 2.12 m high. */
export const BOARD_ASPECT = 1.3;
/** The classroom board: its centre and the side of its square image (Experience SCENE_* and IMG_SIZE). */
export const BOARD = { center: [0.37, 0.18, -3] as V3, size: 1.455 } as const;

/** A frustum as tangents at unit distance from the eye (multiply by `near` for three's makePerspective). */
export interface Frustum { left: number; right: number; top: number; bottom: number }

/**
 * The off-axis frustum that shows a spot's rectangle in a box of the given aspect (width / height). The vertical
 * range is the spot's; the horizontal range follows from the aspect, placed so `x` sits at `fx` of the width, and
 * then kept around `need` (see SpotFraming).
 */
export function frustumFor(spot: SpotFraming, aspect: number): Frustum {
  const d = EYE[2] - PLANE_Z;
  const top = (spot.top - EYE[1]) / d;
  let bottom = (spot.bottom - EYE[1]) / d;
  let width = (top - bottom) * aspect;
  let left = (spot.x - EYE[0]) / d - spot.fx * width;
  if (spot.need) {
    const n0 = (spot.need[0] - EYE[0]) / d, n1 = (spot.need[1] - EYE[0]) / d;
    if (width < n1 - n0) {
      width = n1 - n0;
      bottom = top - width / aspect;
      left = n0;
    } else {
      left = Math.min(Math.max(left, n1 - width), n0);
    }
  }
  return { left, right: left + width, top, bottom };
}

/** The box aspect each spot's stills are captured at (eval scripts/stills.cjs): the fixed-aspect spots at theirs. */
export const CAPTURE_ASPECT: Record<FramedSpotId, number> = {
  hero: 1, idea: 1, picture: BOARD_ASPECT, model: 1.1, moves: BOARD_ASPECT, remember: BOARD_ASPECT, close: 1,
};

const n = (v: number) => +v.toFixed(4);

/**
 * Where a spot's still goes in its box, as CSS for `.landing-still-<id>`, so the still and the live canvas show every
 * world point at the same place in a box of any size: the poster and the first live frame are the same picture (Hmz).
 *
 * The still is the spot's view captured at CAPTURE_ASPECT; the canvas shows frustumFor(box aspect). Both are crops of
 * one view from one eye, so one is the other scaled and moved. In a box at least as wide as `need`, the vertical
 * range is the spot's own (the still is the box's height) and the horizontal placement follows frustumFor's clamp, in
 * container units. In a narrower box the range grows to fit `need` across the width (an @container aspect query).
 */
export function stillCss(id: FramedSpotId): string {
  const spot = SPOTS[id];
  const d = EYE[2] - PLANE_Z;
  const cap = frustumFor(spot, CAPTURE_ASPECT[id]);
  const capW = cap.right - cap.left, capV = cap.top - cap.bottom;
  const top = (spot.top - EYE[1]) / d, V = top - (spot.bottom - EYE[1]) / d;
  const x = (spot.x - EYE[0]) / d;
  const k = 100 / V; // tangent units to cqh, while the vertical range is the spot's own
  const sel = `.landing-still-${id}`;
  let left: string;
  if (spot.need) {
    const n0 = (spot.need[0] - EYE[0]) / d, n1 = (spot.need[1] - EYE[0]) / d;
    left = `calc(${n(cap.left * k)}cqh - clamp(${n(n1 * k)}cqh - 100cqw, ${n(x * k)}cqh - ${n(spot.fx * 100)}cqw, ${n(n0 * k)}cqh))`;
  } else {
    left = `calc(${n((cap.left - x) * k)}cqh + ${n(spot.fx * 100)}cqw)`;
  }
  let css = `${sel}{left:${left};top:${n((top - cap.top) * k)}cqh;width:${n(capW * k)}cqh;height:${n(capV * k)}cqh}`;
  if (spot.need) {
    const n0 = (spot.need[0] - EYE[0]) / d, needW = (spot.need[1] - spot.need[0]) / d;
    const kw = 100 / needW; // tangent units to cqw, once the width is the need's
    const ratio = Math.round((needW / V) * 1000);
    css += `@container (max-aspect-ratio: ${ratio}/1000){${sel}{left:${n((cap.left - n0) * kw)}cqw;top:${n((top - cap.top) * kw)}cqw;width:${n(capW * kw)}cqw;height:${n(capV * kw)}cqw}}`;
  }
  return css;
}

/** Where a world point lands in a spot's box, as fractions of its width and height (0,0 = top left). */
export function project(f: Frustum, p: V3): { u: number; v: number } {
  const d = EYE[2] - p[2];
  const x = (p[0] - EYE[0]) / d, y = (p[1] - EYE[1]) / d;
  return { u: (x - f.left) / (f.right - f.left), v: (f.top - y) / (f.top - f.bottom) };
}

/**
 * The spot the canvas should serve, from how much of each is in view (0 to 1). The current one is kept until another
 * shows clearly more of itself, so the canvas does not hop back and forth while two spots share the screen.
 */
export function pickSpot<T extends string>(ratios: Partial<Record<T, number>>, current: T | null, margin = 0.15): T | null {
  let best: T | null = null, bestR = 0;
  for (const [id, r] of Object.entries(ratios) as [T, number][]) if (r > bestR) { best = id; bestR = r; }
  if (!best) return current && (ratios[current] ?? 0) > 0 ? current : null;
  const cur = current ? ratios[current] ?? 0 : 0;
  if (current && cur > 0 && best !== current && bestR < cur + margin) return current;
  return best;
}
