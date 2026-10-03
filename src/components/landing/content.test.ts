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

describe("volcano lesson excerpts (Step Into the Classroom)", async () => {
  const { lesson: volcano } = await import("@/data/demo/volcano-eruption");
  const { ROOM_COPY } = await import("./content");
  const { ROOM_T } = await import("./stage/room");
  it("each line starts its segment, verbatim, and ends where a sentence does", () => {
    ROOM_COPY.lines.forEach((line, i) => {
      const seg = volcano.segments!.find((s) => s.id === ROOM_T.lines[i].segment)!;
      expect(seg.text.startsWith(line)).toBe(true);
      expect(/[.?!]$/.test(line)).toBe(true);
    });
  });
});
