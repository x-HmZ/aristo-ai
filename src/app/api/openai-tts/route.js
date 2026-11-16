export const dynamic = "force-dynamic";

import OpenAI from "openai";
import { requireApproved } from "@/lib/auth/approval";

// Planned upgrade path for speech (the app speaks through /api/tts today). Nothing calls this route yet.
// It spends OpenAI credit, so it is closed to anyone who is not a signed-in, approved user, and it is a POST
// so that a link opened in an approved user's browser cannot trigger a paid call.

const MAX_TEXT_CHARS = 1000;
const VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];

const json = (body, status) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export async function POST(req) {
  const guard = await requireApproved();
  if (guard.error) return guard.error;

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const text = typeof body?.text === "string" ? body.text : "";
  const voice = VOICES.includes(body?.voice) ? body.voice : "nova";

  if (!text) {
    return json({ error: "No text provided" }, 400);
  }
  if (text.length > MAX_TEXT_CHARS) {
    return json({ error: "Text too long" }, 413);
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const mp3 = await openai.audio.speech.create({ model: "tts-1", voice, input: text });
    const buffer = Buffer.from(await mp3.arrayBuffer());

    return new Response(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": "inline; filename=tts.mp3",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error in OpenAI TTS:", error);
    return json({ error: "TTS failed" }, 500);
  }
}
