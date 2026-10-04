import { describe, expect, it } from "vitest";
import { BEATS, COVER, FADE, HEADLINE_AT, LENGTH, LINKS, beatAt, brainTurn, morphAt, ramp } from "./timeline";
import { brain, constellation, fill, opaquePixels, orbs, rng } from "./targets";

describe("the opening's clock", () => {
  it("forms its five shapes one after another, each held before the next", () => {
    expect(BEATS.map((b) => b.shape)).toEqual(["mark", "question", "ideas", "brain", "teacher"]);
    for (let i = 1; i < BEATS.length; i++) expect(BEATS[i].from).toBeGreaterThan(BEATS[i - 1].to);
    for (const b of BEATS) expect(b.to).toBeGreaterThan(b.from);
  });

  it("lifts the cover only once the teacher has mostly formed, raises the headline under it, and ends after the fade", () => {
    const teacher = BEATS[4];
    expect(COVER[0]).toBeGreaterThan(teacher.from + (teacher.to - teacher.from) * 0.7);
    expect(HEADLINE_AT).toBeGreaterThan(COVER[0]);
    expect(HEADLINE_AT).toBeLessThan(COVER[1]);
    expect(FADE[1]).toBeLessThanOrEqual(LENGTH);
    expect(LINKS.out[0]).toBeGreaterThan(LINKS.in[1]);
  });

  it("stays under five and a half seconds (a pause control is required past five: it has Skip)", () => {
    expect(LENGTH).toBeLessThan(5.5);
  });

  it("finds the beat and its morph", () => {
    expect(beatAt(0)).toBe(-1);
    expect(beatAt(BEATS[2].from)).toBe(2);
    expect(morphAt(BEATS[1].from).k).toBe(0);
    expect(morphAt(BEATS[1].to).k).toBe(1);
    const mid = morphAt((BEATS[3].from + BEATS[3].to) / 2);
    expect(mid.beat).toBe(3);
    expect(mid.k).toBeCloseTo(0.5, 9);
    expect(ramp(1, [0, 2])).toBe(0.5);
    expect(brainTurn(BEATS[3].from + 1) - brainTurn(BEATS[3].from)).toBeCloseTo(0.6, 9);
  });
});

describe("the opening's shapes", () => {
  it("is the same for the same seed", () => {
    const a = rng(4), b = rng(4);
    for (let i = 0; i < 5; i++) expect(a()).toBe(b());
  });

  it("fills n points from fewer candidates, in their order", () => {
    const c = fill(10, 2, 1, 0, (i, p, col) => { p[0] = i; p[1] = 0; p[2] = 0; col[0] = i; col[1] = 0; col[2] = 0; });
    expect(c.pos.length).toBe(30);
    expect(c.pos[0]).toBe(0);
    expect(c.pos[27]).toBe(1);
    expect(c.order[0]).toBe(0);
    expect(c.order[9]).toBe(1);
  });

  it("reads a canvas's opaque pixels on a grid", () => {
    const data = new Uint8ClampedArray(4 * 4 * 4);
    data[(1 * 4 + 2) * 4 + 3] = 255;
    data[(2 * 4 + 2) * 4 + 3] = 255;
    const px = opaquePixels(data, 4, 4, 2);
    expect(px).toEqual([{ x: 2, y: 2, c: [0, 0, 0] }]);
  });

  it("links every idea to the centre and to its neighbour", () => {
    const { centres, links } = constellation(8, 400, 200, 5);
    expect(centres).toHaveLength(8);
    expect(centres[0]).toEqual([0, 0]);
    expect(links).toHaveLength(14);
    for (const [x, y] of centres.slice(1)) expect(Math.hypot(x / 400, y / 200)).toBeLessThanOrEqual(1.0001);
    const o = orbs(800, centres, 40, 2);
    expect(o.pos.length).toBe(2400);
  });

  it("draws a brain about its size, the front at +z, the stem below the cerebrum", () => {
    const c = brain(4000, 600, 21);
    let minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < 4000; i++) {
      minY = Math.min(minY, c.pos[i * 3 + 1]); maxY = Math.max(maxY, c.pos[i * 3 + 1]);
      minZ = Math.min(minZ, c.pos[i * 3 + 2]); maxZ = Math.max(maxZ, c.pos[i * 3 + 2]);
    }
    expect(maxZ - minZ).toBeGreaterThan(500);
    expect(maxZ - minZ).toBeLessThan(700);
    // y is down on screen: the stem reaches further below than the cerebrum reaches above.
    expect(maxY).toBeGreaterThan(-minY);
  });
});
