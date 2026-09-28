import { describe, expect, it } from "vitest";
import { headBoneOf, maskTrackNames, skeletonMasks, trackNode, type BoneInfo } from "@/lib/avatar/skeletonMasks";

/** Builds a skeleton from "parent > child" chains; shared prefixes merge. */
function skeleton(...chains: string[][]): BoneInfo[] {
  const parent = new Map<string, string | null>();
  for (const chain of chains) {
    chain.forEach((name, i) => { if (!parent.has(name)) parent.set(name, i ? chain[i - 1] : null); });
  }
  return [...parent].map(([name, p]) => ({ name, parent: p }));
}

// The bones that matter, as the GLBs carry them (V9.2 inspection).
const CANINO = skeleton(
  ["CC_Base_BoneRoot", "CC_Base_Hip", "CC_Base_Waist", "CC_Base_Spine01", "CC_Base_Spine02", "CC_Base_NeckTwist01", "CC_Base_NeckTwist02", "CC_Base_Head"],
  ["CC_Base_Hip", "CC_Base_L_Thigh", "CC_Base_L_Calf", "CC_Base_L_Foot"],
  ["CC_Base_Spine02", "CC_Base_L_Clavicle", "CC_Base_L_Upperarm", "CC_Base_L_Forearm", "CC_Base_L_Hand"],
  ["CC_Base_Spine02", "CC_Base_R_Clavicle", "CC_Base_R_Upperarm"],
);
const AVATURN = skeleton(
  ["Hips", "Spine", "Spine1", "Spine2", "Neck", "Head", "LeftEye"],
  ["Hips", "LeftUpLeg", "LeftLeg", "LeftFoot"],
  ["Spine2", "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand"],
);

// MJ's export: numbered bones, "_scaleCompensation" wrappers, and "_0" mesh
// children that GLTFLoader also reports as bones (seen in /dev/free-model).
const MJ = skeleton(
  ["_rootJoint", "CC_Base_BoneRoot_01", "CC_Base_Hip_02_scaleCompensation", "CC_Base_Hip_02", "CC_Base_Waist_033",
   "CC_Base_Spine01_034_scaleCompensation", "CC_Base_Spine01_034", "CC_Base_Spine02_035_scaleCompensation", "CC_Base_Spine02_035",
   "CC_Base_NeckTwist01_036", "CC_Base_NeckTwist02_037_scaleCompensation", "CC_Base_NeckTwist02_037",
   "CC_Base_Head_038_scaleCompensation", "CC_Base_Head_038", "CC_Base_Head_038_0"],
  ["CC_Base_Hip_02", "CC_Base_Pelvis_03", "CC_Base_L_Thigh_04_scaleCompensation", "CC_Base_L_Thigh_04"],
  ["CC_Base_Spine02_035", "CC_Base_L_Clavicle_049", "CC_Base_L_Upperarm_050"],
);

describe("MJ's numbered bones", () => {
  it("finds the head and both masks", () => {
    expect(headBoneOf(MJ)).toBe("CC_Base_Head_038");
    const masks = skeletonMasks(MJ);
    expect(masks.upper).toContain("CC_Base_Spine01_034");
    expect(masks.upper).toContain("CC_Base_L_Upperarm_050");
    expect(masks.upper).not.toContain("CC_Base_Waist_033");
    expect(masks.upper).not.toContain("CC_Base_L_Thigh_04");
    expect(masks.head).toContain("CC_Base_Head_038");
    expect(masks.head).not.toContain("CC_Base_L_Clavicle_049");
  });
});

describe("skeletonMasks", () => {
  const cases: Array<[string, BoneInfo[], string[], string[], string[]]> = [
    ["Canino rigs", CANINO,
      ["CC_Base_Spine01", "CC_Base_Spine02", "CC_Base_L_Clavicle", "CC_Base_L_Hand", "CC_Base_R_Upperarm", "CC_Base_Head"],
      ["CC_Base_Hip", "CC_Base_Waist", "CC_Base_L_Thigh", "CC_Base_L_Foot", "CC_Base_BoneRoot"],
      ["CC_Base_NeckTwist01", "CC_Base_NeckTwist02", "CC_Base_Head"]],
    ["Avaturn rig and custom teachers", AVATURN,
      ["Spine1", "Spine2", "LeftShoulder", "LeftHand", "Neck", "Head", "LeftEye"],
      ["Hips", "Spine", "LeftUpLeg", "LeftFoot"],
      ["Neck", "Head", "LeftEye"]],
  ];
  it.each(cases)("%s", (_name, bones, upperHas, upperLacks, head) => {
    const masks = skeletonMasks(bones);
    for (const b of upperHas) expect(masks.upper!.has(b)).toBe(true);
    for (const b of upperLacks) expect(masks.upper!.has(b)).toBe(false);
    expect([...masks.head!].sort()).toEqual([...head].sort());
  });

  it("finds no masks on a rig without a head under the hips", () => {
    expect(skeletonMasks(skeleton(["Root", "Body", "Arm"]))).toEqual({});
  });

  it("uses the head itself when there is no neck", () => {
    const masks = skeletonMasks(skeleton(["Hips", "Spine", "Chest", "Head", "Jaw"]));
    expect([...masks.head!].sort()).toEqual(["Head", "Jaw"]);
  });
});

describe("track helpers", () => {
  const cases: Array<[string, string]> = [
    ["CC_Base_Head.quaternion", "CC_Base_Head"],
    ["Hips.position", "Hips"],
    ["Spine", "Spine"],
  ];
  it.each(cases)("trackNode(%s) is %s", (track, node) => {
    expect(trackNode(track)).toBe(node);
  });

  it("keeps only the tracks of masked bones", () => {
    const tracks = ["Hips.position", "Hips.quaternion", "Neck.quaternion", "Head.quaternion", "LeftUpLeg.quaternion"];
    expect(maskTrackNames(tracks, new Set(["Neck", "Head"]))).toEqual(["Neck.quaternion", "Head.quaternion"]);
  });
});

describe("headBoneOf", () => {
  it("finds the head on each rig", () => {
    expect(headBoneOf(CANINO)).toBe("CC_Base_Head");
    expect(headBoneOf(AVATURN)).toBe("Head");
  });
  it("is null without a head under the hips", () => {
    expect(headBoneOf(skeleton(["Root", "Spine"]))).toBeNull();
    expect(headBoneOf([])).toBeNull();
  });
});
