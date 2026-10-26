import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { DESK_POSE, DESK_TARGET, MIN_POLAR_ANGLE, TARGET_PX } from "./deskFraming";
import {
  CONTROL_MAX, CONTROL_MIN, DESK_TOP, MIN_UI_SCALE, SHEET_ANCHOR, SHEET_DEPTH_M, SHEET_WIDTH_M,
  insetsFor, projectSheet, sheetFraming,
} from "./sheetFraming";

// Distance from the camera to the anchor along the view ray, recovered from the framing.
function distOf(pos: { x: number; y: number; z: number }) {
  return Math.hypot(pos.x - SHEET_ANCHOR[0], pos.y - SHEET_ANCHOR[1], pos.z - SHEET_ANCHOR[2]);
}

const SIZES: [number, number][] = [
  [1920, 1080], [1440, 900], [1280, 720], [1024, 768], [768, 1024],   // desktop, laptop, tablet
  [390, 844], [360, 780], [320, 568],                                  // phones, portrait
  [844, 390], [667, 375], [932, 430],                                  // phones, landscape
];

describe("the sheet on the desk", () => {
  it("lies fully on the desk top with at least 2 cm to spare on every side", () => {
    expect(SHEET_ANCHOR[0] - SHEET_WIDTH_M / 2).toBeGreaterThan(DESK_TOP.x0 + 0.02);
    expect(SHEET_ANCHOR[0] + SHEET_WIDTH_M / 2).toBeLessThan(DESK_TOP.x1 - 0.02);
    expect(SHEET_ANCHOR[2] - SHEET_DEPTH_M / 2).toBeGreaterThan(DESK_TOP.z0 + 0.02);
    expect(SHEET_ANCHOR[2] + SHEET_DEPTH_M / 2).toBeLessThan(DESK_TOP.z1 - 0.02);
  });
});

describe("sheetFraming", () => {
  it.each(SIZES)("%i x %i: the whole sheet is between the bars, centred", (W, H) => {
    const fr = sheetFraming(W, H);
    const ins = insetsFor(W, H);
    const dist = distOf(fr.pos);
    // Rebuild the projection from the returned pose: the camera is `dist` along the view ray from the anchor
    // (plus a slide in the view plane), so project with the returned position instead.
    const b = projectFrom(fr, W, H);
    expect(b.left).toBeGreaterThanOrEqual(ins.side - 1);
    expect(b.right).toBeLessThanOrEqual(W - ins.side + 1);
    expect(b.top).toBeGreaterThanOrEqual(ins.top - 1);
    expect(b.bottom).toBeLessThanOrEqual(H - ins.bottom + 1);
    expect(b.nearDepth).toBeGreaterThan(0.05);
    expect(dist).toBeGreaterThan(0.2);
    // centred in the free area
    const cy = (b.top + b.bottom) / 2, free = ins.top + (H - ins.top - ins.bottom) / 2;
    expect(Math.abs(cy - free)).toBeLessThan(2);
  });

  it.each(SIZES)("%i x %i: the sheet is as large as the free area allows", (W, H) => {
    const fr = sheetFraming(W, H);
    const ins = insetsFor(W, H);
    const b = projectFrom(fr, W, H);
    const fillsW = W - 2 * ins.side - (b.right - b.left) < 3;
    const fillsH = H - ins.top - ins.bottom - (b.bottom - b.top) < 3;
    expect(fillsW || fillsH).toBe(true);
  });

  it.each(SIZES)("%i x %i: the CSS box is the sheet's proportions and its scale is legible", (W, H) => {
    const fr = sheetFraming(W, H);
    expect(fr.cardWidth / fr.cardHeight).toBeCloseTo(SHEET_WIDTH_M / SHEET_DEPTH_M, 1);
    // one CSS px is distanceFactor / 400 metres: the box is the sheet's world size
    expect((fr.cardWidth * fr.distanceFactor) / 400).toBeCloseTo(SHEET_WIDTH_M, 3);
    expect((fr.cardHeight * fr.distanceFactor) / 400).toBeCloseTo(SHEET_DEPTH_M, 2);
    expect(fr.uiScale).toBeGreaterThanOrEqual(MIN_UI_SCALE - 0.02);
  });

  it("a roomy canvas keeps the design size (400 x 540 CSS px)", () => {
    const fr = sheetFraming(1440, 900);
    expect(fr.cardWidth).toBe(400);
    expect(fr.cardHeight).toBe(540);
  });

  it("a small canvas shrinks the page, never the text", () => {
    const small = sheetFraming(844, 390);
    expect(small.cardWidth).toBeLessThan(400);
    expect(small.uiScale).toBeGreaterThanOrEqual(MIN_UI_SCALE - 0.02);
  });

  it.each(SIZES)("%i x %i: controls measure 44px on screen or are at the cap", (W, H) => {
    const fr = sheetFraming(W, H);
    expect(fr.controlHeight).toBeGreaterThanOrEqual(CONTROL_MIN);
    expect(fr.controlHeight).toBeLessThanOrEqual(CONTROL_MAX);
    const b = projectFrom(fr, W, H);
    const k = (fr.distanceFactor / 400);
    const [ax, ay, az] = SHEET_ANCHOR;
    const sz = Math.abs(b.P([ax, ay, az + 0.1])[1] - b.P([ax, ay, az - 0.1])[1]) / 0.2;
    const onScreen = fr.controlHeight * k * sz;
    if (fr.controlHeight < CONTROL_MAX) expect(onScreen).toBeGreaterThanOrEqual(TARGET_PX - 0.6);
  });

  it("keeps today's view direction and the OrbitControls polar clamp", () => {
    for (const [W, H] of SIZES) {
      const fr = sheetFraming(W, H);
      const dir = fr.target.clone().sub(fr.pos).normalize();
      const today = DESK_TARGET.clone().sub(new Vector3(...DESK_POSE)).normalize();
      expect(dir.angleTo(today)).toBeLessThan(1e-6);
      const off = fr.pos.clone().sub(fr.target);
      expect(Math.acos(off.y / off.length())).toBeGreaterThanOrEqual(MIN_POLAR_ANGLE - 1e-6);
    }
  });

  it("is memoised and falls back for a zero-size canvas", () => {
    expect(sheetFraming(1440, 900)).toBe(sheetFraming(1440, 900));
    expect(sheetFraming(0, 0).cardWidth).toBeGreaterThan(0);
  });

  it("a nearer camera shows the sheet bigger", () => {
    const near = projectSheet(1920, 1080, 1, 0, 40), far = projectSheet(1920, 1080, 2, 0, 40);
    expect(near.right - near.left).toBeGreaterThan(far.right - far.left);
  });
});

import { camera } from "./deskFraming";
function projectFrom(fr: ReturnType<typeof sheetFraming>, W: number, H: number) {
  const P = camera([fr.pos.x, fr.pos.y, fr.pos.z], [fr.target.x, fr.target.y, fr.target.z], W, H, 40);
  const [ax, ay, az] = SHEET_ANCHOR;
  const w = SHEET_WIDTH_M, d = SHEET_DEPTH_M;
  const nl = P([ax - w / 2, ay, az + d / 2]), nr = P([ax + w / 2, ay, az + d / 2]);
  const fl = P([ax - w / 2, ay, az - d / 2]), fr2 = P([ax + w / 2, ay, az - d / 2]);
  return {
    left: Math.min(nl[0], fl[0]), right: Math.max(nr[0], fr2[0]),
    top: Math.min(fl[1], fr2[1]), bottom: Math.max(nl[1], nr[1]), nearDepth: Math.min(nl[2], nr[2]), P,
  };
}
