import { describe, expect, it } from "vitest";
import type { FaceHint } from "./animationManifest";
import {
  BLINK_CLOSE_S, BLINK_DOUBLE_CHANCE, BLINK_GAP_S, BLINK_OPEN_S, SMILE_REST, SMILE_SPEAKING,
  blinkShape, createBlinkState, smileTarget, stepBlink, stepSmile,
} from "./face";
import {
  DRIFT, GAZE_LIMITS, SACCADE_AMPLITUDE, SACCADE_GAP_S, THINK_AVERT,
  createGazeState, driftAt, eyeAim, gazeTarget, stepSaccade,
} from "./gaze";

const DEG = Math.PI / 180;
const HINTS: FaceHint[] = ["neutral", "smile", "warm", "thinking"];

describe("smile", () => {
  it("orders the expressions at rest: smile > warm > neutral > thinking", () => {
    expect(SMILE_REST.smile).toBeGreaterThan(SMILE_REST.warm);
    expect(SMILE_REST.warm).toBeGreaterThan(SMILE_REST.neutral);
    expect(SMILE_REST.neutral).toBeGreaterThan(SMILE_REST.thinking);
  });

  it.each(HINTS)("%s stays inside the rig's range and below its rest while speaking", (h) => {
    expect(SMILE_REST[h]).toBeGreaterThanOrEqual(0);
    expect(SMILE_REST[h]).toBeLessThanOrEqual(1);
    expect(SMILE_SPEAKING[h]).toBeLessThanOrEqual(SMILE_REST[h]);
    expect(SMILE_SPEAKING[h]).toBeLessThanOrEqual(0.25); // a wide smile fights the visemes
  });

  it("targets the speaking or the resting level", () => {
    expect(smileTarget("smile", false)).toBe(SMILE_REST.smile);
    expect(smileTarget("smile", true)).toBe(SMILE_SPEAKING.smile);
  });

  it("eases toward the target without overshoot", () => {
    let v = 0;
    let last = 0;
    for (let i = 0; i < 120; i++) {
      v = stepSmile(v, "smile", false, 1 / 60);
      expect(v).toBeGreaterThanOrEqual(last);
      expect(v).toBeLessThanOrEqual(SMILE_REST.smile + 1e-9);
      last = v;
    }
    expect(v).toBeGreaterThan(SMILE_REST.smile * 0.85);
  });

  it("gets out of the way faster than it comes in", () => {
    const down = stepSmile(0.6, "neutral", true, 0.1);       // toward 0
    const up   = stepSmile(0, "smile", false, 0.1);           // toward 0.6
    expect(0.6 - down).toBeGreaterThan(up);
  });

  it("is frame-rate independent", () => {
    let a = 0, b = 0;
    for (let i = 0; i < 60; i++) a = stepSmile(a, "smile", false, 1 / 60);
    for (let i = 0; i < 30; i++) b = stepSmile(b, "smile", false, 1 / 30);
    expect(a).toBeCloseTo(b, 6);
  });

  it("ignores a negative dt", () => {
    expect(stepSmile(0.3, "smile", false, -1)).toBe(0.3);
  });
});

describe("blink", () => {
  const total = BLINK_CLOSE_S + BLINK_OPEN_S;

  it.each([
    [-1, 0], [0, 0], [BLINK_CLOSE_S, 1], [total, 0], [total + 1, 0],
  ])("shape at %f s is %f", (t, want) => {
    expect(blinkShape(t)).toBeCloseTo(want, 6);
  });

  it("closes faster than it opens", () => {
    expect(blinkShape(BLINK_CLOSE_S / 2)).toBeCloseTo(0.5, 6);
    expect(blinkShape(BLINK_CLOSE_S + BLINK_OPEN_S / 2)).toBeCloseTo(0.5, 6);
    expect(BLINK_CLOSE_S).toBeLessThan(BLINK_OPEN_S);
  });

  it("first blink falls inside the gap window", () => {
    for (const r of [0, 0.5, 0.999]) {
      const s = createBlinkState(10, () => r);
      expect(s.at).toBeGreaterThanOrEqual(10 + BLINK_GAP_S.min);
      expect(s.at).toBeLessThanOrEqual(10 + BLINK_GAP_S.max);
    }
  });

  it("stays open until it is due, then closes and reopens", () => {
    let s = createBlinkState(0, () => 0.5);
    const due = s.at;
    expect(stepBlink(s, due - 0.01, () => 0.5).closure).toBe(0);
    const peak = stepBlink(s, due, () => 0.5);
    s = peak.state;
    expect(s.running).toBe(true);
    expect(stepBlink(s, due + BLINK_CLOSE_S, () => 0.5).closure).toBeCloseTo(1, 6);
    const done = stepBlink(s, due + BLINK_CLOSE_S + BLINK_OPEN_S + 0.001, () => 0.5);
    expect(done.closure).toBe(0);
    expect(done.state.running).toBe(false);
    expect(done.state.at).toBeGreaterThan(due + total);
  });

  it("a double blink comes back within a fraction of a second", () => {
    const rng = () => BLINK_DOUBLE_CHANCE / 2; // below the chance: doubles
    let s = createBlinkState(0, () => 0);
    const start = s.at;
    s = stepBlink(s, start, rng).state;
    expect(s.double).toBe(true);
    const end = start + total + 0.001;
    const after = stepBlink(s, end, rng).state;
    expect(after.at - end).toBeLessThan(0.3);
  });

  it("an ordinary blink waits the full gap", () => {
    let s = createBlinkState(0, () => 0);
    s = stepBlink(s, s.at, () => 0.99).state; // above the double chance
    expect(s.double).toBe(false);
    const end = s.at + total + 0.001;
    const after = stepBlink(s, end, () => 0).state;
    expect(after.at - end).toBeGreaterThanOrEqual(BLINK_GAP_S.min - 1e-9);
  });

  it("blinks at a human rate over a minute", () => {
    let s = createBlinkState(0, Math.random);
    let blinks = 0, wasShut = false;
    for (let t = 0; t < 60; t += 1 / 60) {
      const r = stepBlink(s, t, Math.random);
      s = r.state;
      if (r.closure > 0.5 && !wasShut) blinks++;
      wasShut = r.closure > 0.5;
    }
    expect(blinks).toBeGreaterThan(10);
    expect(blinks).toBeLessThan(45);
  });
});

describe("gaze", () => {
  const rng0 = () => 0;

  it("waits for the saccade, then holds a new offset inside the amplitude", () => {
    const s0 = createGazeState(0, rng0);
    expect(stepSaccade(s0, s0.nextAt - 0.01, () => 1)).toBe(s0);
    for (const r of [0, 0.25, 0.5, 0.75, 1]) {
      const s1 = stepSaccade(s0, s0.nextAt, () => r);
      expect(Math.abs(s1.hold.yaw)).toBeLessThanOrEqual(SACCADE_AMPLITUDE.yaw + 1e-9);
      expect(Math.abs(s1.hold.pitch)).toBeLessThanOrEqual(SACCADE_AMPLITUDE.pitch + 1e-9);
      expect(s1.nextAt - s0.nextAt).toBeGreaterThanOrEqual(SACCADE_GAP_S.min - 1e-9);
      expect(s1.nextAt - s0.nextAt).toBeLessThanOrEqual(SACCADE_GAP_S.max + 1e-9);
    }
  });

  it("keeps drift inside its amplitude at any time", () => {
    for (let t = 0; t < 600; t += 0.7) {
      const d = driftAt(t);
      expect(Math.abs(d.yaw)).toBeLessThanOrEqual(DRIFT.yaw + 1e-9);
      expect(Math.abs(d.pitch)).toBeLessThanOrEqual(DRIFT.pitch + 1e-9);
    }
  });

  it("aims at a target straight ahead, to the side, above and behind", () => {
    expect(eyeAim(null)).toBeNull();
    expect(eyeAim({ x: 0, y: 0, z: 1 })!.yaw).toBeCloseTo(0, 6);
    expect(eyeAim({ x: 1, y: 0, z: 1 })!.yaw).toBeCloseTo(45 * DEG, 6);
    expect(eyeAim({ x: 0, y: 1, z: 1 })!.pitch).toBeCloseTo(45 * DEG, 6);
    expect(eyeAim({ x: 0, y: 0, z: -1 })).toBeNull();
  });

  const still = createGazeState(0, rng0); // hold 0, side -1
  const at = (aim: ReturnType<typeof eyeAim>, w: number, thinking = false, t = 0) =>
    gazeTarget(aim, w, still, t, thinking);

  it("follows the target by its weight, inside the clamp", () => {
    const small = at({ yaw: 10 * DEG, pitch: 0 }, 0.9);
    expect(small.yaw - driftAt(0).yaw).toBeCloseTo(9 * DEG, 6);
    const big = at({ yaw: 80 * DEG, pitch: 60 * DEG }, 1);
    expect(big.yaw).toBeLessThanOrEqual(GAZE_LIMITS.yaw + 1e-9);
    expect(big.pitch).toBeLessThanOrEqual(GAZE_LIMITS.pitch + 1e-9);
    const neg = at({ yaw: -80 * DEG, pitch: -60 * DEG }, 1);
    expect(neg.yaw).toBeGreaterThanOrEqual(-GAZE_LIMITS.yaw - 1e-9);
  });

  it("with no target, or zero weight, only idles", () => {
    for (const g of [at(null, 0.9), at({ yaw: 30 * DEG, pitch: 0 }, 0)]) {
      expect(Math.abs(g.yaw)).toBeLessThanOrEqual(DRIFT.yaw + 1e-9);
      expect(Math.abs(g.pitch)).toBeLessThanOrEqual(DRIFT.pitch + 1e-9);
    }
  });

  it("thinking averts the gaze up and to the chosen side", () => {
    const g = at(null, 0, true);
    expect(g.pitch).toBeGreaterThan(THINK_AVERT.pitch * 0.9);
    expect(Math.sign(g.yaw)).toBe(still.side);
    const other = gazeTarget(null, 0, { ...still, side: 1 }, 0, true);
    expect(Math.sign(other.yaw)).toBe(1);
  });

  it("never exceeds the clamp even with every term stacked", () => {
    const s = { ...still, hold: { yaw: SACCADE_AMPLITUDE.yaw, pitch: SACCADE_AMPLITUDE.pitch }, side: 1 as const };
    const g = gazeTarget({ yaw: 1, pitch: 1 }, 1, s, 0, true);
    expect(g.yaw).toBeLessThanOrEqual(GAZE_LIMITS.yaw + 1e-9);
    expect(g.pitch).toBeLessThanOrEqual(GAZE_LIMITS.pitch + 1e-9);
  });
});
