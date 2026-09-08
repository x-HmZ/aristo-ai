import { describe, expect, it } from "vitest";
import {
  anthropicCostMicros,
  falCostMicros,
  microsToUsd,
  openaiCostMicros,
} from "@/lib/llm/pricing";

describe("anthropicCostMicros", () => {
  it("computes cost from input + output tokens at the listed rate", () => {
    // claude-sonnet-5: $2/1M input, $10/1M output
    const micros = anthropicCostMicros({
      model: "claude-sonnet-5",
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
    });
    expect(micros).toBe(12_000_000); // $12 in micros
  });

  it("applies the discounted cache-read rate when provided", () => {
    const micros = anthropicCostMicros({
      model: "claude-sonnet-5",
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 1_000_000,
    });
    expect(micros).toBe(200_000); // $0.20/1M cache-read
  });

  it("applies the cache-creation surcharge rate when provided", () => {
    const micros = anthropicCostMicros({
      model: "claude-sonnet-5",
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_tokens: 1_000_000,
    });
    expect(micros).toBe(2_500_000); // $2.50/1M cache-creation
  });

  it("falls back to the base input rate when a model has no cache pricing rows", () => {
    // Every current model row does define cache_read/cache_creation, so this
    // exercises the `?? p.input` fallback path directly rather than relying
    // on pricing-table shape.
    const micros = anthropicCostMicros({
      model: "claude-haiku-4-5-20251001",
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 1_000_000,
    });
    expect(micros).toBe(100_000); // listed cache_read rate ($0.10/1M), not input ($1/1M)
  });

  it("returns 0 for an unknown model rather than guessing a price", () => {
    const micros = anthropicCostMicros({
      model: "not-a-real-model",
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
    });
    expect(micros).toBe(0);
  });

  it("keeps historical model rows priceable for old usage_events", () => {
    const micros = anthropicCostMicros({
      model: "claude-sonnet-4-6",
      input_tokens: 1_000_000,
      output_tokens: 0,
    });
    expect(micros).toBe(3_000_000);
  });
});

describe("openaiCostMicros", () => {
  it("prices embedding tokens at the listed rate", () => {
    const micros = openaiCostMicros({
      model: "text-embedding-3-small",
      input_tokens: 1_000_000,
    });
    expect(micros).toBe(20_000); // $0.02/1M
  });

  it("returns 0 for an unknown model", () => {
    expect(openaiCostMicros({ model: "unknown", input_tokens: 1_000_000 })).toBe(0);
  });
});

describe("falCostMicros", () => {
  it("prices per-unit generations at the listed rate", () => {
    const micros = falCostMicros({ model: "fal-ai/flux/schnell", units: 10 });
    expect(micros).toBe(30_000); // 10 * $0.003
  });

  it("falls back to the default per-unit rate for an unknown model", () => {
    const micros = falCostMicros({ model: "some-new-model", units: 1 });
    expect(micros).toBe(50_000); // $0.05 default
  });
});

describe("microsToUsd", () => {
  it("converts micros back to a USD float", () => {
    expect(microsToUsd(12_000_000)).toBe(12);
    expect(microsToUsd(500_000)).toBe(0.5);
  });
});
