/**
 * POST /api/stt
 *
 * Server speech-to-text for voice input: the learner's recording goes to OpenAI's transcription
 * endpoint, a provider the operator can hold a data-processing agreement with, instead of the
 * browser's Web Speech API (which sends audio to the browser vendor). Switched on per deployment
 * by NEXT_PUBLIC_STT_ENGINE=server; see src/lib/speech-engine.ts.
 *
 * Request:  multipart/form-data, field `audio` (webm, ogg, mp4 or wav, at most 2 MB), optional
 *           field `language` (two-letter code).
 * Returns:  { text }   | 503 { error: "stt_unavailable" } when OPENAI_API_KEY is not set.
 *
 * Privacy: audio and transcript are never logged or stored here. The one usage_events row holds
 * the user id, byte count and an estimated duration, nothing from the speech itself.
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { requireApproved } from "@/lib/auth/approval";
import { createThrottle } from "@/lib/interactive/throttle";
import { openaiTranscribeCostMicros } from "@/lib/llm/pricing";
import { logUsage } from "@/lib/llm/usage";
import { STT_MODEL } from "@/lib/stt/models";
import { audioExtension, estimateSeconds, MAX_AUDIO_BYTES } from "@/lib/stt/audio";

export const maxDuration = 30;
export const runtime     = "nodejs";

// In-memory and per instance; a database-backed allowance replaces this later.
const sttThrottle = createThrottle(120, 60 * 60 * 1000);

const LanguageSchema = z.string().regex(/^[a-zA-Z]{2}$/).optional();

/** Multipart framing adds a little to the file; anything beyond this is over the cap for sure. */
const MAX_BODY_BYTES = MAX_AUDIO_BYTES + 64 * 1024;

export async function POST(req: NextRequest) {
  try {
    const guard = await requireApproved();
    if (guard.error) return guard.error;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "stt_unavailable" }, { status: 503 });
    }

    if (!sttThrottle.take(guard.user.id)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const declared = Number(req.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Audio too large" }, { status: 413 });
    }

    const form = await req.formData().catch(() => null);
    const audio = form?.get("audio");
    if (!form || !(audio instanceof File)) {
      return NextResponse.json({ error: "audio is required" }, { status: 400 });
    }

    const ext = audioExtension(audio.type);
    if (!ext) {
      return NextResponse.json({ error: "Unsupported audio type" }, { status: 415 });
    }
    if (audio.size === 0) {
      return NextResponse.json({ error: "audio is empty" }, { status: 400 });
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "Audio too large" }, { status: 413 });
    }

    const rawLanguage = form.get("language");
    const language = LanguageSchema.safeParse(
      typeof rawLanguage === "string" && rawLanguage !== "" ? rawLanguage : undefined,
    );
    if (!language.success) {
      return NextResponse.json({ error: "Invalid language" }, { status: 400 });
    }

    // Name the file by its real container: the API infers the format from the extension.
    const file = new File([await audio.arrayBuffer()], `audio.${ext}`, { type: audio.type });

    const client = new OpenAI({ apiKey });
    const result = await client.audio.transcriptions.create({
      file,
      model: STT_MODEL,
      ...(language.data ? { language: language.data.toLowerCase() } : {}),
    });

    const seconds = estimateSeconds(audio.size);
    logUsage({
      user_id:         guard.user.id,
      provider:        "openai",
      model:           STT_MODEL,
      feature:         "stt",
      units:           seconds,
      cost_usd_micros: openaiTranscribeCostMicros({ model: STT_MODEL, seconds }),
      metadata:        { bytes: audio.size, seconds },
    });

    return NextResponse.json(
      { text: typeof result?.text === "string" ? result.text : "" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    // Generic body, and no error object logged: its message could echo request content.
    console.error("[/api/stt] transcription failed");
    return NextResponse.json({ error: "stt_failed" }, { status: 500 });
  }
}
