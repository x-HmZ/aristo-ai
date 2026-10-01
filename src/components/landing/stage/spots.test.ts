import { describe, expect, it } from "vitest";
import { CAPTURE_ASPECT, EYE, SPOTS, TEACHER, frustumFor, pickSpot, project, stillCss, type FramedSpotId, type V3 } from "./spots";

describe("frustumFor", () => {
  it("shows the spot's vertical range edge to edge", () => {
    const f = frustumFor(SPOTS.close, 0.9);
    const d = EYE[2] - TEACHER.position[2];
    expect(f.top * d + EYE[1]).toBeCloseTo(SPOTS.close.top);
    expect(f.bottom * d + EYE[1]).toBeCloseTo(SPOTS.close.bottom);
  });

  it("puts the spot's x at fx of the width, whatever the aspect", () => {
    for (const aspect of [0.5, 0.9, 1.4, 2]) {
      const f = frustumFor(SPOTS.model, aspect);
      const p = project(f, [SPOTS.model.x, 0, TEACHER.position[2]]);
      expect(p.u).toBeCloseTo(SPOTS.model.fx);
    }
  });

  it("keeps the proportions: the width follows the aspect at the same scale as the height", () => {
    const f = frustumFor(SPOTS.close, 1.25);
    expect((f.right - f.left) / (f.top - f.bottom)).toBeCloseTo(1.25);
  });

  it("maps the top and bottom of the range to the box's top and bottom", () => {
    const f = frustumFor(SPOTS.close, 1);
    expect(project(f, [-1, SPOTS.close.top, TEACHER.position[2]]).v).toBeCloseTo(0);
    expect(project(f, [-1, SPOTS.close.bottom, TEACHER.position[2]]).v).toBeCloseTo(1);
  });

  it("frames Jake from above his head: to mid-thigh, or the upper thigh in the closer hero", () => {
    // Feet at -1.7, head top at about 0.87 (2.57 m); the belt at about -0.2, mid-thigh at about -0.75.
    for (const [id, s] of Object.entries(SPOTS)) {
      expect(s.top).toBeGreaterThan(0.9);
      expect(s.bottom).toBeLessThan(id === "hero" ? -0.6 : -0.75);
    }
  });
});

describe("pickSpot", () => {
  it("picks the spot most in view", () => {
    expect(pickSpot({ hero: 0.2, model: 0.8 }, null)).toBe("model");
  });
  it("keeps the current spot until another shows clearly more", () => {
    expect(pickSpot<FramedSpotId>({ hero: 0.5, model: 0.6 }, "hero")).toBe("hero");
    expect(pickSpot<FramedSpotId>({ hero: 0.4, model: 0.6 }, "hero")).toBe("model");
  });
  it("leaves a spot that has left the screen", () => {
    expect(pickSpot<FramedSpotId>({ hero: 0, model: 0.05 }, "hero")).toBe("model");
  });
  it("returns null when nothing is in view", () => {
    expect(pickSpot<FramedSpotId>({ hero: 0, model: 0 }, "hero")).toBeNull();
    expect(pickSpot({}, null)).toBeNull();
  });
});

describe("frustumFor with a reach to keep in frame", () => {
  const d = EYE[2] - TEACHER.position[2];
  const x = (t: number) => t * d + EYE[0];
  it("keeps the hero's whole reach in the box at every width it gets", () => {
    for (const aspect of [0.7, 0.75, 0.88, 1, 1.2]) {
      const f = frustumFor(SPOTS.hero, aspect);
      expect(x(f.left)).toBeLessThanOrEqual(SPOTS.hero.need![0] + 1e-9);
      expect(x(f.right)).toBeGreaterThanOrEqual(SPOTS.hero.need![1] - 1e-9);
      expect((f.right - f.left) / (f.top - f.bottom)).toBeCloseTo(aspect);
    }
  });
  it("keeps the top where the spot puts it when it has to grow", () => {
    const f = frustumFor(SPOTS.hero, 0.6);
    expect(f.top * d + EYE[1]).toBeCloseTo(SPOTS.hero.top);
    expect(f.bottom * d + EYE[1]).toBeLessThan(SPOTS.hero.bottom);
  });
});

describe("stillCss: the still and the canvas agree at any box size", () => {
  /** Evaluates the CSS for a box (container units, clamp, the @container branch) to px. */
  function rectOf(id: FramedSpotId, W: number, H: number) {
    const css = stillCss(id);
    const [base, narrow] = css.split("@container");
    let rule = base;
    if (narrow) {
      const [num, den] = narrow.match(/max-aspect-ratio: (\d+)\/(\d+)/)!.slice(1).map(Number);
      if (W / H <= num / den) rule = narrow;
    }
    const prop = (name: string) => {
      const expr = rule.match(new RegExp(`${name}:([^;}]+)`))![1]
        .replace(/(-?[\d.]+)cqh/g, `($1*${H}/100)`).replace(/(-?[\d.]+)cqw/g, `($1*${W}/100)`).replace(/100cqw/g, `${W}`);
      const clamp = (a: number, b: number, c: number) => Math.min(Math.max(b, a), c);
      const calc = (v: number) => v;
      return Function("clamp", "calc", `return ${expr}`)(clamp, calc) as number;
    };
    return { left: prop("left"), top: prop("top"), width: prop("width"), height: prop("height") };
  }

  const ids = Object.keys(SPOTS) as FramedSpotId[];
  const boxes: [number, number][] = [[300, 470], [413, 600], [464, 600], [530, 600], [600, 600], [707, 544], [618, 562], [360, 470]];
  it.each(ids)("%s: a world point lands on the same pixel in both", (id) => {
    const cap = frustumFor(SPOTS[id], CAPTURE_ASPECT[id]);
    for (const [W, H] of boxes) {
      const live = frustumFor(SPOTS[id], W / H);
      const r = rectOf(id, W, H);
      for (const p of [[-1, 0.5, -3], [-1.4, -0.3, -3], [-0.6, 0.8, -3], [0, 0, -3]] as V3[]) {
        const s = project(cap, p), b = project(live, p);
        expect(r.left + s.u * r.width).toBeCloseTo(b.u * W, 1);
        expect(r.top + s.v * r.height).toBeCloseTo(b.v * H, 1);
      }
    }
  });
});
