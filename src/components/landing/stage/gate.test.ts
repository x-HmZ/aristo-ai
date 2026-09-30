import { describe, expect, it } from "vitest";
import { SLOW_SAMPLE_FRAMES, decideMode, isSlow, type GateEnv } from "./gate";

const desktop: GateEnv = { reducedMotion: false, webgl2: true, width: 1280, coarseOnly: false, saveData: false, deviceMemory: 8 };

describe("decideMode", () => {
  it("gives a capable desktop the live stage", () => {
    expect(decideMode(desktop)).toBe("full");
    expect(decideMode({ ...desktop, deviceMemory: undefined })).toBe("full");
    expect(decideMode({ ...desktop, width: 768 })).toBe("full");
  });
  it("stacks under reduced motion, whatever else is true", () => {
    expect(decideMode({ ...desktop, reducedMotion: true })).toBe("stack");
    expect(decideMode({ ...desktop, reducedMotion: true, forced: "full" })).toBe("stack");
  });
  it("sends phones, weak GPUs, Save-Data and low memory to lite", () => {
    expect(decideMode({ ...desktop, width: 390 })).toBe("lite");
    expect(decideMode({ ...desktop, coarseOnly: true })).toBe("lite");
    expect(decideMode({ ...desktop, webgl2: false })).toBe("lite");
    expect(decideMode({ ...desktop, saveData: true })).toBe("lite");
    expect(decideMode({ ...desktop, deviceMemory: 2 })).toBe("lite");
  });
  it("honours a forced mode, except full without WebGL2", () => {
    expect(decideMode({ ...desktop, forced: "lite" })).toBe("lite");
    expect(decideMode({ ...desktop, width: 390, forced: "full" })).toBe("full");
    expect(decideMode({ ...desktop, webgl2: false, forced: "full" })).toBe("lite");
  });
});

describe("isSlow", () => {
  it("waits for enough frames, then judges the 75th percentile", () => {
    expect(isSlow(Array(10).fill(60))).toBe(false);
    expect(isSlow(Array(SLOW_SAMPLE_FRAMES).fill(16.7))).toBe(false);
    expect(isSlow(Array(SLOW_SAMPLE_FRAMES).fill(33.3))).toBe(true);
    const mixed = [...Array(70).fill(16.7), ...Array(20).fill(40)];
    expect(isSlow(mixed)).toBe(false);
  });
});
