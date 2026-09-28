import { describe, expect, it } from "vitest";
import { LOOK_LIMITS, aimAngles, damp, lookOffset, yawPitchOf } from "@/lib/avatar/look";

const DEG = Math.PI / 180;

describe("yawPitchOf", () => {
  const cases: Array<[string, { x: number; y: number; z: number }, number, number]> = [
    ["straight ahead",  { x: 0, y: 0, z: 1 },  0,   0],
    ["to the right",    { x: 1, y: 0, z: 0 },  90,  0],
    ["45 deg left",     { x: -1, y: 0, z: 1 }, -45, 0],
    ["up",              { x: 0, y: 1, z: 1 },  0,   45],
    ["down, unnormalised", { x: 0, y: -2, z: 2 }, 0, -45],
  ];
  it.each(cases)("%s", (_name, dir, yaw, pitch) => {
    const r = yawPitchOf(dir);
    expect(r.yaw / DEG).toBeCloseTo(yaw, 5);
    expect(r.pitch / DEG).toBeCloseTo(pitch, 5);
  });
});

describe("aimAngles", () => {
  const cases: Array<[string, { x: number; y: number; z: number }, [number, number] | null]> = [
    ["inside the clamp: as is",     { x: Math.tan(20 * DEG), y: 0, z: 1 }, [20, 0]],
    ["just past it: at the limit",  { x: Math.tan(60 * DEG), y: 0, z: 1 }, [LOOK_LIMITS.yaw / DEG, 0]],
    ["pitch clamps too",            { x: 0, y: Math.tan(35 * DEG), z: 1 }, [0, LOOK_LIMITS.pitch / DEG]],
    ["behind the shoulder: let go", { x: 1, y: 0, z: -0.2 },               null],
    ["straight behind: let go",     { x: 0, y: 0, z: -1 },                 null],
  ];
  it.each(cases)("%s", (_name, dir, expected) => {
    const r = aimAngles(dir);
    if (expected === null) { expect(r).toBeNull(); return; }
    expect(r!.yaw / DEG).toBeCloseTo(expected[0], 3);
    expect(r!.pitch / DEG).toBeCloseTo(expected[1], 3);
  });
});

describe("lookOffset", () => {
  it("turns the given share of the way from the clip's aim", () => {
    expect(lookOffset({ yaw: 0.1, pitch: 0 }, { yaw: 0.5, pitch: 0.2 }, 0.5)).toEqual({ yaw: 0.2, pitch: 0.1 });
  });
  it("adds nothing without an aim or a weight", () => {
    expect(lookOffset({ yaw: 0.1, pitch: 0 }, null, 0.5)).toEqual({ yaw: 0, pitch: 0 });
    expect(lookOffset({ yaw: 0.1, pitch: 0 }, { yaw: 1, pitch: 1 }, 0)).toEqual({ yaw: 0, pitch: 0 });
  });
});

describe("damp", () => {
  it("is frame-rate independent", () => {
    let a = 0;
    for (let i = 0; i < 60; i++) a = damp(a, 1, 8, 1 / 60);
    let b = 0;
    for (let i = 0; i < 30; i++) b = damp(b, 1, 8, 1 / 30);
    expect(a).toBeCloseTo(b, 10);
  });
  it("does not move on a zero or negative step", () => {
    expect(damp(0.3, 1, 8, 0)).toBe(0.3);
    expect(damp(0.3, 1, 8, -1)).toBe(0.3);
  });
});
