import { describe, expect, it } from "vitest";
import { DEMO_TEACHERS, demoTeacherFrom } from "./demoTeacher";

describe("demoTeacherFrom", () => {
  it("offers only Jake until MJ has her own narration (a woman in a man's voice reads as a bug)", () => {
    expect(DEMO_TEACHERS).toEqual(["jake"]);
    expect(demoTeacherFrom("?teacher=mj", "jake")).toBe("jake");
  });

  it("takes an offered teacher from the query", () => {
    expect(demoTeacherFrom("?teacher=mj", "jake", ["jake", "mj"])).toBe("mj");
    expect(demoTeacherFrom("?teacher=jake", "jake")).toBe("jake");
  });

  it("falls back for anything else", () => {
    expect(demoTeacherFrom("", "jake")).toBe("jake");
    expect(demoTeacherFrom("?teacher=", "jake")).toBe("jake");
    expect(demoTeacherFrom("?teacher=ryan", "jake")).toBe("jake");
    expect(demoTeacherFrom("?teacher=custom", "jake")).toBe("jake");
    expect(demoTeacherFrom("?teacher=MJ", "jake")).toBe("jake");
    expect(demoTeacherFrom("?teacher=%3Cscript%3E", "jake")).toBe("jake");
  });
});
