export const dynamic = 'force-dynamic';

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY
});

export async function GET(req) {
  try {
    const text = req.nextUrl.searchParams.get("text");
    const voice = req.nextUrl.searchParams.get("voice") || "nova"; 

    if (!text) {
      return new Response(JSON.stringify({ error: "No text provided" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: voice,
      input: text,
    });

    // Convert the response to a buffer
    const buffer = Buffer.from(await mp3.arrayBuffer());

    // Return the audio file
    return new Response(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': 'inline; filename=tts.mp3',
      },
    });
  } catch (error) {
    console.error("Error in OpenAI TTS:", error);
    return new Response(JSON.stringify({ error: "TTS failed", details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 