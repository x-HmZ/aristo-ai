/**
 * Narration cache: key derivation and the storage layer behind /api/tts.
 *
 * Only LESSON narration (text that comes from the lesson payload, shared by every learner) is ever
 * cached. The `generated-assets` bucket is public, so nothing that can hold a learner's name or
 * words may be written here; the route enforces that with the request's `scope`.
 *
 * Storage layout: tts/<hash>.mp3 and tts/<hash>.json (the character alignment), plus a
 * `generated_assets` row of kind "tts_audio" for the mp3 (migration 019). Every function here is
 * best effort in the route's eyes: callers catch, and a failure must degrade to a normal
 * generation, never to broken narration.
 */
import { createHash } from "crypto";

export const TTS_BUCKET         = "generated-assets";
export const TTS_ASSET_KIND     = "tts_audio";
/** What ElevenLabs returns when no output_format is sent; part of the key so a change busts it. */
export const TTS_OUTPUT_FORMAT  = "mp3_44100_128";
export const TTS_VOICE_SETTINGS = { stability: 0.5, similarity_boost: 0.75 } as const;
/** Bump to invalidate every cached clip at once (for instance after a normalisation change). */
const KEY_VERSION = 1;

const LOOKUP_TIMEOUT_MS = 2000;
const STORE_TIMEOUT_MS  = 8000;

export interface TtsKeyInput {
  voiceId:       string;
  modelId:       string;
  voiceSettings: Record<string, number | string | boolean>;
  outputFormat:  string;
  text:          string;
}

/** Trim and collapse every run of whitespace to one space. */
export function normaliseTtsText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** SHA-256 hex over a versioned JSON of everything that changes the audio. */
export function ttsCacheKey(input: TtsKeyInput): string {
  const settings = Object.fromEntries(
    Object.entries(input.voiceSettings).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
  const canonical = JSON.stringify({
    v:       KEY_VERSION,
    voice:   input.voiceId,
    model:   input.modelId,
    settings,
    format:  input.outputFormat,
    text:    normaliseTtsText(input.text),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

// ── Storage ──────────────────────────────────────────────────────────────────

/** The slice of the Supabase client used here, so tests can pass a fake. */
export interface TtsStoreClient {
  from(table: string): any;
  storage: { from(bucket: string): any };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

export interface TtsCacheHit {
  audioUrl:  string;
  /** null when the clip was cached without timings (TTS_TIMESTAMPS=off). */
  alignment: unknown | null;
}

/**
 * Look the key up. Returns null on a miss or on ANY failure. A row does not prove the objects
 * exist, so the mp3 is confirmed with a HEAD (fail-open on timeout: only a definitive 400/404
 * is a miss) and the alignment is fetched from its public URL.
 */
export async function lookupTtsCache(client: TtsStoreClient, hash: string): Promise<TtsCacheHit | null> {
  try {
    const { data, error } = await client
      .from("generated_assets")
      .select("storage_path")
      .eq("kind", TTS_ASSET_KIND)
      .eq("prompt_hash", hash)
      .maybeSingle();
    if (error || !data?.storage_path) return null;

    const bucket   = client.storage.from(TTS_BUCKET);
    const audioUrl = bucket.getPublicUrl(data.storage_path)?.data?.publicUrl as string | undefined;
    const jsonUrl  = bucket.getPublicUrl(`tts/${hash}.json`)?.data?.publicUrl as string | undefined;
    if (!audioUrl) return null;

    const head = await withTimeout(fetch(audioUrl, { method: "HEAD" }), LOOKUP_TIMEOUT_MS).catch(() => null);
    if (head && (head.status === 400 || head.status === 404)) return null;

    let alignment: unknown | null = null;
    if (jsonUrl) {
      const res = await withTimeout(fetch(jsonUrl), LOOKUP_TIMEOUT_MS).catch(() => null);
      if (res?.ok) alignment = await res.json().catch(() => null);
    }
    return { audioUrl, alignment };
  } catch (err) {
    console.warn("[tts-cache] lookup failed, generating instead:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Upload the mp3 and alignment, then upsert the row. Throws; the caller logs and moves on. */
export async function storeTtsCache(
  client: TtsStoreClient,
  opts: { hash: string; audio: Buffer; alignment: unknown | null; model: string },
): Promise<void> {
  const run = async () => {
    const bucket   = client.storage.from(TTS_BUCKET);
    const mp3Path  = `tts/${opts.hash}.mp3`;

    const up = await bucket.upload(mp3Path, opts.audio, {
      contentType: "audio/mpeg", cacheControl: "31536000", upsert: true,
    });
    if (up?.error) throw up.error;

    if (opts.alignment) {
      const json = await bucket.upload(
        `tts/${opts.hash}.json`,
        Buffer.from(JSON.stringify(opts.alignment)),
        { contentType: "application/json", cacheControl: "31536000", upsert: true },
      );
      if (json?.error) throw json.error;
    }

    const { error } = await client.from("generated_assets").upsert(
      {
        kind:         TTS_ASSET_KIND,
        prompt_hash:  opts.hash,
        storage_path: mp3Path,
        source_model: opts.model,
        bytes:        opts.audio.byteLength,
      },
      { onConflict: "kind,prompt_hash" },
    );
    if (error) throw error;
  };
  await withTimeout(run(), STORE_TIMEOUT_MS);
}
