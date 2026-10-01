import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { MOVES } from "../content";
import { wordsOf, wordsSpoken } from "./sound";

const align = (segment: string) =>
  JSON.parse(readFileSync(path.join(__dirname, "..", "..", "..", "..", "public", "demo", "heart", `${segment}.align.json`), "utf8"));

describe("wordsOf", () => {
  it("spans each word from its first character's start to its last character's end", () => {
    const chars = [..."Put two  fingers"].map((text, i) => ({ text, start: i / 10, end: i / 10 + 0.1 }));
    const w = wordsOf(chars);
    expect(w.map((x) => x.start)).toEqual([0, 0.4, 0.9]);
    expect(w[0].end).toBeCloseTo(0.3);
    expect(w[2].end).toBeCloseTo(1.6);
  });
  it("gives one span per word of each move's line, from its real alignment sidecar", () => {
    for (const m of MOVES) expect(wordsOf(align(m.segment).characters)).toHaveLength(m.line.split(" ").length);
  });
  it("ends each move's first sentence on its last word (the hero's line length)", () => {
    for (const m of MOVES) {
      const w = wordsOf(align(m.segment).characters);
      const n = m.first.split(" ").length;
      expect(w[n - 1].end).toBeGreaterThan(w[n - 1].start);
      expect(m.line.startsWith(m.first)).toBe(true);
    }
  });
});

describe("wordsSpoken", () => {
  const words = [{ start: 0.1, end: 0.3 }, { start: 0.4, end: 0.7 }, { start: 0.9, end: 1.2 }];
  it("counts the words started by t", () => {
    expect(wordsSpoken(words, 0)).toBe(0);
    expect(wordsSpoken(words, 0.1)).toBe(1);
    expect(wordsSpoken(words, 0.8)).toBe(2);
    expect(wordsSpoken(words, 5)).toBe(3);
  });
});

describe("the room's lines (volcano demo lesson)", () => {
  const volcano = (segment: string) =>
    JSON.parse(readFileSync(path.join(__dirname, "..", "..", "..", "..", "public", "demo", "volcano-eruption", `${segment}.align.json`), "utf8"));
  it("each line is spoken until its last word ends, by the recording's own timings", async () => {
    const { ROOM_COPY } = await import("../content");
    const { ROOM_T } = await import("./room");
    ROOM_COPY.lines.forEach((line, i) => {
      const w = wordsOf(volcano(ROOM_T.lines[i].segment).characters);
      const n = line.split(" ").length;
      expect(w[n - 1].end).toBeCloseTo(ROOM_T.lines[i].until, 2);
    });
  });
});
