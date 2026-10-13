import { describe, expect, it, vi } from "vitest";
import { INTERACTIVE_FIXTURES } from "@/lib/interactive/fixtures";

vi.mock("@/lib/llm/anthropic", () => ({ getAnthropic: () => ({ messages: { create: vi.fn() } }) }));

import { normalizeInteractive, type NarrationSegment } from "./teaching";

const spec = INTERACTIVE_FIXTURES[0].spec;

type Parsed = Parameters<typeof normalizeInteractive>[0];

function seg(id: string, phase: NarrationSegment["phase"], role: NarrationSegment["role"], extra: Partial<NarrationSegment> = {}): NarrationSegment {
  return { id, phase, role, text: `text ${id}`, ...extra };
}

function lesson(over: { segments?: NarrationSegment[]; metadata?: Record<string, unknown> } = {}): Parsed {
  return {
    segments: over.segments ?? [
      seg("a", "activate", "hook"),
      seg("b", "explain", "narrate"),
      seg("c", "demonstrate", "demo_step"),
      seg("d", "demonstrate", "explore"),
      seg("e", "challenge", "challenge_setup"),
      seg("f", "connect", "narrate"),
    ],
    metadata: {
      estimated_read_time_minutes: 5,
      bloom_level_taught: "understand",
      depth_level: "moderate",
      should_generate_model: false,
      interactive: spec,
      ...over.metadata,
    } as Parsed["metadata"],
  };
}

const roles = (p: Parsed) => (p.segments ?? []).map((s) => s.role);

describe("normalizeInteractive", () => {
  it("keeps a consistent lesson as it is", () => {
    const p = lesson();
    normalizeInteractive(p);
    expect(p.metadata?.interactive).toEqual(spec);
    expect(roles(p)).toEqual(["hook", "narrate", "demo_step", "explore", "challenge_setup", "narrate"]);
  });

  it("drops a malformed spec and turns the explore segment into narration", () => {
    const p = lesson({ metadata: { interactive: { goal: "x" } } });
    normalizeInteractive(p);
    expect(p.metadata?.interactive).toBeUndefined();
    expect(roles(p)).not.toContain("explore");
  });

  it("drops the interactive when the lesson also asks for a 3D model", () => {
    for (const flag of ["should_generate_model", "should_generate_3d_model"]) {
      const p = lesson({ metadata: { [flag]: true } });
      normalizeInteractive(p);
      expect(p.metadata?.interactive).toBeUndefined();
      expect(roles(p)).not.toContain("explore");
    }
  });

  it("drops the interactive when there is no explore segment", () => {
    const p = lesson({ segments: [seg("a", "activate", "hook"), seg("b", "demonstrate", "demo_step"), seg("c", "connect", "narrate")] });
    normalizeInteractive(p);
    expect(p.metadata?.interactive).toBeUndefined();
  });

  it("keeps the first explore segment and demotes the rest", () => {
    const p = lesson({
      segments: [seg("a", "explain", "narrate"), seg("b", "demonstrate", "explore"), seg("c", "demonstrate", "explore"), seg("d", "connect", "narrate")],
    });
    normalizeInteractive(p);
    expect(roles(p)).toEqual(["narrate", "explore", "narrate", "narrate"]);
    expect(p.metadata?.interactive).toEqual(spec);
  });

  it("refuses an explore segment that ends the lesson or sits in the challenge phase", () => {
    const last = lesson({ segments: [seg("a", "explain", "narrate"), seg("b", "connect", "explore")] });
    normalizeInteractive(last);
    expect(last.metadata?.interactive).toBeUndefined();
    expect(roles(last)).toEqual(["narrate", "narrate"]);

    const inChallenge = lesson({ segments: [seg("a", "explain", "narrate"), seg("b", "challenge", "explore"), seg("c", "connect", "narrate")] });
    normalizeInteractive(inChallenge);
    expect(inChallenge.metadata?.interactive).toBeUndefined();
    expect(roles(inChallenge)).not.toContain("explore");
  });

  it("strips the visual from the explore segment", () => {
    const p = lesson();
    p.segments![3].visual = { prompt: "a diagram", style: "diagram" };
    normalizeInteractive(p);
    expect(p.segments![3].visual).toBeUndefined();
  });

  it("is a no-op for a lesson without segments or metadata", () => {
    expect(() => normalizeInteractive({})).not.toThrow();
    expect(() => normalizeInteractive({ segments: [seg("a", "explain", "explore")] })).not.toThrow();
  });
});
