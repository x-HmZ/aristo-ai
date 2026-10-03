import { describe, expect, it } from "vitest";
import { FINAL, cueIndex } from "./play";

describe("cueIndex", () => {
  const cues = [0, 0.9, 2.5];
  it("is -1 before the first cue and counts the cues passed", () => {
    expect(cueIndex(-0.1, cues)).toBe(-1);
    expect(cueIndex(0, cues)).toBe(0);
    expect(cueIndex(1, cues)).toBe(1);
    expect(cueIndex(2.5, cues)).toBe(2);
  });
  it("is the last cue at FINAL (reduced motion shows the end state)", () => {
    expect(cueIndex(FINAL, cues)).toBe(cues.length - 1);
  });
});
