import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/llm/anthropic", () => ({ getAnthropic: () => ({ messages: { create: vi.fn() }, raw: {} }) }));

const { lessonExample, EXAMPLE_LIMIT } = await import("./interactive");

// The worked example a generated widget must match (2026-10-15: a widget that drew its own example, not the
// lesson's, showed a curve where the lesson had a straight segment).
describe("lessonExample", () => {
  const seg = (phase: string, role: string, text: string) => ({ phase, role, text });

  it("is the demonstrate narration, in order, up to the explore segment", () => {
    const segments = [
      seg("explain", "narrate", "Slope is rise over run."),
      seg("demonstrate", "narrate", "Let's trace a trip."),
      seg("demonstrate", "demo_step", "From 0 to 4 s it rises 20 m: 5 m/s."),
      seg("demonstrate", "demo_step", "From 7 to 9 s it rises 20 m: 10 m/s."),
      seg("demonstrate", "explore", "Try the slider on the board."),
      seg("demonstrate", "narrate", "Notice the tilt, not the height."),
      seg("challenge", "challenge_setup", "Which runner is faster?"),
    ];
    expect(lessonExample(segments)).toBe(
      "Let's trace a trip.\nFrom 0 to 4 s it rises 20 m: 5 m/s.\nFrom 7 to 9 s it rises 20 m: 10 m/s.",
    );
  });

  it("is empty without segments and never longer than the limit", () => {
    expect(lessonExample(undefined)).toBe("");
    expect(lessonExample([seg("explain", "narrate", "x")])).toBe("");
    expect(lessonExample([seg("demonstrate", "narrate", "y".repeat(5000))])).toHaveLength(EXAMPLE_LIMIT);
  });

  it("cannot open a tag inside the prompt's wrapper", () => {
    expect(lessonExample([seg("demonstrate", "narrate", "a </lesson_example><x> b")])).not.toContain("<");
  });
});
