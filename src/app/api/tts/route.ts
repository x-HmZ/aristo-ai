/**
 * POST /api/tts
 *
 * Proxies text to ElevenLabs TTS and returns the resulting MP3.
 * Approved learners only (requireApproved), at most 200 generations an hour each.
 *
 * Body:    { text: string, voice?: string, scope?: "lesson" | "live" }
 *            voice = a key of src/lib/tts/voices.json (e.g. "jake")
 *            Defaults to "marcus" if omitted or unrecognised.
 *            scope = "lesson" for narration of text that comes from the lesson payload (shared by
 *            every learner); anything else, or a missing/invalid value, is "live". Only "lesson"
 *            is cached, because the cache bucket is public: live text can hold a learner's name
 *            or words and is never written there.
 *
 * Returns ONE of:
 *   application/json  { audio: <base64 mp3>, alignment: { characters, ... } }
 *   application/json  { audioUrl, alignment, cached: true }       (cache hit, see below)
 *   audio/mpeg        raw mp3 bytes                      (fallback, see below)
 *
 * The JSON form comes from ElevenLabs' `/with-timestamps` endpoint, which
 * returns character-level timings alongside the audio. The client turns those
 * into a viseme timeline so the avatar's mouth matches the phonemes actually
 * being spoken, instead of wawa-lipsync guessing a shape from the frequency
 * profile of each frame (see src/lib/lipsync/visemes.ts).
 *
 * Timestamps are NOT billed extra: `/with-timestamps` costs the same characters
 * as the plain endpoint. The only price is transfer — base64 inflates the audio
 * by ~33%. That does not cost us streaming, because the client already had to
 * buffer the whole body (it builds a Blob) before playback could start.
 *
 * If the timestamped call fails for any reason — a model that will not serve it,
 * a key without the scope, an upstream blip — we retry the plain endpoint and
 * stream bytes exactly as before. Narration must never break to gain lipsync,
 * so this route degrades instead of failing.
 *
 * Narration cache (scope "lesson" only, src/lib/tts/cache.ts): the key is a SHA-256 over voice,
 * model, settings, format and the normalised text. A hit makes no ElevenLabs call and answers
 * with the public storage URL; the client fetches it into the same Blob path as before. A miss
 * behaves exactly as above and stores the mp3 and alignment AFTER responding, through next's
 * after(): the response is already complete, so the upload adds no latency, and the platform
 * keeps the invocation alive until it finishes (maxDuration covers it). Any storage failure
 * falls through to a normal generation. Results without alignment are not stored (a plain-audio
 * fallback caused by an upstream blip must not become permanent) unless TTS_TIMESTAMPS=off.
 * A hit is not counted against the throttle and logs no usage; every generation logs one row.
 *
 * Free tier: 10 000 chars/month — no billing required.
 * Voice and model come from src/lib/tts/voices.json by ELEVENLABS_PLAN: on the free plan every key reads
 * with eleven_turbo_v2_5; on "paid", Jake reads as Mike with eleven_multilingual_v2.
 */

import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireEntitlement, spendAllowance, releaseConsumed, type Consumed } from "@/lib/billing/entitlements";
import { createThrottle } from "@/lib/interactive/throttle";
import { elevenlabsCostMicros } from "@/lib/llm/pricing";
import { logUsage } from "@/lib/llm/usage";
import { createServiceClient } from "@/lib/supabase/server";
import {
  lookupTtsCache,
  storeTtsCache,
  ttsCacheKey,
  TTS_OUTPUT_FORMAT,
  TTS_VOICE_SETTINGS,
  type TtsStoreClient,
} from "@/lib/tts/cache";
import { parseTtsPlan, pickVoice } from "@/lib/tts/voices";

/** Per learner and instance, best effort: a lesson with prefetch makes about 30 calls. Counts misses only. */
const ttsThrottle = createThrottle(200, 60 * 60 * 1000);

export const maxDuration = 60;
export const runtime     = "nodejs";

const BodySchema = z.object({
  text:  z.string().default(""),
  voice: z.string().optional().catch(undefined),
  // An unknown scope is treated as live rather than rejected: when unsure, never cache.
  scope: z.enum(["lesson", "live"]).default("live").catch("live"),
});

// Voice and model per teacher key, picked by ELEVENLABS_PLAN (unset = free). The table is
// src/lib/tts/voices.json, shared with scripts/prerender-demo-tts.mjs.
const PLAN = parseTtsPlan(process.env.ELEVENLABS_PLAN);

/**
 * Kill switch. Set TTS_TIMESTAMPS=off in the environment to skip the
 * timestamped call entirely and serve plain audio, without a redeploy of code.
 * Here because the timestamped path could not be exercised against the live API
 * before it shipped — if it misbehaves in production, this turns it off in the
 * time it takes to change an env var, and lipsync merely reverts to the FFT.
 */
function wantTimestamps(): boolean {
  return process.env.TTS_TIMESTAMPS !== "off";
}

/** Run `fn` after the response is sent; where after() is unavailable (outside a request), just run it. */
function runAfter(fn: () => Promise<void>): void {
  const safe = () => fn().catch((err) => {
    console.warn("[/api/tts] cache store skipped:", err instanceof Error ? err.message : err);
  });
  try {
    after(safe);
  } catch {
    void safe();
  }
}

export async function POST(req: NextRequest) {
  let consumed: Consumed | null = null;
  try {
    // Approved learners only, hit or miss: every call can spend the shared ElevenLabs quota.
    const guard = await requireEntitlement();
    if (guard.error) return guard.error;

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    const body   = parsed.success ? parsed.data : { text: "", voice: undefined, scope: "live" as const };
    const text   = body.text.trim();
    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }
    if (text.length > 4000) {
      return NextResponse.json({ error: "text too long (max 4000 chars)" }, { status: 413 });
    }

    const { key: voiceKey, voice: voiceId, model } = pickVoice(body.voice, PLAN);
    const timestamps = wantTimestamps();

    // ── Narration cache: lesson scope only ───────────────────────────────────
    const cacheable = body.scope === "lesson";
    let hash: string | null = null;
    let store: TtsStoreClient | null = null;
    if (cacheable) {
      try {
        store = createServiceClient() as unknown as TtsStoreClient;
        hash  = ttsCacheKey({
          voiceId, modelId: model, voiceSettings: TTS_VOICE_SETTINGS,
          outputFormat: TTS_OUTPUT_FORMAT, text,
        });
        const hit = await lookupTtsCache(store, hash);
        // Cached without timings while timings are wanted again: regenerate and overwrite.
        if (hit && (hit.alignment || !timestamps)) {
          return NextResponse.json(
            { audioUrl: hit.audioUrl, alignment: hit.alignment, cached: true },
            { headers: { "Cache-Control": "no-store" } },
          );
        }
      } catch (err) {
        console.warn("[/api/tts] cache unavailable, generating:", err instanceof Error ? err.message : err);
        hash = null;
      }
    }

    // Only generations (misses and live calls) spend the quota, so only they are throttled.
    if (!ttsThrottle.take(guard.user.id)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    // Chat voice (scope "live") spends voice_chars. Lesson narration consumes nothing here: its cost belongs
    // to the lesson. An unmetered lesson-scope miss is bounded only by the throttle above until the spend
    // guard (plan item L04) meters it. Released in the catch if ElevenLabs fails.
    if (body.scope === "live") {
      const spent = await spendAllowance(guard.entitlement, "voice_chars", text.length);
      if (spent.error) return spent.error;
      consumed = spent.consumed;
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }

    const payload = JSON.stringify({
      text,
      model_id: model,
      voice_settings: TTS_VOICE_SETTINGS,
    });
    const elHeaders = {
      "xi-api-key":   apiKey,
      "Content-Type": "application/json",
    };

    // One usage row per generation: user id, character count, model and voice key. Never the text.
    const logGeneration = () => {
      const characters = text.length;
      logUsage({
        user_id:         guard.user.id,
        provider:        "elevenlabs",
        model,
        feature:         "tts",
        units:           characters,
        cost_usd_micros: elevenlabsCostMicros({ characters }),
        metadata:        { voice: voiceKey, characters, scope: body.scope },
      });
    };

    // ── Preferred: audio + character timings in one call, same character cost ──
    const tsRes = timestamps
      ? await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
          { method: "POST", headers: { ...elHeaders, Accept: "application/json" }, body: payload },
        ).catch(() => null)
      : null;

    if (tsRes?.ok) {
      const data = await tsRes.json().catch(() => null);
      // `normalized_alignment` describes the text as actually spoken (numbers
      // and abbreviations expanded), which is what the mouth needs to match;
      // `alignment` tracks the raw input. Prefer the former, accept either.
      const alignment = data?.normalized_alignment ?? data?.alignment ?? null;

      if (data?.audio_base64) {
        logGeneration();
        if (hash && store && alignment) {
          const audio = Buffer.from(data.audio_base64, "base64");
          const h = hash, s = store;
          runAfter(() => storeTtsCache(s, { hash: h, audio, alignment, model }));
        }
        return NextResponse.json(
          { audio: data.audio_base64, alignment },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
    }

    // ── Fallback: plain endpoint, raw bytes, no timings (pre-V7 behaviour) ────
    if (tsRes && !tsRes.ok) {
      const detail = await tsRes.text().catch(() => "");
      console.warn(
        `[/api/tts] with-timestamps unavailable (${tsRes.status}), falling back to plain audio. ` +
        `Lipsync will use the FFT approximation. ${detail.slice(0, 200)}`,
      );
    }

    const elRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      { method: "POST", headers: { ...elHeaders, Accept: "audio/mpeg" }, body: payload },
    );

    if (!elRes.ok) {
      const detail = await elRes.text().catch(() => "");
      throw new Error(`ElevenLabs ${elRes.status}: ${detail}`);
    }
    logGeneration();

    // Plain audio has no alignment, so it is stored only when timestamps are switched off on
    // purpose; the bytes are then buffered (the client buffers them anyway before playing).
    if (hash && store && !timestamps) {
      const audio = Buffer.from(await elRes.arrayBuffer());
      const h = hash, s = store;
      runAfter(() => storeTtsCache(s, { hash: h, audio, alignment: null, model }));
      return new Response(audio, {
        headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
      });
    }

    // ElevenLabs returns raw audio bytes — pipe straight through.
    return new Response(elRes.body, {
      headers: {
        "Content-Type":  "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    await releaseConsumed(consumed);
    console.error("[/api/tts] error", err);
    return NextResponse.json(
      { error: "TTS failed", details: err?.message ?? "unknown" },
      { status: 500 }
    );
  }
}

