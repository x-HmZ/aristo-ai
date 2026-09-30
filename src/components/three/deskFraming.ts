/**
 * deskFraming — where the camera sits, and how wide the paper is, while the quiz is on the desk.
 *
 * The canvas has a fixed vertical FOV, so the paper's width on screen scales with the viewport HEIGHT. On a
 * landscape screen the paper fits; on a phone it is about twice the viewport wide. This module returns, for a
 * canvas size, the desk pose and the card box:
 *
 *   • When today's pose already shows the whole card with controls of at least 44px, it returns today's
 *     constants (the same objects), so every landscape framing is exactly what it was.
 *   • Otherwise it slides the camera along today's view ray (same shot, the student sitting further back or
 *     leaning in) and narrows the card until the card fits the width and the smallest control on it projects to
 *     at least 44px. The view direction never changes.
 *
 * The maths is exact, not tuned: the paper is a rectangle on the desk plane (drei's `<Html transform>` puts
 * 1 CSS px at PAPER_DISTANCE_FACTOR / 400 world units) seen through a plain perspective camera. The probes in
 * `.claude/eval/2026-09-30-desk-framing/` match it to the pixel.
 *
 * One thing to know: AristoCanvas's OrbitControls clamps the polar angle to MIN_POLAR_ANGLE (30 degrees from
 * vertical) on every `update()`, and CameraController calls it each frame. DESK_POS / DESK_TARGET are 23.7
 * degrees, so the camera that actually renders sits on the 30 degree cone around DESK_TARGET. Everything here
 * works from that effective pose (`DESK_POSE`).
 *
 * Pure: no React, no three.js scene. Results are memoised per canvas size (one small solve per resize).
 */

import { Vector3 } from "three";

// ─── Desk constants (moved here unchanged from CameraController.tsx and DeskQuiz.tsx) ─────────────────────────

export const DESK_POS    = new Vector3(0,    0.2,  -0.05);
export const DESK_TARGET = new Vector3(0,   -1.05, -0.6);

// Centre of the student-desk surface (probed: y=-0.888), nudged 1 cm up to avoid z-fighting with the desktop.
export const PAPER_ANCHOR: [number, number, number] = [0, -0.878, -0.5];

// CSS-pixel to world scale for the transformed DOM: drei applies distanceFactor / 400 world units per px.
export const PAPER_DISTANCE_FACTOR = 0.55;

/** The paper box today: 520px wide, at most 620px tall (it scrolls inside beyond that). */
export const PAPER_WIDTH  = 520;
export const PAPER_MAX_HEIGHT = 620;

/** OrbitControls' minimum polar angle in AristoCanvas (radians from vertical). It clamps the desk pose. */
export const MIN_POLAR_ANGLE = Math.PI / 6;

/** The desk controls are this tall in CSS px (DeskQuiz sets `min-height`), so they project to 44 or more. */
export const DESK_CONTROL_HEIGHT = 52;
/** WCAG 2.5.5 target size, in on-screen px. */
export const TARGET_PX = 44;

// ─── Fit rules ───────────────────────────────────────────────────────────────────────────────────────────────

const SIDE_MARGIN = 16;   // px kept clear left and right of the card
const TOP_INSET   = 72;   // px under the top bar pills (52px pill at 12px)
const BOTTOM_INSET = 80;  // px above the "quiz is on the desk" strip
// The card height the fit is designed for. A real card is 330 to 450px; it scrolls inside beyond maxHeight.
const DESIGN_HEIGHT = 450;
// Where the first control starts, measured down from the card's top edge (padding, header, question).
const FIRST_CONTROL_TOP = 100;
const MIN_CARD_WIDTH = 240;
const MIN_MAX_HEIGHT = 260;
// Below this the vertical room between the bars is too small for a card worth reading (a landscape phone):
// keep today's framing there instead of a strip that is all scroll. Recorded as a known gap.
const USABLE_HEIGHT = 320;
// How far along today's ray the camera may go, as a multiple of today's distance to the paper.
const F_MIN = 0.5;
const F_MAX = 6;

const K = PAPER_DISTANCE_FACTOR / 400;

type V3 = [number, number, number];

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: V3): V3 => mul(a, 1 / Math.hypot(a[0], a[1], a[2]));

/** The offset from the target, with OrbitControls' polar clamp applied (azimuth is untouched). */
function clampPolar(offset: V3): V3 {
  const r = Math.hypot(offset[0], offset[1], offset[2]);
  if (Math.acos(offset[1] / r) >= MIN_POLAR_ANGLE) return offset;
  const az = Math.atan2(offset[0], offset[2]);
  const s = Math.sin(MIN_POLAR_ANGLE);
  return [r * s * Math.sin(az), r * Math.cos(MIN_POLAR_ANGLE), r * s * Math.cos(az)];
}

const TARGET0: V3 = [DESK_TARGET.x, DESK_TARGET.y, DESK_TARGET.z];
/** Where the desk camera really is: DESK_POS after OrbitControls' polar clamp. */
export const DESK_POSE: V3 = add(TARGET0, clampPolar(sub([DESK_POS.x, DESK_POS.y, DESK_POS.z], TARGET0)));

/** Screen projection through a plain perspective camera that looks from `pos` at `target` (up is +Y). */
function camera(pos: V3, target: V3, width: number, height: number, fovDeg: number) {
  const f = unit(sub(target, pos));
  const r = unit(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const t = Math.tan((fovDeg * Math.PI) / 360);
  const aspect = width / height;
  return (p: V3): V3 => {
    const d = sub(p, pos);
    const z = dot(d, f);
    return [((dot(d, r) / (z * t * aspect) + 1) / 2) * width, ((1 - dot(d, u) / (z * t)) / 2) * height, z];
  };
}

interface Pose { pos: V3; target: V3 }

/** Today's ray, slid so the camera is `f` times as far from the paper (f = 1 is today's pose). */
function slide(f: number): Pose {
  const pos = add(PAPER_ANCHOR, mul(sub(DESK_POSE, PAPER_ANCHOR), f));
  return { pos, target: add(TARGET0, sub(pos, DESK_POSE)) };
}

export interface CardProjection {
  left: number; right: number; top: number; bottom: number;
  /** On-screen height of the first 52px control on a card of this height. */
  control: number;
  /** Depth of the card's nearest corner in front of the camera (world units). */
  nearDepth: number;
}

/**
 * The card as seen from `pose` at a canvas size. `left` / `right` are the near (widest) edge, `top` the far edge.
 * `height` is the card's CSS height.
 */
export function projectDeskCard(
  width: number, height: number, pose: Pose, cardWidth: number, cardHeight: number, fovDeg = 40,
): CardProjection {
  const P = camera(pose.pos, pose.target, width, height, fovDeg);
  const [ax, ay, az] = PAPER_ANCHOR;
  const a = (cardWidth * K) / 2, d = (cardHeight * K) / 2;
  const nl = P([ax - a, ay, az + d]), nr = P([ax + a, ay, az + d]), far = P([ax - a, ay, az - d]);
  const z0 = az + (FIRST_CONTROL_TOP - cardHeight / 2) * K;
  const control = Math.abs(P([ax, ay, z0 + DESK_CONTROL_HEIGHT * K])[1] - P([ax, ay, z0])[1]);
  return { left: nl[0], right: nr[0], top: far[1], bottom: nl[1], control, nearDepth: nl[2] };
}

export interface DeskFraming {
  pos: Vector3;
  target: Vector3;
  /** The paper's CSS width. */
  cardWidth: number;
  /** The paper's CSS max-height (it scrolls inside beyond it). */
  maxHeight: number;
}

// Today, as rendered: the effective pose (see the note at the top), not the raw constant.
const TODAY_POSE: Pose = { pos: DESK_POSE, target: TARGET0 };
const TODAY: DeskFraming = { pos: DESK_POS, target: DESK_TARGET, cardWidth: PAPER_WIDTH, maxHeight: PAPER_MAX_HEIGHT };

const cache = new Map<string, DeskFraming>();

/**
 * The desk framing for a canvas of `width` x `height` CSS px. Landscape sizes get `TODAY` itself (the same
 * Vector3 objects); a portrait or short canvas gets the camera slid along today's ray and a narrower card.
 */
export function deskFraming(width: number, height: number, fovDeg = 40): DeskFraming {
  if (!(width > 0 && height > 0)) return TODAY;
  const key = `${Math.round(width)}x${Math.round(height)}@${fovDeg}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const out = solve(Math.round(width), Math.round(height), fovDeg);
  cache.set(key, out);
  return out;
}

function solve(W: number, H: number, fov: number): DeskFraming {
  const maxW = W - 2 * SIDE_MARGIN;
  const fits = (p: CardProjection) =>
    p.nearDepth > 0.05 && p.right - p.left <= maxW + 0.5 && p.top >= TOP_INSET && p.bottom <= H - BOTTOM_INSET;

  // 1. Today's pose, if it already works.
  const today = projectDeskCard(W, H, TODAY_POSE, PAPER_WIDTH, DESIGN_HEIGHT, fov);
  if (fits(today) && today.control >= TARGET_PX) return TODAY;

  // 2. The smallest pull-back that fits a card of this width, and what that does to the controls.
  const at = (cw: number, h: number, f: number) => projectDeskCard(W, H, slide(f), cw, h, fov);
  const fitF = (cw: number) => {
    if (at(cw, DESIGN_HEIGHT, F_MIN).right - at(cw, DESIGN_HEIGHT, F_MIN).left <= maxW) return F_MIN;
    let lo = F_MIN, hi = F_MAX;
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2;
      const p = at(cw, DESIGN_HEIGHT, m);
      if (p.right - p.left > maxW) lo = m; else hi = m;
    }
    return hi;
  };
  const control = (cw: number) => at(cw, DESIGN_HEIGHT, fitF(cw)).control;

  // The widest card (up to today's) whose smallest control is still 44px on screen. Control size only falls
  // as the card widens, because a wider card needs a further camera.
  let cardWidth = PAPER_WIDTH;
  if (control(cardWidth) < TARGET_PX) {
    let lo = MIN_CARD_WIDTH, hi = PAPER_WIDTH;
    for (let i = 0; i < 30; i++) {
      const m = (lo + hi) / 2;
      if (control(m) >= TARGET_PX) lo = m; else hi = m;
    }
    cardWidth = Math.floor(lo);
  }
  const f = fitF(cardWidth);
  const pose = slide(f);

  // 3. The tallest the card may grow before it would leave the screen or touch the bars; it scrolls beyond that.
  const ok = (h: number) => fits(projectDeskCard(W, H, pose, cardWidth, h, fov));
  let maxHeight = PAPER_MAX_HEIGHT;
  if (!ok(maxHeight)) {
    let lo = MIN_MAX_HEIGHT, hi = PAPER_MAX_HEIGHT;
    for (let i = 0; i < 30; i++) {
      const m = (lo + hi) / 2;
      if (ok(m)) lo = m; else hi = m;
    }
    maxHeight = Math.floor(lo);
  }

  if (maxHeight < USABLE_HEIGHT) return TODAY;

  return { pos: new Vector3(...pose.pos), target: new Vector3(...pose.target), cardWidth, maxHeight };
}
