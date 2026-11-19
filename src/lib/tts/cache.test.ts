import { describe, expect, it } from "vitest";
import { normaliseTtsText, ttsCacheKey, type TtsKeyInput } from "@/lib/tts/cache";

const base: TtsKeyInput = {
  voiceId: "v1",
  modelId: "m1",
  voiceSettings: { stability: 0.5, similarity_boost: 0.75 },
  outputFormat: "mp3_44100_128",
  text: "Hello world",
};

describe("normaliseTtsText", () => {
  it("trims and collapses whitespace", () => {
    expect(normaliseTtsText("  a \n\t b   c ")).toBe("a b c");
  });
});

describe("ttsCacheKey", () => {
  it("is stable and a sha-256 hex", () => {
    expect(ttsCacheKey(base)).toBe(ttsCacheKey({ ...base }));
    expect(ttsCacheKey(base)).toMatch(/^[0-9a-f]{64}$/);
  });
  it("ignores whitespace differences and settings key order", () => {
    expect(ttsCacheKey({ ...base, text: "  Hello \n world " })).toBe(ttsCacheKey(base));
    expect(ttsCacheKey({ ...base, voiceSettings: { similarity_boost: 0.75, stability: 0.5 } })).toBe(ttsCacheKey(base));
  });
  it("changes with any setting", () => {
    const k = ttsCacheKey(base);
    expect(ttsCacheKey({ ...base, voiceId: "v2" })).not.toBe(k);
    expect(ttsCacheKey({ ...base, modelId: "m2" })).not.toBe(k);
    expect(ttsCacheKey({ ...base, outputFormat: "mp3_22050_32" })).not.toBe(k);
    expect(ttsCacheKey({ ...base, voiceSettings: { stability: 0.6, similarity_boost: 0.75 } })).not.toBe(k);
    expect(ttsCacheKey({ ...base, text: "Hello world!" })).not.toBe(k);
  });
});
