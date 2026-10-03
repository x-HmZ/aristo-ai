import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { wordsOf, wordsSpoken } from "./sound";

describe("wordsOf", () => {
  it("spans each word from its first character's start to its last character's end", () => {
    const chars = [..."Put two  fingers"].map((text, i) => ({ text, start: i / 10, end: i / 10 + 0.1 }));
    const w = wordsOf(chars);
    expect(w.map((x) => x.start)).toEqual([0, 0.4, 0.9]);
    expect(w[0].end).toBeCloseTo(0.3);
    expect(w[2].end).toBeCloseTo(1.6);
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

describe("the room's lines (brain demo lesson, in each teacher's voice)", () => {
  const voice = (segment: string) =>
    JSON.parse(readFileSync(path.join(__dirname, "..", "..", "..", "..", "public", "landing", "voice", `${segment}.align.json`), "utf8"));
  it("each line lasts its recording, its words and its last one ending a breath before the line does", async () => {
    const { ROOM_COPY } = await import("../content");
    const { ROOM_T, lineUntil, voiceOf } = await import("./room");
    for (const teacher of ["jake", "mj"] as const) {
      ROOM_COPY.lines.forEach((line, i) => {
        const w = wordsOf(voice(voiceOf(i, teacher)).characters);
        expect(w).toHaveLength(line.split(" ").length);
        const gap = lineUntil(i, teacher) - w[w.length - 1].end;
        expect(gap).toBeGreaterThan(0);
        expect(gap).toBeLessThan(0.2);
      });
    }
    expect(ROOM_T.lines).toHaveLength(ROOM_COPY.lines.length);
  });
});
