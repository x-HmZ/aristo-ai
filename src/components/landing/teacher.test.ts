import { describe, expect, it } from "vitest";
import { demoHref, isLandingTeacher, pickTeacher } from "./teacher";

describe("pickTeacher", () => {
  it("prefers the query, then the stored choice, then Jake", () => {
    expect(pickTeacher("mj", "jake")).toBe("mj");
    expect(pickTeacher(null, "mj")).toBe("mj");
    expect(pickTeacher(null, null)).toBe("jake");
  });

  it("ignores values that are not a landing teacher", () => {
    expect(pickTeacher("ryan", "mj")).toBe("mj");
    expect(pickTeacher("MJ", null)).toBe("jake");
    expect(pickTeacher("", "custom")).toBe("jake");
    expect(isLandingTeacher("custom")).toBe(false);
  });
});

describe("demoHref", () => {
  it("opens /demo with the chosen teacher", () => {
    expect(demoHref("jake")).toBe("/demo");
    expect(demoHref("mj")).toBe("/demo?teacher=mj");
  });
});
