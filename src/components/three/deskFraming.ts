/**
 * deskFraming — where the camera sits, and how wide the paper is, while the quiz is on the desk.
 *
 * The canvas has a fixed vertical FOV, so the paper's width on screen scales with the viewport HEIGHT. On a
 * landscape screen the paper fits; on a phone it is about twice the viewport wide. This module returns, for a
 * canvas size, the desk pose and the card box:
 *
 *   • When today's pose already shows the whole card, it returns today's constants (the same objects), so every
 *     such framing is exactly what it was.
 *   • Otherwise it slides the camera along today's view ray (same shot, the student sitting further back or
 *     leaning in) and narrows the card until the card fits the width. The view direction never changes.
 *   • Either way it says how tall the controls on the paper must be in CSS px (44 where that already projects to
 *     44px on screen, up to 52 where the tilt shrinks them), and on a portrait canvas it narrows the card until
 *     the first control reaches 44px, as far as a 200px card allows (best effort below about 330px wide).
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

/** The controls in QuizView are at least this tall in CSS px on their own. */
export const DESK_CONTROL_MIN = 44;
/** The tallest a desk control is made in CSS px, where the tilt shrinks 44 below 44px on screen. */
export const DESK_CONTROL_MAX = 52;
/** WCAG 2.5.5 target size, in on-screen px. */
export const TARGET_PX = 44;

// ─── Fit rules ───────────────────────────────────────────────────────────────────────────────────────────────

const SIDE_MARGIN = 16;   // px kept clear left and right of the card
const TOP_INSET   = 72;   // px under the top bar pills (52px pill at 12px)
const BOTTOM_INSET = 80;  // px above the "quiz is on the desk" strip
// The card height the fit is designed for. A real card is 330 to 450px; it scrolls inside beyond maxHeight.
const DESIGN_HEIGHT = 450;
// The card height the control size is judged at, and where the first control starts (measured down from the card's
// top edge: padding, header, question). With 331 and 100 the model reproduces the measured heights of 44px controls
// (45, 42, 63 and 53px at 1024x768, 1280x720, 1920x1080 and 1440x900) to within half a pixel.
const CONTROL_REF_HEIGHT = 380;
const FIRST_CONTROL_TOP = 100;
const MIN_CARD_WIDTH = 200;
const MIN_MAX_HEIGHT = 260;
// Below this a LANDSCAPE canvas has too little vertical room between the bars for a card worth reading (a landscape
// phone): keep today's framing there instead of a strip that is all scroll. Recorded as a known gap. A portrait
// canvas always gets the narrowed card, however short: a scrolling card beats a cropped one.
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
  /** On-screen height of the first control on a card of this height, for a control of `controlCss` CSS px. */
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
  controlCss = DESK_CONTROL_MAX,
): CardProjection {
  const P = camera(pose.pos, pose.target, width, height, fovDeg);
  const [ax, ay, az] = PAPER_ANCHOR;
  const a = (cardWidth * K) / 2, d = (cardHeight * K) / 2;
  const nl = P([ax - a, ay, az + d]), nr = P([ax + a, ay, az + d]), far = P([ax - a, ay, az - d]);
  const z0 = az + (FIRST_CONTROL_TOP - cardHeight / 2) * K;
  const control = Math.abs(P([ax, ay, z0 + controlCss * K])[1] - P([ax, ay, z0])[1]);
  return { left: nl[0], right: nr[0], top: far[1], bottom: nl[1], control, nearDepth: nl[2] };
}

export interface DeskFraming {
  pos: Vector3;
  target: Vector3;
  /** The paper's CSS width. */
  cardWidth: number;
  /** The paper's CSS max-height (it scrolls inside beyond it). */
  maxHeight: number;
  /** The CSS height (min-height) of every control on the paper: 44 to 52, so that it measures 44px on screen. */
  controlHeight: number;
}

// Today, as rendered: the effective pose (see the note at the top), not the raw constant.
const TODAY_POSE: Pose = { pos: DESK_POSE, target: TARGET0 };
const TODAY: DeskFraming = {
  pos: DESK_POS, target: DESK_TARGET, cardWidth: PAPER_WIDTH, maxHeight: PAPER_MAX_HEIGHT, controlHeight: DESK_CONTROL_MIN,
};

const cache = new Map<string, DeskFraming>();

/**
 * The desk framing for a canvas of `width` x `height` CSS px. Landscape sizes get today's `DESK_POS` / `DESK_TARGET`
 * objects and a 520 x 620 card; a portrait or short canvas gets the camera slid along today's ray and a narrower card.
 * `controlHeight` is 44 unless the tilt makes 44 project below 44px on screen.
 */
export function deskFraming(width: number, height: number, fovDeg = 40): DeskFraming {
  if (!(width > 0 && height > 0)) return TODAY;
  const key = `${Math.round(width)}x${Math.round(height)}@${fovDeg}`;
  const hit = cache.get(key);
  if (hit) return hit;
  if (cache.size >= 64) cache.clear();
  const out = solve(Math.round(width), Math.round(height), fovDeg);
  cache.set(key, out);
  return out;
}

function solve(W: number, H: number, fov: number): DeskFraming {
  const maxW = W - 2 * SIDE_MARGIN;
  const fits = (p: CardProjection) =>
    p.nearDepth > 0.05 && p.right - p.left <= maxW + 0.5 && p.top >= TOP_INSET && p.bottom <= H - BOTTOM_INSET;
  const at = (pose: Pose, cw: number, h: number) => projectDeskCard(W, H, pose, cw, h, fov);

  // A control's size on screen is proportional to its CSS size, so from the first control at DESK_CONTROL_MAX the CSS
  // height that measures TARGET_PX follows. Above DESK_CONTROL_MAX the pose cannot reach 44px.
  const need = (pose: Pose, cw: number) =>
    Math.max(DESK_CONTROL_MIN, Math.ceil((TARGET_PX * DESK_CONTROL_MAX) / at(pose, cw, CONTROL_REF_HEIGHT).control));

  // 1. Today's pose, if it shows the whole card.
  const todayNeed = need(TODAY_POSE, PAPER_WIDTH);
  const todayFits = fits(at(TODAY_POSE, PAPER_WIDTH, DESIGN_HEIGHT));
  const today: DeskFraming = { ...TODAY, controlHeight: Math.min(todayNeed, DESK_CONTROL_MAX) };
  if (todayFits && todayNeed <= DESK_CONTROL_MAX) return today;

  // 2. The smallest pull-back that fits a card of this width, and what that does to the controls.
  const slideAt = (cw: number, f: number) => at(slide(f), cw, DESIGN_HEIGHT);
  const fitF = (cw: number) => {
    const near = slideAt(cw, F_MIN);
    if (near.right - near.left <= maxW) return F_MIN;
    let lo = F_MIN, hi = F_MAX;
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2;
      const p = slideAt(cw, m);
      if (p.right - p.left > maxW) lo = m; else hi = m;
    }
    return hi;
  };
  const reaches = (cw: number) => need(slide(fitF(cw)), cw) <= DESK_CONTROL_MAX;

  // The widest card (up to today's) whose first control still reaches 44px with controls of DESK_CONTROL_MAX. The
  // control only shrinks as the card widens, because a wider card needs a further camera. Where even the narrowest
  // card does not reach it (a canvas under about 330px wide) it is best effort.
  let cardWidth = PAPER_WIDTH;
  if (!reaches(cardWidth)) {
    let lo = MIN_CARD_WIDTH, hi = PAPER_WIDTH;
    for (let i = 0; i < 30; i++) {
      const m = (lo + hi) / 2;
      if (reaches(m)) lo = m; else hi = m;
    }
    cardWidth = Math.floor(lo);
  }
  const f = fitF(cardWidth);
  const pose = slide(f);

  // 3. The tallest the card may grow before it would leave the screen or touch the bars; it scrolls beyond that.
  const ok = (h: number) => fits(at(pose, cardWidth, h));
  let maxHeight = PAPER_MAX_HEIGHT;
  if (!ok(maxHeight)) {
    let lo = MIN_MAX_HEIGHT, hi = PAPER_MAX_HEIGHT;
    for (let i = 0; i < 30; i++) {
      const m = (lo + hi) / 2;
      if (ok(m)) lo = m; else hi = m;
    }
    maxHeight = Math.floor(lo);
  }
  if (W > H && maxHeight < USABLE_HEIGHT) return today;

  return {
    pos: new Vector3(...pose.pos), target: new Vector3(...pose.target), cardWidth, maxHeight,
    controlHeight: Math.min(need(pose, cardWidth), DESK_CONTROL_MAX),
  };
}
