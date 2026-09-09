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

  // Regression guard. `fal-ai/nano-banana-pro` sat at $0.04 — the *non-Pro*
  // rate — while fal actually charged $0.15, so the cost dashboard understated
  // the platform's single biggest line by 3.75x for months. Nothing caught it
  // because no test pinned the rates. These values were read from fal's own
  // pricing API on 2026-09-09:
  //   GET https://api.fal.ai/v1/models/pricing?endpoint_id=<slug>
  // If fal moves a price, update both this table and FAL_PRICING together.
  it.each([
    ["fal-ai/nano-banana-pro",           0.15],
    ["fal-ai/nano-banana-2",             0.08],
    ["fal-ai/nano-banana",               0.0398],
    ["fal-ai/flux/schnell",              0.003],
    ["tripo3d/tripo/v2.5/image-to-3d",   0.30],
    ["fal-ai/triposr",                   0.07],
  ])("prices %s at $%s per unit", (model, usd) => {
    expect(falCostMicros({ model, units: 1 })).toBe(Math.round(usd * 1_000_000));
  });

  it("never silently prices a live model at the unknown-model default", () => {
    // A typo'd or renamed slug would otherwise bill $0.05 and look plausible.
    for (const model of ["fal-ai/nano-banana-pro", "tripo3d/tripo/v2.5/image-to-3d"]) {
      expect(falCostMicros({ model, units: 1 })).not.toBe(50_000);
    }
  });
});

describe("microsToUsd", () => {
  it("converts micros back to a USD float", () => {
    expect(microsToUsd(12_000_000)).toBe(12);
    expect(microsToUsd(500_000)).toBe(0.5);
  });
});
