/**
 * banana.ts — shared image + 3D generation helper.
 *
 * Single point of contact with fal.ai for every generated asset. Images run on
 * two tiers (see `GenerateInfographicOpts.tier`):
 *   • `/api/generate-model`        — topic-level teaching image, "pro"
 *     (`fal-ai/nano-banana-pro`) because the narration cites its labels
 *   • `/api/learn/segment-visuals` — per-segment visuals, "fast"
 *     (`fal-ai/nano-banana-2`), measured equal on text and 2.1x faster
 *
 * Style hints (SegmentVisual["style"]) map to a small preset prefix that's
 * prepended to the segment's prompt before being sent to fal.  This keeps
 * the LLM's prompts concrete and short (the rules in the lesson agent's
 * system prompt cap them at ~40 words) while still guaranteeing a
 * consistent visual treatment per style category.
 *
 * Caching — two layers:
 *   L1 (memory)  — hash-keyed in-memory Maps.  Vercel Fluid Compute reuses
 *                  function instances across concurrent requests, so a Map
 *                  living at module scope acts as a warm cache — second
 *                  students hitting the same lesson pay zero fal.ai cost
 *                  for the same prompt+style pair until the instance is
 *                  recycled or the 12h TTL lapses.
 *   L2 (Supabase) — `public.generated_assets` (migration 016) + the public
 *                  `generated-assets` Storage bucket.  fal.ai URLs are
 *                  temporary; the first generation for a given
 *                  (kind, prompt_hash) is downloaded server-side and
 *                  re-uploaded so every subsequent request — even from a
 *                  cold instance days later — serves the durable Supabase
 *                  URL and never calls fal.ai again.  Persistence is best
 *                  effort: any storage/DB failure (including the ~3s
 *                  timeout guard) degrades to returning the fal.ai URL
 *                  as-is — a slow or broken storage layer must never block
 *                  a lesson.
 */

import { fal }                 from "@fal-ai/client";
import { createHash }          from "crypto";
import type { SegmentVisual }  from "@/lib/agents/teaching";
import { logFalGeneration }    from "@/lib/llm/fal";
import { createServiceClient } from "@/lib/supabase/server";

// ─── Types ────────────────────────────────────────────────────────────────────

type FalImageResult    = { data: { images: { url: string }[] } };
/**
 * Tripo3D v2.5 returns several mesh variants. `model_mesh` is always present;
 * `pbr_model` / `base_model` appear when texturing is on, which it is.
 */
type Tripo3DResult     = {
  data: {
    model_mesh?:     { url: string };
    pbr_model?:      { url: string };
    base_model?:     { url: string };
    rendered_image?: { url: string };
  };
};

export type ImageStyle = SegmentVisual["style"];

export interface GenerateInfographicOpts {
  prompt: string;
  style?: ImageStyle;
  /**
   * Which image model to use. Default "pro".
   *
   *   "pro"  — `fal-ai/nano-banana-pro`, $0.15, ~28s measured. Reserved for the
   *            topic teaching image: the teacher literally points at it and the
   *            lesson's `visual_walkthrough` narration references its labels by
   *            name, so nothing about it may drift.
   *   "fast" — `fal-ai/nano-banana-2`, $0.08, ~13s measured. Used for segment
   *            visuals.
   *
   * The tiering is evidence-based, not a guess: both models were run against
   * three real text-heavy prompts taken from `cached_lessons` (Python code with
   * quotes and line numbers, `python3 --version` output, labelled flow boxes) on
   * 2026-09-09. Neither garbled any text — text fidelity is a tie. NB2's only
   * weakness is over-production (it volunteers titles, explanatory paragraphs
   * and callouts that annotate styling rather than content), which is what
   * RESTRAINT_SUFFIX below exists to suppress. Full write-up in
   * `.claude/docs/state.md`.
   */
  tier?: "pro" | "fast";
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
  /**
   * Concept this image belongs to, when known (lesson / segment-visuals
   * paths). Null in free-mode, which has no concept graph entry. Threaded
   * onto the `generated_assets` row for future admin per-concept tooling —
   * never used for cache keying (prompt_hash already disambiguates).
   */
  conceptId?: string | null;
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

/**
 * Appended on the "fast" tier only.
 *
 * Nano Banana 2 renders text as accurately as Pro but is far less disciplined
 * about *what* to draw: left alone it adds a poster title, explanatory
 * paragraphs, "RESULT:" summary boxes, and callouts labelling the styling
 * ("Terminal Background (Dark)") rather than the content. In this product the
 * teacher narrates the explanation, so an image that also explains itself talks
 * over the lesson.
 *
 * Deliberately not applied to the "pro" tier: Pro is already restrained — if
 * anything it under-designs — so the same instruction would only make it
 * sparser.
 */
const RESTRAINT_SUFFIX =
  " Draw only what is described above. No title or heading, no caption, no " +
  "explanatory sentences or paragraphs, no summary or result boxes. Use short " +
  "labels that name a part, and label nothing that is merely decorative.";

// ─── In-memory caches (warm-instance reuse) ──────────────────────────────────
//
// Three separate hash-keyed maps share the same shape but live in their own
// namespace so a teaching-image cache hit can't accidentally serve up a
// FLUX 3D-source URL or a Tripo3D .glb URL.
//
// Vercel Fluid Compute reuses function instances across concurrent requests,
// so the maps act as a warm cache.  Repeat fetches of the same prompt /
// imageUrl within TTL pay zero fal.ai cost until the instance is recycled.
//
// What each cache saves:
//   • _cache    — teaching images (Pro $0.15) + segment visuals (NB2 $0.08),
//                 keyed per model so the tiers never cross
//   • _cacheFlux — FLUX Schnell  ($0.003/image, ~1s — cheap but adds up)
//   • _cache3d  — Tripo3D v2.5   ($0.30/model — the priciest single call)
//
// These are only the L1 half. T06 added the durable L2 layer below, so a
// cold instance no longer regenerates anything — the first student to view a
// concept pays once and every student after inherits it from Supabase.

interface CacheEntry { url: string; cachedAt: number }

const _cache     = new Map<string, CacheEntry>(); // NB Pro infographic
const _cacheFlux = new Map<string, CacheEntry>(); // FLUX Schnell 3D source
const _cache3d   = new Map<string, CacheEntry>(); // Tripo3D .glb

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
// `model` is part of the key on purpose: without it the two tiers would serve
// each other's images, and a segment visual would silently inherit whatever the
// teaching image generated for the same prompt+style.
const cacheKey = (prompt: string, style: ImageStyle, model: string): string =>
  hashKey(`${model}|${style}|${prompt}`);

// ─── L2 persistence — Supabase Storage + generated_assets table ─────────────
//
// `prompt_hash` reuses the exact same hash the L1 memory cache computes, so
// the two layers key identically. Never throws — every function here is
// wrapped so a storage/DB outage degrades to "as if L2 didn't exist" rather
// than failing a lesson.

type AssetKind = "infographic" | "flux_source" | "model_3d";

/**
 * Image-to-3D model. Centralised here rather than inlined at the call site so
 * the slug, its price row in `pricing.ts`, and the cache-key prefix stay
 * visibly coupled — changing the model without busting the cache prefix would
 * silently serve the old model's meshes forever.
 */
const TRIPO3D_MODEL      = "tripo3d/tripo/v2.5/image-to-3d";
const TRIPO3D_TIMEOUT_MS = 240_000;

/**
 * Image models, by tier. Both slugs have a price row in `pricing.ts` pinned by
 * tests, and both are part of the cache key — see `cacheKey`.
 */
const IMAGE_MODEL_PRO  = "fal-ai/nano-banana-pro"; // $0.15, ~28s
const IMAGE_MODEL_FAST = "fal-ai/nano-banana-2";   // $0.08, ~13s

const STORAGE_BUCKET      = "generated-assets";
const PERSIST_TIMEOUT_MS  = 3000; // hard cap on the upload+insert round trip
const OBJECT_CHECK_TIMEOUT_MS = 1500; // hard cap on the L2-hit existence HEAD

const ASSET_EXT: Record<AssetKind, string> = {
  infographic: "png",
  flux_source: "png",
  model_3d:    "glb",
};

const ASSET_CONTENT_TYPE: Record<AssetKind, string> = {
  infographic: "image/png",
  flux_source: "image/png",
  model_3d:    "model/gltf-binary",
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err)   => { clearTimeout(timer); reject(err); }
    );
  });
}

/**
 * L2 lookup — hit means a previous request (any instance, any day) already
 * persisted this exact (kind, prompt_hash). Returns the durable public URL,
 * or null on a miss / any failure (table missing, RLS, network — all
 * treated the same: fall through to generation).
 *
 * A row does not prove the object is still there: deleting objects out of the
 * bucket (admin cleanup, a lifecycle rule) leaves the row behind, and
 * `getPublicUrl` is pure string building — it never checks. Serving that URL
 * unchecked would put a permanently broken image in a lesson, because the row
 * keeps "hitting" and generation never re-runs. So a hit is confirmed with a
 * HEAD before it is trusted, and a definitively missing object drops the stale
 * row so the next request regenerates and re-persists.
 */
async function lookupPersistedAsset(
  kind: AssetKind,
  promptHash: string
): Promise<string | null> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("generated_assets")
      .select("storage_path")
      .eq("kind", kind)
      .eq("prompt_hash", promptHash)
      .maybeSingle();
    if (error || !data) return null;

    const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(data.storage_path);
    const url = pub?.publicUrl;
    if (!url) return null;

    // Fail-open: only a definitive "not there" invalidates. A timeout or a
    // network blip serves the URL anyway rather than paying to regenerate.
    try {
      const res = await withTimeout(fetch(url, { method: "HEAD" }), OBJECT_CHECK_TIMEOUT_MS);
      if (res.status === 400 || res.status === 404) {
        console.warn(
          `[banana] L2 row for ${kind}/${promptHash} points at a missing object ` +
          `(HTTP ${res.status}); dropping the row and regenerating.`
        );
        await supabase
          .from("generated_assets")
          .delete()
          .eq("kind", kind)
          .eq("prompt_hash", promptHash);
        return null;
      }
    } catch {
      // unreachable/slow storage — fall through and serve the URL
    }

    return url;
  } catch (err) {
    console.warn(`[banana] L2 lookup failed (${kind}), falling back to generation:`, err);
    return null;
  }
}

/**
 * Download the fal.ai artifact server-side and re-upload it to the
 * `generated-assets` bucket, then record the row. Bounded by
 * `PERSIST_TIMEOUT_MS` so a slow storage write can never meaningfully delay
 * the response — on timeout or any error this logs a warning and returns
 * null, and the caller falls back to the (temporary) fal.ai URL.
 */
async function persistAsset(opts: {
  kind:        AssetKind;
  promptHash:  string;
  sourceUrl:   string;
  sourceModel: string;
  conceptId?:  string | null;
}): Promise<string | null> {
  const { kind, promptHash, sourceUrl, sourceModel, conceptId = null } = opts;

  const run = async (): Promise<string | null> => {
    const res = await fetch(sourceUrl);
    if (!res.ok) throw new Error(`source fetch failed: HTTP ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());

    const supabase = createServiceClient();
    const path = `${kind}/${promptHash}.${ASSET_EXT[kind]}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, bytes, {
        contentType:  ASSET_CONTENT_TYPE[kind],
        cacheControl: "31536000", // 1y — immutable, content-addressed path
        upsert:       true,
      });
    if (uploadError) throw uploadError;

    const { error: insertError } = await supabase
      .from("generated_assets")
      .upsert(
        {
          kind,
          prompt_hash:  promptHash,
          concept_id:   conceptId,
          storage_path: path,
          source_model: sourceModel,
          bytes:        bytes.byteLength,
        },
        { onConflict: "kind,prompt_hash" }
      );
    if (insertError) throw insertError;

    const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return pub?.publicUrl ?? null;
  };

  try {
    return await withTimeout(run(), PERSIST_TIMEOUT_MS);
  } catch (err) {
    console.warn(
      `[banana] L2 persistence skipped for ${kind} (serving fal.ai URL instead):`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

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
    prompt, style, tier = "pro", resolution = "1K", bypassCache = false,
    userId = null, feature = "lesson.teaching_image", conceptId = null,
  } = opts;
  if (!prompt || !prompt.trim()) {
    throw new Error("generateInfographic: prompt is required");
  }

  const resolvedStyle = (style ?? "infographic") as ImageStyle;
  const prefix        = STYLE_PREFIX[resolvedStyle] ?? DEFAULT_PREFIX;
  const model         = tier === "fast" ? IMAGE_MODEL_FAST : IMAGE_MODEL_PRO;
  const fullPrompt    = tier === "fast"
    ? `${prefix}${prompt.trim()}${RESTRAINT_SUFFIX}`
    : `${prefix}${prompt.trim()}`;

  const key = cacheKey(fullPrompt, resolvedStyle, model);
  if (!bypassCache) {
    const hit = cacheGet(_cache, key);
    if (hit) return { imageUrl: hit, cached: true };

    // L2 — a prior request (any instance, any day) may have already
    // persisted this exact model+prompt+style. A hit here means zero fal.ai cost.
    const persistedHit = await lookupPersistedAsset("infographic", key);
    if (persistedHit) {
      cacheSet(_cache, key, persistedHit);
      return { imageUrl: persistedHit, cached: true };
    }
  }

  ensureFalConfigured();

  const result = (await fal.subscribe(model, {
    input: {
      prompt:        fullPrompt,
      aspect_ratio:  "1:1",
      output_format: "png",
      resolution,
    },
  })) as unknown as FalImageResult;

  const url = result.data?.images?.[0]?.url;
  if (!url) throw new Error(`${model} returned no image`);

  // Only Pro has a separate 2K price row; NB2 bills one rate up to 4K.
  const sourceModel = tier === "pro" && resolution === "2K"
    ? "fal-ai/nano-banana-pro/2K"
    : model;

  // Cost attribution — fire-and-forget. Skipped on cache hit upstream.
  logFalGeneration({
    model:    sourceModel,
    feature,
    user_id:  userId,
    units:    1,
    metadata: { style: resolvedStyle, resolution, prompt_len: fullPrompt.length },
  });

  // L2 write-through — best effort, bounded by PERSIST_TIMEOUT_MS. On
  // failure/timeout persistedUrl is null and we fall back to the fal URL.
  const persistedUrl = await persistAsset({
    kind:        "infographic",
    promptHash:  key,
    sourceUrl:   url,
    sourceModel,
    conceptId,
  });
  const canonicalUrl = persistedUrl ?? url;

  cacheSet(_cache, key, canonicalUrl);
  return { imageUrl: canonicalUrl, cached: false };
}

/**
 * Generate a clean FLUX-Schnell source image for 3D reconstruction (Tripo3D).
 * Kept in this helper so all fal.ai image touchpoints live in one file.
 *
 * Cached by prompt — same lesson re-loaded by the same student (or by a
 * second student before the warm instance recycles) skips the fal.ai call
 * entirely.  Stable URL out is important for the Tripo3D cache downstream:
 * if FLUX returned a fresh URL every time, the Tripo3D cache key (which
 * hashes the imageUrl) would always miss.
 */
export async function generate3dSourceImage(
  prompt:        string,
  userId?:       string | null,
  bypassCache:   boolean = false,
  conceptId?:    string | null,
): Promise<string> {
  if (!prompt || !prompt.trim()) {
    throw new Error("generate3dSourceImage: prompt is required");
  }
  const trimmed = prompt.trim();
  const key     = hashKey(`flux|${trimmed}`);
  if (!bypassCache) {
    const hit = cacheGet(_cacheFlux, key);
    if (hit) return hit;

    const persistedHit = await lookupPersistedAsset("flux_source", key);
    if (persistedHit) {
      cacheSet(_cacheFlux, key, persistedHit);
      return persistedHit;
    }
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

  const persistedUrl = await persistAsset({
    kind:        "flux_source",
    promptHash:  key,
    sourceUrl:   url,
    sourceModel: "fal-ai/flux/schnell",
    conceptId:   conceptId ?? null,
  });
  const canonicalUrl = persistedUrl ?? url;

  cacheSet(_cacheFlux, key, canonicalUrl);
  return canonicalUrl;
}

/**
 * Run Tripo3D v2.5 (image → textured GLB) through both cache layers.
 *
 * Replaced `fal-ai/triposr` on 2026-09-09 (T07's verdict). TripoSR is a
 * 2024-era single-view model that scored 1.5/5 in the bake-off — it returned
 * a flat "coin" relief of the source image with a muddy back face, which is
 * not classroom-usable. Tripo3D v2.5 scored 4/5 on the same input: true
 * volumetric geometry, vivid PBR colour, and it is *faster* (78 s vs ~100 s
 * observed end to end).
 *
 * The price goes $0.07 -> $0.30 per generation, which is only affordable
 * because T06's persistent cache made this a one-time cost per concept
 * rather than per cold instance per student. Do not revert one without the
 * other.
 *
 * Two consequences of the swap, both deliberate:
 *   • the cache key prefix moved `triposr|` -> `tripo25|`, so old TripoSR
 *     entries in L1/L2 are never served again (they are orphaned, not
 *     deleted — historical `usage_events` rows still price correctly).
 *   • Tripo3D emits Y-up glTF, so the `-PI/2` X rotation that
 *     `GeneratedModel.tsx` applied for TripoSR's Z-up output is gone.
 */
export async function generate3dModel(
  imageUrl: string,
  userId?:  string | null,
  bypassCache: boolean = false,
  conceptId?: string | null,
): Promise<{ modelUrl: string; cached: boolean }> {
  if (!imageUrl || !imageUrl.trim()) {
    throw new Error("generate3dModel: imageUrl is required");
  }
  const trimmed = imageUrl.trim();
  const key     = hashKey(`tripo25|${trimmed}`);
  if (!bypassCache) {
    const hit = cacheGet(_cache3d, key);
    if (hit) return { modelUrl: hit, cached: true };

    const persistedHit = await lookupPersistedAsset("model_3d", key);
    if (persistedHit) {
      cacheSet(_cache3d, key, persistedHit);
      return { modelUrl: persistedHit, cached: true };
    }
  }

  ensureFalConfigured();
  // The eval saw one Tripo3D call hang indefinitely. `fal.subscribe` has no
  // timeout of its own, so without this the route would sit until Vercel's
  // 300s ceiling killed it and the student would watch a spinner the whole
  // time. 240s leaves headroom to fail cleanly inside that budget.
  const result = (await withTimeout(
    fal.subscribe(TRIPO3D_MODEL, {
      input: {
        image_url: trimmed,
        texture:   "standard", // "no" $0.20 / "standard" $0.30 / "HD" $0.40
        pbr:       true,
      },
    }),
    TRIPO3D_TIMEOUT_MS
  )) as unknown as Tripo3DResult;

  // PBR is the better asset when present; `model_mesh` is always populated.
  const modelUrl = result.data?.pbr_model?.url ?? result.data?.model_mesh?.url;
  if (!modelUrl) throw new Error("Tripo3D returned no model URL");

  logFalGeneration({
    model:    TRIPO3D_MODEL,
    feature:  "lesson.3d_model",
    user_id:  userId ?? null,
    units:    1,
    metadata: { source_image: trimmed },
  });

  const persistedUrl = await persistAsset({
    kind:        "model_3d",
    promptHash:  key,
    sourceUrl:   modelUrl,
    sourceModel: TRIPO3D_MODEL,
    conceptId:   conceptId ?? null,
  });
  const canonicalUrl = persistedUrl ?? modelUrl;

  cacheSet(_cache3d, key, canonicalUrl);
  return { modelUrl: canonicalUrl, cached: false };
}
