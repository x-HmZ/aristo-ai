/**
 * banana.ts — shared Nano Banana Pro image generation helper.
 *
 * Single point of contact with `fal-ai/nano-banana-pro` (Gemini 3 Pro
 * powered, best-in-class for educational infographics + readable text).
 * Consumed by:
 *   • `/api/generate-model`        — topic-level rich teaching image
 *   • `/api/learn/segment-visuals` — per-segment, per-moment visuals
 *
 * Style hints (SegmentVisual["style"]) map to a small preset prefix that's
 * prepended to the segment's prompt before being sent to fal.  This keeps
 * the LLM's prompts concrete and short (the rules in the lesson agent's
 * system prompt cap them at ~40 words) while still guaranteeing a
 * consistent visual treatment per style category.
 *
 * Caching: a hash-keyed in-memory map.  Vercel Fluid Compute reuses
 * function instances across concurrent requests, so a Map living at module
 * scope acts as a warm cache — second students hitting the same lesson
 * pay zero fal.ai cost for the same prompt+style pair until the instance
 * is recycled.  A persistent (Supabase Storage) layer can be added later
 * by replacing `cacheGet` / `cacheSet`.
 */

import { fal }                 from "@fal-ai/client";
import { createHash }          from "crypto";
import type { SegmentVisual }  from "@/lib/agents/teaching";
import { logFalGeneration }    from "@/lib/llm/fal";

// ─── Types ────────────────────────────────────────────────────────────────────

type FalImageResult    = { data: { images: { url: string }[] } };
type TripoSRResult     = { data: { model_mesh: { url: string } } };

export type ImageStyle = SegmentVisual["style"];

export interface GenerateInfographicOpts {
  prompt: string;
  style?: ImageStyle;
  /** Optional override for fal.ai output resolution. Default "1K". */
  resolution?: "1K" | "2K";
  /** Set true to skip the warm cache (admin previews, A/B tests). */
  bypassCache?: boolean;
  /** Learner id for cost attribution in usage_events. */
  userId?: string | null;
  /**
   * Feature tag for the cost page. Defaults to "lesson.teaching_image" — set
   * to e.g. "lesson.segment_visual" when called from /api/learn/segment-visuals.
   */
  feature?: string;
}

export interface GenerateInfographicResult {
  imageUrl: string;
  cached:   boolean;
}

// ─── Style preset prefixes ────────────────────────────────────────────────────

const STYLE_PREFIX: Record<ImageStyle, string> = {
  infographic:
    "Educational infographic, clean typography, labeled, white background, " +
    "modern flat illustration style. ",
  diagram:
    "Technical diagram, line art with subtle color accents, labeled axes and " +
    "components, white background, schoolbook clarity. ",
  comparison:
    "Side-by-side comparison, two panels at identical scale, clearly labeled " +
    "differences, white background, encyclopedia style. ",
  process_flow:
    "Horizontal flow chart, numbered stages connected by arrows, each stage " +
    "labeled, white background, infographic typography. ",
  annotated_photo:
    "Realistic illustration with callouts on thin lines pointing to specific " +
    "features, labels in clean sans-serif, white background. ",
};

const DEFAULT_PREFIX = STYLE_PREFIX.infographic;

// ─── In-memory caches (warm-instance reuse) ──────────────────────────────────
//
// Three separate hash-keyed maps share the same shape but live in their own
// namespace so a teaching-image cache hit can't accidentally serve up a
// FLUX 3D-source URL or a TripoSR .glb URL.
//
// Vercel Fluid Compute reuses function instances across concurrent requests,
// so the maps act as a warm cache.  Repeat fetches of the same prompt /
// imageUrl within TTL pay zero fal.ai cost until the instance is recycled.
//
// What each cache saves:
//   • _cache    — Nano Banana Pro ($0.04/image, ~6s)
//   • _cacheFlux — FLUX Schnell  ($0.003/image, ~1s — cheap but adds up)
//   • _cache3d  — TripoSR        ($0.07/model, ~0.5s — was the big leak)
//
// A persistent (Supabase Storage) layer for _cache3d is the obvious next
// upgrade — model URLs are stable enough to be saved per concept, which
// would mean *every* student after the first pays nothing for that lesson's
// 3D model.  Tracked in HANDOFF.md.

interface CacheEntry { url: string; cachedAt: number }

const _cache     = new Map<string, CacheEntry>(); // NB Pro infographic
const _cacheFlux = new Map<string, CacheEntry>(); // FLUX Schnell 3D source
const _cache3d   = new Map<string, CacheEntry>(); // TripoSR .glb

const CACHE_MAX_ENTRIES = 256;
const CACHE_TTL_MS      = 1000 * 60 * 60 * 12; // 12h — fal CDN URLs live longer than this

function hashKey(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 24);
}

function cacheGet(map: Map<string, CacheEntry>, key: string): string | null {
  const hit = map.get(key);
  if (!hit) return null;
  if (Date.now() - hit.cachedAt > CACHE_TTL_MS) {
    map.delete(key);
    return null;
  }
  return hit.url;
}

function cacheSet(map: Map<string, CacheEntry>, key: string, url: string): void {
  if (map.size >= CACHE_MAX_ENTRIES) {
    // Cheap LRU-ish eviction: drop the oldest insertion (Map preserves insertion order).
    const oldest = map.keys().next().value;
    if (oldest) map.delete(oldest);
  }
  map.set(key, { url, cachedAt: Date.now() });
}

// Convenience wrappers, kept for call-site readability.
const cacheKey = (prompt: string, style: ImageStyle): string =>
  hashKey(`${style}|${prompt}`);

// ─── fal config — idempotent ──────────────────────────────────────────────────

let _falConfigured = false;
function ensureFalConfigured(): void {
  if (_falConfigured) return;
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error("FAL_KEY env var is not set");
  fal.config({ credentials: falKey });
  _falConfigured = true;
}

// ─── Main entry ───────────────────────────────────────────────────────────────

/**
 * Generate a single educational image via fal-ai/nano-banana-pro.
 * Caller is responsible for auth-gating; this helper is purely transport.
 */
export async function generateInfographic(
  opts: GenerateInfographicOpts
): Promise<GenerateInfographicResult> {
  const {
    prompt, style, resolution = "1K", bypassCache = false,
    userId = null, feature = "lesson.teaching_image",
  } = opts;
  if (!prompt || !prompt.trim()) {
    throw new Error("generateInfographic: prompt is required");
  }

  const resolvedStyle = (style ?? "infographic") as ImageStyle;
  const prefix        = STYLE_PREFIX[resolvedStyle] ?? DEFAULT_PREFIX;
  const fullPrompt    = `${prefix}${prompt.trim()}`;

  const key = cacheKey(fullPrompt, resolvedStyle);
  if (!bypassCache) {
    const hit = cacheGet(_cache, key);
    if (hit) return { imageUrl: hit, cached: true };
  }

  ensureFalConfigured();

  const result = (await fal.subscribe("fal-ai/nano-banana-pro", {
    input: {
      prompt:        fullPrompt,
      aspect_ratio:  "1:1",
      output_format: "png",
      resolution,
    },
  })) as unknown as FalImageResult;

  const url = result.data?.images?.[0]?.url;
  if (!url) throw new Error("Nano Banana Pro returned no image");

  // Cost attribution — fire-and-forget. Skipped on cache hit upstream.
  logFalGeneration({
    model:    resolution === "2K" ? "fal-ai/nano-banana-pro/2K" : "fal-ai/nano-banana-pro",
    feature,
    user_id:  userId,
    units:    1,
    metadata: { style: resolvedStyle, resolution, prompt_len: fullPrompt.length },
  });

  cacheSet(_cache, key, url);
  return { imageUrl: url, cached: false };
}

/**
 * Generate a clean FLUX-Schnell source image for 3D reconstruction (TripoSR).
 * Kept in this helper so all fal.ai image touchpoints live in one file.
 *
 * Cached by prompt — same lesson re-loaded by the same student (or by a
 * second student before the warm instance recycles) skips the fal.ai call
 * entirely.  Stable URL out is important for the TripoSR cache downstream:
 * if FLUX returned a fresh URL every time, the TripoSR cache key (which
 * hashes the imageUrl) would always miss.
 */
export async function generate3dSourceImage(
  prompt:        string,
  userId?:       string | null,
  bypassCache:   boolean = false,
): Promise<string> {
  if (!prompt || !prompt.trim()) {
    throw new Error("generate3dSourceImage: prompt is required");
  }
  const trimmed = prompt.trim();
  const key     = hashKey(`flux|${trimmed}`);
  if (!bypassCache) {
    const hit = cacheGet(_cacheFlux, key);
    if (hit) return hit;
  }

  ensureFalConfigured();
  const result = (await fal.subscribe("fal-ai/flux/schnell", {
    input: {
      prompt: `${trimmed}, single isolated object, plain white background, ` +
              `centered, no text, no labels, studio product photo, vibrant colors`,
      image_size:          "square",
      num_inference_steps: 4,
      num_images:          1,
    },
  })) as unknown as FalImageResult;
  const url = result.data?.images?.[0]?.url;
  if (!url) throw new Error("FLUX Schnell returned no image");

  logFalGeneration({
    model:    "fal-ai/flux/schnell",
    feature:  "lesson.3d_source",
    user_id:  userId ?? null,
    units:    1,
    metadata: { prompt_len: trimmed.length },
  });

  cacheSet(_cacheFlux, key, url);
  return url;
}

/**
 * Run TripoSR (image → textured GLB) with a warm cache keyed by source
 * imageUrl.
 *
 * This is the single most expensive cache miss in the whole stack:
 * TripoSR costs $0.07/call and was firing on *every* "View in 3D" click,
 * even when the same student clicked the same model twice in a row.  Now
 * the second click — and any subsequent click within TTL — is free.
 *
 * Future upgrade: persist results to Supabase Storage keyed by `concept_id`
 * so the *first* student to view a topic pays once and every subsequent
 * student inherits the model from the table.  Tracked in HANDOFF.md.
 */
export async function generate3dModel(
  imageUrl: string,
  userId?:  string | null,
  bypassCache: boolean = false,
): Promise<{ modelUrl: string; cached: boolean }> {
  if (!imageUrl || !imageUrl.trim()) {
    throw new Error("generate3dModel: imageUrl is required");
  }
  const trimmed = imageUrl.trim();
  const key     = hashKey(`triposr|${trimmed}`);
  if (!bypassCache) {
    const hit = cacheGet(_cache3d, key);
    if (hit) return { modelUrl: hit, cached: true };
  }

  ensureFalConfigured();
  const result = (await fal.subscribe("fal-ai/triposr", {
    input: {
      image_url:            trimmed,
      output_format:        "glb",
      do_remove_background: true,
      foreground_ratio:     0.85,
      mc_resolution:        256,
    },
  })) as unknown as TripoSRResult;

  const modelUrl = result.data?.model_mesh?.url;
  if (!modelUrl) throw new Error("TripoSR returned no model URL");

  logFalGeneration({
    model:    "fal-ai/triposr",
    feature:  "lesson.3d_model",
    user_id:  userId ?? null,
    units:    1,
    metadata: { source_image: trimmed },
  });

  cacheSet(_cache3d, key, modelUrl);
  return { modelUrl, cached: false };
}
