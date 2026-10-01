import { describe, expect, it } from "vitest";
import { Bone, Group, Vector3 } from "three";
import { createAim, raisedWeight } from "./aim";

describe("raisedWeight", () => {
  it("is 0 for a hanging arm and 1 for a level one, rising smoothly between", () => {
    expect(raisedWeight(-1)).toBe(0);
    expect(raisedWeight(-0.6)).toBe(0);
    expect(raisedWeight(-0.2)).toBe(1);
    expect(raisedWeight(0)).toBe(1);
    expect(raisedWeight(-0.4)).toBeCloseTo(0.5);
  });
});

/** A level arm along +x: shoulder at the origin, hand at 0.5, fingertip at 0.7. */
function arm() {
  const root = new Group();
  const shoulder = new Bone(); shoulder.name = "CC_Base_L_Upperarm";
  const hand = new Bone(); hand.name = "CC_Base_L_Hand"; hand.position.set(0.5, 0, 0);
  const tip = new Bone(); tip.name = "CC_Base_L_Index3"; tip.position.set(0.2, 0, 0);
  root.add(shoulder); shoulder.add(hand); hand.add(tip);
  root.updateMatrixWorld(true);
  return { root, shoulder, hand, tip };
}
const reachAngle = (a: ReturnType<typeof arm>, target: Vector3) => {
  a.root.updateMatrixWorld(true);
  const s = a.shoulder.getWorldPosition(new Vector3()), t = a.tip.getWorldPosition(new Vector3());
  return t.sub(s).angleTo(target.clone().sub(s)) * (180 / Math.PI);
};

describe("createAim", () => {
  const target = new Vector3(1, -0.2, 0); // about 11 degrees below the level arm
  it("turns a raised arm to the target once it has faded in", () => {
    const a = arm();
    const step = createAim(a.root);
    for (let i = 0; i < 60; i++) step(target, true, 1 / 60);
    expect(reachAngle(a, target)).toBeLessThan(1);
  });
  it("never compounds when the mixer does not rewrite the bones", () => {
    const a = arm();
    const step = createAim(a.root);
    for (let i = 0; i < 120; i++) step(target, true, 1 / 60);
    const once = a.shoulder.quaternion.clone();
    for (let i = 0; i < 60; i++) step(target, true, 1 / 60);
    expect(a.shoulder.quaternion.angleTo(once)).toBeLessThan(1e-6);
  });
  it("leaves the arm as posed when inactive, and gives it back after fading out", () => {
    const a = arm();
    const step = createAim(a.root);
    for (let i = 0; i < 60; i++) step(target, true, 1 / 60);
    for (let i = 0; i < 60; i++) step(target, false, 1 / 60);
    expect(reachAngle(a, new Vector3(1, 0, 0))).toBeLessThan(0.5);
  });
});
