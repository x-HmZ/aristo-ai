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

export type SpotId = "hero" | "idea" | "ideas" | "picture" | "model" | "moves" | "close";

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
export const SPOTS: Record<SpotId, SpotFraming> = {
  // The hero has him on the left, a little closer, with his reach to his left (screen right, towards the buttons)
  // kept in frame: his right arm at rest (-1.42, with a margin) to past his offering fingertip (PresentModel, 0.01).
  hero: { top: 1.02, bottom: -0.7, x: -1, fx: 0.26, need: [-1.5, 0.1] },
  // A Teacher of Your Own: him alone, centred, his hands in front of his chest (HoldIdea).
  idea: { top: 1.02, bottom: -0.98, x: -1, fx: 0.5, need: [-1.55, -0.45] },
  // The two volcano sections: him on the left and, to his left, the classroom board's own place (Experience
  // SCENE_*: centre 0.37, 0.18, the image 1.455 m square), where the product's pointing clips land. Fixed aspect
  // (BOARD_ASPECT), so the composition and the stills are the same at every width.
  ideas: { top: 1.02, bottom: -1.1, x: -1, fx: 0.2 },
  picture: { top: 1.02, bottom: -1.1, x: -1, fx: 0.2 },
  model: { top: 1.02, bottom: -1.1, x: -1, fx: 0.24 },
  // One Lesson, Five Moves: him alone, centred, with the widest of the five gestures kept in the box.
  moves: { top: 1.02, bottom: -0.98, x: -1, fx: 0.5, need: [-1.75, -0.25] },
  close: { top: 1.02, bottom: -0.98, x: -1, fx: 0.5 },
};

/** The volcano spots' box aspect (width / height): Jake and the board, -1.55 to 1.21 m across, 2.12 m high. */
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
