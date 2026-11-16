import { describe, expect, it } from "vitest";
import { DEFAULT_NEXT_PATH, safeNextPath } from "./safeNextPath";

const ORIGIN = "https://app.example";

describe("safeNextPath", () => {
  it("keeps a path on this origin, with its query and hash", () => {
    expect(safeNextPath("/learn", ORIGIN)).toBe("/learn");
    expect(safeNextPath("/admin/users?status=pending#top", ORIGIN)).toBe("/admin/users?status=pending#top");
  });

  it("falls back when next is missing or empty", () => {
    expect(safeNextPath(null, ORIGIN)).toBe(DEFAULT_NEXT_PATH);
    expect(safeNextPath(undefined, ORIGIN)).toBe(DEFAULT_NEXT_PATH);
    expect(safeNextPath("", ORIGIN)).toBe(DEFAULT_NEXT_PATH);
  });

  it("rejects values that would leave the origin", () => {
    for (const hostile of [
      "@evil.example",
      "//evil.example",
      "//evil.example/learn",
      "/\\evil.example",
      "\\\\evil.example",
      "https://evil.example/learn",
      ".evil.example",
      "javascript:alert(1)",
    ]) {
      expect(safeNextPath(hostile, ORIGIN)).toBe(DEFAULT_NEXT_PATH);
    }
  });

  it("never returns something that resolves to another origin", () => {
    for (const candidate of ["/learn", "/a/../b", "/%2F%2Fevil.example", "/learn?next=//evil.example"]) {
      const out = safeNextPath(candidate, ORIGIN);
      expect(new URL(out, ORIGIN).origin).toBe(ORIGIN);
      expect(out.startsWith("/")).toBe(true);
      expect(out.startsWith("//")).toBe(false);
    }
  });
});
