import { describe, expect, it } from "vitest";
import { Bone, Group } from "three";
import { boneOf } from "./bones";

const rig = (...names: string[]) => {
  const g = new Group();
  for (const n of names) { const b = new Bone(); b.name = n; g.add(b); }
  return g;
};

describe("boneOf", () => {
  it("finds Jake's plain names", () => {
    expect(boneOf(rig("CC_Base_L_Hand", "CC_Base_L_Index3"), "CC_Base_L_Hand")?.name).toBe("CC_Base_L_Hand");
  });
  it("finds MJ's suffixed names, never their scale-compensation twins", () => {
    const g = rig("CC_Base_L_Hand_055_scaleCompensation", "CC_Base_L_Hand_055", "CC_Base_L_Index3_067");
    expect(boneOf(g, "CC_Base_L_Hand")?.name).toBe("CC_Base_L_Hand_055");
    expect(boneOf(g, "CC_Base_L_Index3")?.name).toBe("CC_Base_L_Index3_067");
  });
  it("does not take a longer name for a shorter one", () => {
    expect(boneOf(rig("CC_Base_L_Index1_060"), "CC_Base_L_Index")).toBeUndefined();
    expect(boneOf(rig("CC_Base_L_UpperarmTwist01_071"), "CC_Base_L_Upperarm")).toBeUndefined();
  });
});
