/**
 * Pricing table for cost tracking.
 *
 * Values are USD per 1M tokens unless otherwise stated. Numbers reflect
 * publicly listed prices at the time of writing — update here when
 * provider pricing shifts.
 *
 * `cost_usd_micros` is `tokens * (price / 1_000_000) * 1_000_000` so the
 * arithmetic stays in integers.
 */

/* ────────────────────────────────────────────────────────────────────────── */
/* Anthropic                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

interface AnthropicPricing {
  /** USD per 1M input tokens */
  input:  number;
  /** USD per 1M output tokens */
  output: number;
  /** USD per 1M cache-read input tokens (90% off input usually). */
  cache_read?: number;
  /** USD per 1M cache-creation input tokens (25% surcharge usually). */
  cache_creation?: number;
}

export const ANTHROPIC_PRICING: Record<string, AnthropicPricing> = {
  // Opus tier
  "claude-opus-4-7":              { input: 15, output: 75,  cache_read: 1.5,  cache_creation: 18.75 },
  // Sonnet tier
  // $2/$10 is the STANDARD price, confirmed 2026-09-07 against
  // platform.claude.com/docs/en/about-claude/pricing. Announced at launch as introductory
  // pricing through 2026-08-31, it was made permanent; the scheduled 2026-09-01 rise to
  // $3/$15 was cancelled. Do not "restore" $3/$15 — this row needs no action.
  "claude-sonnet-5":              { input: 2,  output: 10,  cache_read: 0.2,  cache_creation: 2.5   },
  // Historical — keep so past usage_events rows still attribute cost correctly.
  "claude-sonnet-4-6":            { input: 3,  output: 15,  cache_read: 0.3,  cache_creation: 3.75  },
  // Haiku tier
  "claude-haiku-4-5-20251001":    { input: 1,  output: 5,   cache_read: 0.1,  cache_creation: 1.25  },
};

/* ────────────────────────────────────────────────────────────────────────── */
/* OpenAI                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

interface OpenAIPricing {
  /** USD per 1M tokens for embeddings, or USD per 1M input tokens for chat. */
  input: number;
}

export const OPENAI_PRICING: Record<string, OpenAIPricing> = {
  "text-embedding-3-small": { input: 0.02 },
  "text-embedding-3-large": { input: 0.13 },
};

/* ────────────────────────────────────────────────────────────────────────── */
/* fal.ai                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Per-unit price in USD. Keys must match the canonical model identifier we
 * pass into `logUsage({ model })`, which mirrors the fal endpoint slug.
 * Update when fal.ai pricing changes — see https://fal.ai/models.
 */
export const FAL_PRICING: Record<string, number> = {
  "fal-ai/nano-banana-pro":   0.04,   // per image @ 1K
  "fal-ai/nano-banana-pro/2K": 0.08,  // per image @ 2K
  "fal-ai/flux/schnell":      0.003,  // per image
  "fal-ai/triposr":           0.07,   // per generation
  // Legacy aliases (older usage_events rows may have these — keep so lookups don't return 0).
  "nano-banana":              0.04,
  "flux-schnell":             0.003,
  "tripo3d":                  0.50,
  "default":                  0.05,
};

/* ────────────────────────────────────────────────────────────────────────── */
/* Math helpers                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

/** Multiplier from USD to micros (10^-6 USD). */
const USD_TO_MICROS = 1_000_000;

export function anthropicCostMicros(opts: {
  model:                  string;
  input_tokens:           number;
  output_tokens:          number;
  cache_read_tokens?:     number;
  cache_creation_tokens?: number;
}): number {
  const p = ANTHROPIC_PRICING[opts.model];
  if (!p) return 0; // unknown model — skip rather than guess
  const perToken = (rate: number) => rate / 1_000_000;
  const usd =
    opts.input_tokens                     * perToken(p.input) +
    opts.output_tokens                    * perToken(p.output) +
    (opts.cache_read_tokens     ?? 0)     * perToken(p.cache_read     ?? p.input) +
    (opts.cache_creation_tokens ?? 0)     * perToken(p.cache_creation ?? p.input);
  return Math.round(usd * USD_TO_MICROS);
}

export function openaiCostMicros(opts: {
  model:        string;
  input_tokens: number;
}): number {
  const p = OPENAI_PRICING[opts.model];
  if (!p) return 0;
  const usd = opts.input_tokens * (p.input / 1_000_000);
  return Math.round(usd * USD_TO_MICROS);
}

export function falCostMicros(opts: {
  model: string;
  units: number;
}): number {
  const rate = FAL_PRICING[opts.model] ?? FAL_PRICING.default;
  return Math.round(opts.units * rate * USD_TO_MICROS);
}

export function microsToUsd(micros: number): number {
  return micros / USD_TO_MICROS;
}
