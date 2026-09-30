import { describe, expect, it } from "vitest";
import { MODEL_T, WAVE_AFTER_S, signalsFor } from "./scripts";

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
