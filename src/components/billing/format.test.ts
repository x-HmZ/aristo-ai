import { describe, expect, it } from "vitest";
import { formatPrice, limitLines, meterText } from "./format";

describe("formatPrice", () => {
  it("formats cents", () => {
    expect(formatPrice(1099, "EUR")).toBe("10.99 EUR");
    expect(formatPrice(9900, "USD")).toBe("99 USD");
    expect(formatPrice(0, "EUR")).toBe("0 EUR");
    expect(formatPrice(null, "EUR")).toBeNull();
  });
});

describe("meterText", () => {
  it("states usage in words and clamps the bar", () => {
    expect(meterText(3, 15)).toEqual({ text: "3 of 15 used", percent: 20 });
    expect(meterText(20, 15).percent).toBe(100);
    expect(meterText(0, 0).text).toBe("Not included in this plan");
  });
});

describe("limitLines", () => {
  it("lists a family plan's limits", () => {
    const lines = limitLines({ fresh_lessons: 2, chat_turns: 15, replays: 30, voice_chars: 0, models_3d: 0, learners: 1 }, false);
    expect(lines[0]).toBe("1 learner profile");
    expect(lines).toContain("No on-demand 3D models");
  });

  it("marks per-seat limits", () => {
    const lines = limitLines({ fresh_lessons: 0.5, chat_turns: 100, replays: 40, voice_chars: 0, models_3d: 0, learners: 1 }, true);
    expect(lines.every((l) => l.includes("per seat") || l.startsWith("No "))).toBe(true);
  });
});
