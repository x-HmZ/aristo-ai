import { describe, expect, it } from "vitest";
import { HEART, MODEL_T, PRESENT_PEAK, WAVE_AFTER_S, heartBox, heartBuildAt, signalsFor } from "./scripts";

const ctx = { liveFor: 0, t: 0, mayWave: true, speaking: false };

describe("signalsFor", () => {
  it("greets at the hero and the close once the teacher has been seen, if the cool-down allows", () => {
    for (const spot of ["hero", "close"] as const) {
      expect(signalsFor(spot, ctx).sceneReady).toBe(false);
      expect(signalsFor(spot, { ...ctx, liveFor: WAVE_AFTER_S }).sceneReady).toBe(true);
      expect(signalsFor(spot, { ...ctx, liveFor: 5, mayWave: false }).sceneReady).toBe(false);
    }
  });

  it("never greets at the model spot", () => {
    expect(signalsFor("model", { ...ctx, liveFor: 5, t: 5 }).sceneReady).toBe(false);
  });

  it("shows the model (PresentModel's edge) at its cue, and holds it", () => {
    expect(signalsFor("model", { ...ctx, t: MODEL_T.present - 0.01 }).modelShown).toBe(false);
    expect(signalsFor("model", { ...ctx, t: MODEL_T.present }).modelShown).toBe(true);
    expect(signalsFor("model", { ...ctx, t: MODEL_T.length }).modelShown).toBe(true);
  });

  it("passes speaking through", () => {
    expect(signalsFor("hero", { ...ctx, speaking: true }).isSpeaking).toBe(true);
  });
});

describe("the heart's placement from the hand", () => {
  it("puts its near edge just past the fingertip at the peak, not behind or through it", () => {
    const edge = HEART.position[0] - HEART.half;
    expect(edge - PRESENT_PEAK.index[0]).toBeGreaterThan(0);
    expect(edge - PRESENT_PEAK.index[0]).toBeLessThan(0.05);
  });
  it("has the open hand level with its lower third", () => {
    const bottom = HEART.position[1] - HEART.height / 2;
    const k = (PRESENT_PEAK.index[1] - bottom) / HEART.height;
    expect(k).toBeGreaterThan(0.25);
    expect(k).toBeLessThan(0.45);
  });
  it("keeps it inside the model spot's box, turning included", () => {
    const b = heartBox();
    expect(b.left).toBeGreaterThan(0);
    expect(b.top).toBeGreaterThan(0);
    expect(b.left + b.width).toBeLessThan(100);
    expect(b.top + b.height).toBeLessThan(100);
  });
  it("builds from the picture to the model over the section's clock", () => {
    expect(heartBuildAt(0)).toEqual({ build: 0, show: 0 });
    expect(heartBuildAt(MODEL_T.lift).build).toBe(0);
    expect(heartBuildAt(MODEL_T.built).build).toBe(1);
    expect(heartBuildAt(MODEL_T.present).show).toBe(1);
  });
});

describe("the hero's reactions", () => {
  it("offers 'your turn' once per hover of Try a lesson, as a new challenge segment", () => {
    const a = signalsFor("hero", { ...ctx, hover: "try", seq: 3 });
    expect(a.role).toBe("challenge_setup");
    expect(a.segmentId).toBe("hero:try:3");
    expect(signalsFor("hero", { ...ctx, hover: "try", seq: 4 }).segmentId).not.toBe(a.segmentId);
  });
  it("does nothing extra with no hover, and never outside the hero", () => {
    const s = signalsFor("hero", { ...ctx, hover: null, seq: 5 });
    expect(s.segmentId).toBeNull();
    expect(s.reaction).toBeNull();
    expect(signalsFor("close", { ...ctx, hover: "try", seq: 5 }).segmentId).toBeNull();
  });
});
