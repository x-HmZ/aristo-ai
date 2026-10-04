import { describe, expect, it } from "vitest";
import { IDEA, PARENTS_COPY, ROOM_COPY } from "./content";

describe("copy rules (messaging.md)", () => {
  it("keeps each idea beat to 25 words and says 'kid' nowhere", () => {
    for (const beat of IDEA.beats) {
      expect(beat.split(/\s+/).length).toBeLessThanOrEqual(25);
      expect(beat.toLowerCase()).not.toContain("kid");
    }
  });
  it("keeps the parents' promises to about 33 words, the one exception (rule 5), and speaks of 'your child'", () => {
    for (const p of PARENTS_COPY.promises) expect(p.body.split(/s+/).length).toBeLessThanOrEqual(35);
    expect(PARENTS_COPY.promises.some((p) => p.body.includes("your child"))).toBe(true);
  });
  it("has no em-dash, en-dash or exclamation mark in the new sections' copy (rules 6 and 7)", () => {
    const text = JSON.stringify([PARENTS_COPY, ROOM_COPY]);
    expect(text).not.toMatch(/[–—!]/);
  });
});

describe("brain lesson excerpts (Step Into the Classroom)", async () => {
  const { lesson: brain } = await import("@/data/demo/brain");
  const { ROOM_COPY } = await import("./content");
  const { ROOM_T } = await import("./stage/room");
  it("each line is a whole sentence of its segment, verbatim", () => {
    ROOM_COPY.lines.forEach((line, i) => {
      const seg = brain.segments!.find((s) => s.id === ROOM_T.lines[i].from)!;
      const at = seg.text.indexOf(line);
      expect(at).toBeGreaterThanOrEqual(0);
      expect(at === 0 || /[.?!] $/.test(seg.text.slice(at - 2, at))).toBe(true);
      expect(/[.?!]$/.test(line)).toBe(true);
    });
  });
});
