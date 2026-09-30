import { describe, expect, it } from "vitest";
import { lineAt, wordState } from "./lines";

describe("lineAt", () => {
  const lengths = [4, 6, 5];
  it("enters the round at the first line and hands over after its length plus the hold", () => {
    expect(lineAt(0, lengths, 1, 2)).toEqual({ index: 1, lineT: 0, start: 0 });
    expect(lineAt(7.9, lengths, 1, 2).index).toBe(1);
    expect(lineAt(8, lengths, 1, 2)).toEqual({ index: 2, lineT: 0, start: 8 });
    expect(lineAt(15, lengths, 1, 2)).toEqual({ index: 0, lineT: 0, start: 15 });
  });
  it("goes round again", () => {
    const round = 4 + 6 + 5 + 3 * 2;
    expect(lineAt(round + 1, lengths, 1, 2)).toEqual({ index: 1, lineT: 1, start: round });
  });
  it("still moves on when a line has no length", () => {
    expect(lineAt(2.5, [0, 0, 0], 0, 2).index).toBe(1);
  });
});

describe("wordState", () => {
  it("shows the whole line past the end", () => {
    expect([0, 1, 2].map((k) => wordState(k, 4, 3))).toEqual(["on", "on", "on"]);
  });
  it("marks the word being said and the ones before it", () => {
    expect([0, 1, 2].map((k) => wordState(k, 2, 3))).toEqual(["on", "now", ""]);
    expect([0, 1, 2].map((k) => wordState(k, 0, 3))).toEqual(["", "", ""]);
  });
});
