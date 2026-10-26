/**
 * sheetFraming: the quiz as one fixed sheet of paper lying on the student's desk, and the camera that looks at it.
 *
 * The sheet is a real object: 40 x 54 cm (A-paper proportions), centred on the desk top with about 3 cm to spare front
 * and back (the desk top is probed at x -0.46..0.47, z -0.82..-0.22, y -0.888). It never changes size: the question,
 * the answers, the result and Next all live on it, the result in a band that is reserved from the start. A
 * canvas of any shape gets the same sheet, and the camera comes in until the sheet fills the free area between the bars.
 *
 * The camera keeps today's view direction (DESK_POSE towards DESK_TARGET, 30 degrees off vertical, the clamp
 * AristoCanvas's OrbitControls applies), so only the distance and a vertical offset change. That is exact: the sheet is a rectangle
 * on the desk plane seen through a plain perspective camera, and its four corners are projected, not estimated.
 *
 * Text size: the sheet's CSS box is the world size divided by K (metres per CSS px). K starts at 0.001 (400 x 540 px) and
 * grows on a small canvas so that one CSS px stays at least MIN_UI_SCALE screen px; the page then holds less and its
 * middle scrolls. Controls are made tall enough in CSS px to measure TARGET_PX on screen despite the tilt.
 *
 * Pure: no React, no scene. Memoised per canvas size.
 */

import { Vector3 } from "three";
import { DESK_POSE, DESK_TARGET, TARGET_PX, camera, add, sub, mul, cross, unit, type V3 } from "./deskFraming";

export const SHEET_WIDTH_M = 0.40;
export const SHEET_DEPTH_M = 0.54;
/** The middle of the desk top (probed); the sheet's centre. */
export const SHEET_ANCHOR: V3 = [0, -0.878, -0.52];
/** Desk top extent, for the fit checks (probed, y -0.888). */
export const DESK_TOP = { x0: -0.46, x1: 0.47, z0: -0.82, z1: -0.22 } as const;

/** Metres per CSS px at the sheet's design size (400 x 540 px). */
const K_BASE = 0.001;
const K_MAX = 0.004;
/** The least on-screen px per CSS px the sheet is shown at: 15px text stays about 13px. */
export const MIN_UI_SCALE = 0.85;
export const CONTROL_MIN = 44;
export const CONTROL_MAX = 64;

export interface Insets { top: number; bottom: number; side: number }

/** Bars over the room: pills under the top edge, and the "quiz is on the desk" strip at the bottom. */
export function insetsFor(width: number, height: number): Insets {
  return height < 500 ? { top: 60, bottom: 56, side: 12 } : { top: 72, bottom: 80, side: 16 };
}

export interface SheetFraming {
  pos: Vector3;
  target: Vector3;
  /** The sheet's CSS box. */
  cardWidth: number;
  cardHeight: number;
  /** drei's distanceFactor for that box: world size = CSS size * distanceFactor / 400. */
  distanceFactor: number;
  /** min-height of every control on the sheet, in CSS px, so it measures TARGET_PX on screen. */
  controlHeight: number;
  /** On-screen px per CSS px across the sheet. */
  uiScale: number;
}

const L0 = Math.hypot(...sub([DESK_TARGET.x, DESK_TARGET.y, DESK_TARGET.z], DESK_POSE));
const DIR = unit(sub([DESK_TARGET.x, DESK_TARGET.y, DESK_TARGET.z], DESK_POSE));
const RIGHT = unit(cross(DIR, [0, 1, 0]));
const UP = cross(RIGHT, DIR);

function poseAt(dist: number, delta: number): { pos: V3; target: V3 } {
  const pos = add(sub(SHEET_ANCHOR, mul(DIR, dist)), mul(UP, delta));
  return { pos, target: add(pos, mul(DIR, L0)) };
}

/** The sheet's projected box (near edge widest) and the depth of its nearest corner. */
export function projectSheet(
  width: number, height: number, dist: number, delta: number, fovDeg: number,
  w = SHEET_WIDTH_M, d = SHEET_DEPTH_M,
) {
  const { pos, target } = poseAt(dist, delta);
  const P = camera(pos, target, width, height, fovDeg);
  const [ax, ay, az] = SHEET_ANCHOR;
  const nl = P([ax - w / 2, ay, az + d / 2]), nr = P([ax + w / 2, ay, az + d / 2]);
  const fl = P([ax - w / 2, ay, az - d / 2]), fr = P([ax + w / 2, ay, az - d / 2]);
  const c = P(SHEET_ANCHOR);
  return {
    left: Math.min(nl[0], fl[0]), right: Math.max(nr[0], fr[0]),
    top: Math.min(fl[1], fr[1]), bottom: Math.max(nl[1], nr[1]),
    nearDepth: Math.min(nl[2], nr[2]), depth: c[2], P,
  };
}

const cache = new Map<string, SheetFraming>();

export function sheetFraming(width: number, height: number, fovDeg = 40, insets?: Insets): SheetFraming {
  if (!(width > 0 && height > 0)) return sheetFraming(1440, 900, fovDeg);
  const W = Math.round(width), H = Math.round(height);
  const ins = insets ?? insetsFor(W, H);
  const key = `${W}x${H}@${fovDeg}/${ins.top},${ins.bottom},${ins.side}`;
  const hit = cache.get(key);
  if (hit) return hit;
  if (cache.size >= 64) cache.clear();
  const out = solve(W, H, fovDeg, ins);
  cache.set(key, out);
  return out;
}

function solve(W: number, H: number, fov: number, ins: Insets): SheetFraming {
  const maxW = W - 2 * ins.side;
  const maxH = H - ins.top - ins.bottom;
  const yc = ins.top + maxH / 2;
  const t = Math.tan((fov * Math.PI) / 360);
  // Slide the camera up or down its view plane until the sheet sits in the middle of the free area.
  const centre = (dist: number) => {
    let delta = 0;
    for (let i = 0; i < 4; i++) {
      const b = projectSheet(W, H, dist, delta, fov);
      delta += (yc - (b.top + b.bottom) / 2) * ((2 * b.depth * t) / H);
    }
    return delta;
  };
  const fits = (dist: number) => {
    const b = projectSheet(W, H, dist, centre(dist), fov);
    return b.nearDepth > 0.05 && b.right - b.left <= maxW && b.bottom - b.top <= maxH;
  };
  // The nearest camera that still shows the whole sheet.
  let lo = 0.25, hi = 12;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (fits(m)) hi = m; else lo = m;
  }
  const dist = hi;
  const delta = centre(dist);

  const b = projectSheet(W, H, dist, delta, fov);
  const [ax, ay, az] = SHEET_ANCHOR;
  const sx = Math.abs(b.P([ax + 0.1, ay, az])[0] - b.P([ax - 0.1, ay, az])[0]) / 0.2;   // screen px per metre across
  const sz = Math.abs(b.P([ax, ay, az + 0.1])[1] - b.P([ax, ay, az - 0.1])[1]) / 0.2;   // and along the desk (tilted)

  const k = Math.min(K_MAX, Math.max(K_BASE, MIN_UI_SCALE / sx));
  const cardWidth = Math.round(SHEET_WIDTH_M / k);
  const cardHeight = Math.round(SHEET_DEPTH_M / k);
  const kExact = SHEET_WIDTH_M / cardWidth;
  const { pos, target } = poseAt(dist, delta);
  return {
    pos: new Vector3(...pos), target: new Vector3(...target),
    cardWidth, cardHeight,
    distanceFactor: 400 * kExact,
    controlHeight: Math.min(CONTROL_MAX, Math.max(CONTROL_MIN, Math.ceil(TARGET_PX / (kExact * sz)))),
    uiScale: kExact * sx,
  };
}
