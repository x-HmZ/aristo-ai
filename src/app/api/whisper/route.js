import OpenAI from "openai";
import { requireApproved } from "@/lib/auth/approval";

// Planned upgrade path for voice input (the app uses the browser's Web Speech API today). Nothing calls this
// route yet. It spends OpenAI credit, so it is closed to anyone who is not a signed-in, approved user.

const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

const json = (body, status) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export async function POST(req) {
  const guard = await requireApproved();
  if (guard.error) return guard.error;

  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio");

    if (!audioFile || typeof audioFile === "string") {
      return json({ error: "No audio file provided" }, 400);
    }
    if (audioFile.size > MAX_AUDIO_BYTES) {
      return json({ error: "Audio file too large" }, 413);
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const file = new File([audioFile], "audio.webm", { type: "audio/webm" });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      temperature: 0.2,
      response_format: "verbose_json",
      prompt: "Transcribe the following audio exactly as spoken, without translation or interpretation.",
    });

    return json({ text: transcription.text, segments: transcription.segments || [] }, 200);
  } catch (error) {
    console.error("Error in Whisper transcription:", error);
    return json({ error: "Transcription failed" }, 500);
  }
}
