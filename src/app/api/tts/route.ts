/**
 * POST /api/tts
 *
 * Proxies text to ElevenLabs TTS and returns the resulting MP3.
 * Auth-gated via Supabase session.
 *
 * Body:    { text: string, voice?: string }
 *            voice = one of the EL_VOICES keys below (e.g. "marcus")
 *            Defaults to "marcus" if omitted or unrecognised.
 *
 * Returns EITHER:
 *   application/json  { audio: <base64 mp3>, alignment: { characters, ... } }
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
 * Free tier: 10 000 chars/month — no billing required.
 * Model: eleven_turbo_v2_5 (fast, high quality, works on free tier).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;
export const runtime     = "nodejs";

// ElevenLabs pre-made voice IDs — one per avatar persona.
// To swap a voice: replace the ID with any voice_id from
// https://api.elevenlabs.io/v1/voices (or the ElevenLabs voice library).
const EL_VOICES: Record<string, string> = {
  marcus: "pNInz6obpgDQGcFmaJgB", // Adam  — deep, clear male
  ryan:   "ErXwobaYiN019PkySvjV", // Antoni — warm, natural male
  priya:  "21m00Tcm4TlvDq8ikWAM", // Rachel — calm, expressive female
  sonia:  "EXAVITQu4vr4xnSDxMaL", // Sarah  — soft, clear female
  custom: "pNInz6obpgDQGcFmaJgB", // fallback to Adam
};

const DEFAULT_VOICE = "marcus";
const MODEL_ID      = "eleven_turbo_v2_5";

/**
 * Kill switch. Set TTS_TIMESTAMPS=off in the environment to skip the
 * timestamped call entirely and serve plain audio, without a redeploy of code.
 * Here because the timestamped path could not be exercised against the live API
 * before it shipped — if it misbehaves in production, this turns it off in the
 * time it takes to change an env var, and lipsync merely reverts to the FFT.
 */
const WANT_TIMESTAMPS = process.env.TTS_TIMESTAMPS !== "off";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }
    if (text.length > 4000) {
      return NextResponse.json({ error: "text too long (max 4000 chars)" }, { status: 413 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }

    const voiceKey = (body?.voice as string) in EL_VOICES ? (body.voice as string) : DEFAULT_VOICE;
    const voiceId  = EL_VOICES[voiceKey];

    const payload = JSON.stringify({
      text,
      model_id: MODEL_ID,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    });
    const elHeaders = {
      "xi-api-key":   apiKey,
      "Content-Type": "application/json",
    };

    // ── Preferred: audio + character timings in one call, same character cost ──
    const tsRes = WANT_TIMESTAMPS
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

    // ElevenLabs returns raw audio bytes — pipe straight through.
    return new Response(elRes.body, {
      headers: {
        "Content-Type":  "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("[/api/tts] error", err);
    return NextResponse.json(
      { error: "TTS failed", details: err?.message ?? "unknown" },
      { status: 500 }
    );
  }
}
