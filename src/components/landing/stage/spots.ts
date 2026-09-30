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

export type SpotId = "hero" | "model" | "close";

export interface SpotFraming {
  /** World y at the teacher's plane shown at the box's top and bottom edges. */
  top: number;
  bottom: number;
  /** A world x at the teacher's plane, and where across the box it sits (0 = left edge, 1 = right edge). */
  x: number;
  fx: number;
}

/**
 * Jake is 2.57 m in world units (standScale 1.3824 x 1.859): feet at -1.7, the top of his head at about 0.87.
 * Each spot shows him from above the head to about the knee; the box's CSS mask fades him out below mid-thigh.
 */
export const SPOTS: Record<SpotId, SpotFraming> = {
  hero: { top: 1.02, bottom: -0.98, x: -1, fx: 0.44 },
  model: { top: 1.02, bottom: -1.1, x: -1, fx: 0.24 },
  close: { top: 1.02, bottom: -0.98, x: -1, fx: 0.5 },
};

/** A frustum as tangents at unit distance from the eye (multiply by `near` for three's makePerspective). */
export interface Frustum { left: number; right: number; top: number; bottom: number }

/**
 * The off-axis frustum that shows a spot's rectangle in a box of the given aspect (width / height). The vertical
 * range is the spot's; the horizontal range follows from the aspect, placed so `x` sits at `fx` of the width.
 */
export function frustumFor(spot: SpotFraming, aspect: number): Frustum {
  const d = EYE[2] - PLANE_Z;
  const top = (spot.top - EYE[1]) / d;
  const bottom = (spot.bottom - EYE[1]) / d;
  const width = (top - bottom) * aspect;
  const left = (spot.x - EYE[0]) / d - spot.fx * width;
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
