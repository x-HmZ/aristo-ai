import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import {
  DESK_POS, DESK_POSE, DESK_TARGET, MIN_POLAR_ANGLE, PAPER_ANCHOR, PAPER_MAX_HEIGHT, PAPER_WIDTH,
  TARGET_PX, deskFraming, projectDeskCard,
} from "./deskFraming";

const poseOf = (fr: { pos: { toArray(): number[] }; target: { toArray(): number[] } }) => ({
  pos: fr.pos.toArray() as [number, number, number],
  target: fr.target.toArray() as [number, number, number],
});
const TODAY_POSE = {
  pos: DESK_POSE,
  target: [DESK_TARGET.x, DESK_TARGET.y, DESK_TARGET.z] as [number, number, number],
};

describe("the model against the browser", () => {
  // Card rects measured in headless Chromium on /dev/desk-quiz before any change (V8.4c code, the stub quiz, a
  // 520 x 331 card, sidebar hidden): the projected bounding box. The model uses the OrbitControls-clamped pose.
  const measured: [number, number, number, number, number, number][] = [
    // W, H, left, right, top, bottom
    [1024, 768, 154, 870, 222, 582],
    [1280, 720, 304, 976, 208, 546],
    [1920, 1080, 456, 1464, 312, 819],
    [360, 780, -184, 544, 226, 591],
  ];
  it.each(measured)("%ix%i", (W, H, left, right, top, bottom) => {
    const p = projectDeskCard(W, H, TODAY_POSE, PAPER_WIDTH, 331);
    expect(Math.abs(p.left - left)).toBeLessThan(1.5);
    expect(Math.abs(p.right - right)).toBeLessThan(1.5);
    expect(Math.abs(p.top - top)).toBeLessThan(1.5);
    expect(Math.abs(p.bottom - bottom)).toBeLessThan(1.5);
  });

  it("the effective desk pose is DESK_POS after the 30 degree polar clamp", () => {
    const off = [DESK_POSE[0] - DESK_TARGET.x, DESK_POSE[1] - DESK_TARGET.y, DESK_POSE[2] - DESK_TARGET.z];
    const polar = Math.acos(off[1] / Math.hypot(off[0], off[1], off[2]));
    expect(polar).toBeCloseTo(MIN_POLAR_ANGLE, 6);
    expect(MIN_POLAR_ANGLE).toBeCloseTo(Math.PI / 6, 12);
  });
});

describe("landscape and square canvases keep today's framing", () => {
  it.each([[1024, 768], [1280, 720], [1366, 768], [1440, 900], [1600, 900], [1920, 1080], [2560, 1440]])(
    "%ix%i returns the constants themselves",
    (W, H) => {
      const fr = deskFraming(W, H);
      expect(fr.pos).toBe(DESK_POS);
      expect(fr.target).toBe(DESK_TARGET);
      expect(fr.cardWidth).toBe(PAPER_WIDTH);
      expect(fr.maxHeight).toBe(PAPER_MAX_HEIGHT);
    },
  );
});

describe("portrait canvases fit the card and reach 44px", () => {
  const sizes: [number, number][] = [[360, 640], [360, 780], [390, 844], [412, 915], [430, 932], [768, 1024], [820, 1180], [834, 1194]];
  it.each(sizes)("%ix%i", (W, H) => {
    const fr = deskFraming(W, H);
    expect(fr.pos).not.toBe(DESK_POS);
    const p = projectDeskCard(W, H, poseOf(fr), fr.cardWidth, 450);
    // A typical card is inside the viewport with the side margin.
    expect(p.left).toBeGreaterThanOrEqual(15.5);
    expect(p.right).toBeLessThanOrEqual(W - 15.5);
    // The smallest control (52 CSS px tall) projects to at least 44px.
    expect(p.control).toBeGreaterThanOrEqual(TARGET_PX - 0.1);
    // The tallest allowed card fits too: inside the side margins, under the top bar, above the strip.
    const tall = projectDeskCard(W, H, poseOf(fr), fr.cardWidth, fr.maxHeight);
    expect(tall.top).toBeGreaterThanOrEqual(72 - 0.6);
    expect(tall.right - tall.left).toBeLessThanOrEqual(W - 32 + 0.6);
    expect(tall.bottom).toBeLessThanOrEqual(H - 80 + 0.6);
    expect(fr.cardWidth).toBeGreaterThanOrEqual(240);
    expect(fr.cardWidth).toBeLessThanOrEqual(PAPER_WIDTH);
    expect(fr.maxHeight).toBeGreaterThanOrEqual(260);
  });

  it("keeps today's view direction and stays on today's ray", () => {
    for (const [W, H] of sizes) {
      const fr = deskFraming(W, H);
      const look = fr.target.clone().sub(fr.pos).normalize();
      const today = DESK_TARGET.clone().sub(new Vector3(...DESK_POSE)).normalize();
      expect(look.distanceTo(today)).toBeLessThan(1e-9);
      // The paper anchor stays on the view line, so it is centred on screen.
      const toPaper = { x: PAPER_ANCHOR[0] - fr.pos.x, y: PAPER_ANCHOR[1] - fr.pos.y, z: PAPER_ANCHOR[2] - fr.pos.z };
      const len = Math.hypot(toPaper.x, toPaper.y, toPaper.z);
      expect(Math.abs(toPaper.y / len - look.y)).toBeLessThan(1e-3);
      expect(Math.abs(toPaper.z / len - look.z)).toBeLessThan(1e-3);
    }
  });

  it("the camera stays well inside the room", () => {
    for (const [W, H] of sizes) {
      const fr = deskFraming(W, H);
      expect(fr.pos.y).toBeLessThan(1.5);
      expect(fr.pos.z).toBeLessThan(0.5);
    }
  });

  it("is continuous: neighbouring widths give neighbouring cards and cameras", () => {
    for (let W = 330; W < 900; W += 6) {
      const a = deskFraming(W, 900), b = deskFraming(W + 1, 900);
      expect(Math.abs(a.cardWidth - b.cardWidth)).toBeLessThanOrEqual(8);
      expect(a.pos.distanceTo(b.pos)).toBeLessThan(0.05);
    }
  });

  it("keeps today's framing where no usable card fits (landscape phones, a known gap)", () => {
    for (const [W, H] of [[844, 390], [667, 375]]) expect(deskFraming(W, H).pos).toBe(DESK_POS);
  });

  it("ignores a degenerate canvas", () => {
    expect(deskFraming(0, 0).pos).toBe(DESK_POS);
  });
});

