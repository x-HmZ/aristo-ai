import { describe, expect, it } from "vitest";
import { parseTtsPlan, pickVoice } from "./voices";
import table from "./voices.json";

// Upgrading ElevenLabs is an env change (ELEVENLABS_PLAN=paid), not a code change (2026-10-15).
describe("parseTtsPlan", () => {
  it("is paid only when it says paid", () => {
    expect(parseTtsPlan("paid")).toBe("paid");
    expect(parseTtsPlan(" Paid ")).toBe("paid");
    for (const raw of [undefined, "", "free", "pro", "true", 1]) expect(parseTtsPlan(raw)).toBe("free");
  });
});

describe("pickVoice", () => {
  it("reads Jake in the placeholder voice on turbo on the free plan", () => {
    expect(pickVoice("jake", "free")).toEqual({ key: "jake", voice: "bIHbv24MWmeRgasZH58o", model: "eleven_turbo_v2_5" });
  });

  it("reads Jake as Mike on multilingual v2 on the paid plan", () => {
    expect(pickVoice("jake", "paid")).toEqual({ key: "jake", voice: "zfc8CJQpe8Kqyl0vvCzo", model: "eleven_multilingual_v2" });
  });

  it("keeps a voice's free entry on the paid plan when it has no paid one", () => {
    expect(pickVoice("priya", "paid")).toEqual(pickVoice("priya", "free"));
  });

  it("falls back to the default voice for unknown keys", () => {
    for (const requested of [undefined, 3, "nobody", "__proto__", "hasOwnProperty"]) {
      expect(pickVoice(requested, "free").key).toBe(table.default);
    }
  });

  it("has a free entry with a voice and a model for every key", () => {
    for (const row of Object.values(table.voices) as Array<{ free: { voice: string; model: string } }>) {
      expect(row.free.voice).toMatch(/^\w{20}$/);
      expect(row.free.model).toMatch(/^eleven_/);
    }
  });
});
