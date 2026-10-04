import { describe, expect, it } from "vitest";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import { applyOutfit, devShirt } from "./outfit";

function rig() {
  const shirt = new MeshStandardMaterial({ name: "lambert3SG", color: "#ffffff" });
  const skin = new MeshStandardMaterial({ name: "Std_Skin_Body", color: "#ffddcc" });
  const root = new Group();
  const a = new Mesh(new BoxGeometry(), shirt);
  const b = new Mesh(new BoxGeometry(), [skin, shirt]);
  const c = new Mesh(new BoxGeometry(), skin);
  root.add(a, b, c);
  return { root, shirt, skin, a, b, c };
}

describe("applyOutfit", () => {
  it("recolours a copy of the named material and leaves the original alone", () => {
    const { root, shirt, a } = rig();
    const clones = applyOutfit(root, { material: "lambert3SG", color: "#2F5D50" });
    expect(clones).toHaveLength(1);
    expect(a.material).toBe(clones[0]);
    expect(a.material).not.toBe(shirt);
    expect((clones[0] as MeshStandardMaterial).color.getHexString()).toBe("2f5d50");
    expect(shirt.color.getHexString()).toBe("ffffff");
  });

  it("shares one copy between the meshes that shared the material, inside material arrays too", () => {
    const { root, a, b } = rig();
    const [copy] = applyOutfit(root, { material: "lambert3SG", color: "#123456" });
    expect((b.material as MeshStandardMaterial[])[1]).toBe(copy);
    expect(a.material).toBe(copy);
  });

  it("does not touch the other materials", () => {
    const { root, skin, b, c } = rig();
    applyOutfit(root, { material: "lambert3SG", color: "#123456" });
    expect(c.material).toBe(skin);
    expect((b.material as MeshStandardMaterial[])[0]).toBe(skin);
  });

  it("returns nothing for a name it cannot find", () => {
    const { root } = rig();
    expect(applyOutfit(root, { material: "nope", color: "#123456" })).toEqual([]);
  });
});

describe("devShirt", () => {
  it("reads a six-digit hex outside production", () => {
    expect(devShirt("?shirt=2F5D50")).toBe("#2F5D50");
    expect(devShirt("?shirt=red")).toBeNull();
    expect(devShirt("?shirt=12345")).toBeNull();
    expect(devShirt("")).toBeNull();
    expect(devShirt(undefined)).toBeNull();
  });
});
