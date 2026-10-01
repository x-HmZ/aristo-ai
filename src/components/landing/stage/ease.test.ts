import { describe, expect, it } from "vitest";
import { damp, mix, seg, smooth } from "./ease";

describe("ease", () => {
  it("seg clamps to the span", () => {
    expect(seg(-1, 0, 1)).toBe(0);
    expect(seg(0.5, 0, 1)).toBe(0.5);
    expect(seg(2, 0, 1)).toBe(1);
  });
  it("smooth eases in and out, and mix blends", () => {
    expect(smooth(0)).toBe(0);
    expect(smooth(0.5)).toBe(0.5);
    expect(smooth(1)).toBe(1);
    expect(mix(2, 4, 0.25)).toBe(2.5);
  });
  it("damp approaches without overshoot and caps a long frame", () => {
    const v = damp(0, 1, 10, 0.016);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1);
    expect(damp(0, 1, 10, 5)).toBeCloseTo(damp(0, 1, 10, 0.1));
  });
});
