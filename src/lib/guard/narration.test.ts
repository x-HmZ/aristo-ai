import { beforeEach, describe, expect, it } from "vitest";
import { attachNarrationTokens, narratableTexts, narrationToken, verifyNarrationToken } from "@/lib/guard/narration";
import { hmacHex, verifyHmacHex } from "@/lib/guard/sign";
import { narrationKey, tokenFromLesson } from "@/lib/tts/narration-key";

beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
});

const lesson = {
  concept_id: "c",
  segments: [{ id: "s1", text: "First segment." }, { id: "s2", text: "Second  segment." }],
  phases: {
    activate:    { content: "Activate text" },
    explain:     { analogy: "An analogy.", formal_explanation: "formal", key_insight: "An insight." },
    demonstrate: { example_description: "Example", narration_pre_visual: "Pre", visual_walkthrough: "Walk" },
    challenge:   { question: "Why?" },
    connect:     { content: "Connect text" },
  },
  metadata: { model_callouts: ["Part A", "Part B"] },
};

describe("tokens", () => {
  it("verify only for the same normalised text", () => {
    const t = narrationToken("Hello   world")!;
    expect(verifyNarrationToken("Hello world", t)).toBe(true);
    expect(verifyNarrationToken(" Hello world ", t)).toBe(true);
    expect(verifyNarrationToken("Hello world!", t)).toBe(false);
    expect(verifyNarrationToken("Hello world", "x")).toBe(false);
    expect(verifyNarrationToken("Hello world", undefined)).toBe(false);
    expect(verifyNarrationToken("", t)).toBe(false);
  });

  it("depend on the server secret and are purpose-bound", () => {
    const t = narrationToken("Hi")!;
    expect(verifyHmacHex("aristo/quiz-answer/v2", "Hi", t)).toBe(false);
    expect(hmacHex("aristo/narration-token/v1", "Hi")).not.toBe(hmacHex("aristo/quiz-answer/v2", "Hi"));
    process.env.SUPABASE_SERVICE_ROLE_KEY = "another";
    expect(verifyNarrationToken("Hi", t)).toBe(false);
  });

  it("no secret: no token, nothing verifies", () => {
    const t = narrationToken("Hi")!;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(narrationToken("Hi")).toBeNull();
    expect(verifyNarrationToken("Hi", t)).toBe(false);
    expect(attachNarrationTokens(lesson).narration_tokens).toBeUndefined();
  });
});

describe("attachNarrationTokens", () => {
  it("covers every text the client narrates and verifies from the payload alone", () => {
    const out = attachNarrationTokens(lesson);
    const spoken = [
      "First segment.", "Second segment.", "Activate text", "An analogy. An insight.", "Example", "Pre", "Walk",
      "Why?", "Connect text", "Part A Part B",
    ];
    for (const text of spoken) {
      const token = tokenFromLesson(out, text);
      expect(token, text).toBeTypeOf("string");
      expect(verifyNarrationToken(text, token)).toBe(true);
    }
    expect(tokenFromLesson(out, "Something else")).toBeUndefined();
    expect(narrationKey("a  b")).toBe(narrationKey("a b"));
  });

  it("does not mutate the input, so a cached row never receives tokens", () => {
    const before = JSON.stringify(lesson);
    const out = attachNarrationTokens(lesson);
    expect(JSON.stringify(lesson)).toBe(before);
    expect(out).not.toBe(lesson);
    expect(narratableTexts(lesson).length).toBeGreaterThan(8);
  });
});
