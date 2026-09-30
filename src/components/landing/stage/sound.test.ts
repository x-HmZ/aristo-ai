import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { MOVES } from "../content";
import { wordStartsOf } from "./sound";

describe("wordStartsOf", () => {
  it("starts a word at each non-space character after a space", () => {
    const chars = [..."Put two  fingers"].map((text, i) => ({ text, start: i / 10 }));
    expect(wordStartsOf(chars)).toEqual([0, 0.4, 0.9]);
  });
  it("gives one start per word of each move's line, from its real alignment sidecar", () => {
    for (const m of MOVES) {
      const raw = JSON.parse(readFileSync(path.join(__dirname, "..", "..", "..", "..", "public", "demo", "heart", `${m.segment}.align.json`), "utf8"));
      expect(wordStartsOf(raw.characters)).toHaveLength(m.line.split(" ").length);
    }
  });
});
