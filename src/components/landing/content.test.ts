import { describe, expect, it } from "vitest";
import { lesson } from "@/data/demo/heart";
import { CHALLENGE_QUESTION, IDEA, IDEA_LINKS, IDEAS, MOVES, TOPIC } from "./content";

// The landing shows these as real output, so they must be the lesson's words exactly.
describe("heart lesson excerpts", () => {
  it("the topic is the lesson's concept name", () => {
    expect(TOPIC).toBe(lesson.concept_name);
  });
  it("each move's line is its segment's text, in its phase, and its first sentence starts it", () => {
    for (const m of MOVES) {
      const seg = lesson.segments!.find((s) => s.id === m.segment)!;
      expect(seg.text).toBe(m.line);
      expect(seg.phase).toBe(m.phase);
      expect(m.line.startsWith(m.first)).toBe(true);
    }
  });
  it("the desk challenge is the lesson's challenge question", () => {
    expect(CHALLENGE_QUESTION).toBe(lesson.phases.challenge.question);
  });
  it("the ideas come from the lesson's own output", () => {
    const text = JSON.stringify(lesson).toLowerCase();
    for (const idea of IDEAS) expect(text).toContain(idea.label.toLowerCase());
    for (const [a, b] of IDEA_LINKS) {
      expect(IDEAS.some((i) => i.id === a)).toBe(true);
      expect(IDEAS.some((i) => i.id === b)).toBe(true);
    }
  });
});

describe("copy rules (messaging.md)", () => {
  it("keeps each idea beat to 25 words and says 'kid' nowhere", () => {
    for (const beat of IDEA.beats) {
      expect(beat.split(/\s+/).length).toBeLessThanOrEqual(25);
      expect(beat.toLowerCase()).not.toContain("kid");
    }
  });
});
