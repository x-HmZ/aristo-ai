import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import { PassThrough } from "stream";

export async function GET(req) {
  const start = Date.now();
  console.log('Starting TTS request');
  
  const speechConfig = sdk.SpeechConfig.fromSubscription(
    "485540e86595451da1417300ec47bb4e", "eastasia"
  );

  const teacher = req.nextUrl.searchParams.get("teacher") || "Sonia";
  speechConfig.speechSynthesisVoiceName = `en-GB-${teacher}Neural`;

  const speechSynthesizer = new sdk.SpeechSynthesizer(speechConfig);
  const visemes = [];
  speechSynthesizer.visemeReceived = function (s, e) {
    visemes.push([e.audioOffset / 10000, e.visemeId]);
  };

  try {
    const audioStream = await new Promise((resolve, reject) => {
      speechSynthesizer.speakTextAsync(
        req.nextUrl.searchParams.get("text") || "I'm excited to try text to speech",
        (result) => {
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            const { audioData } = result;
            speechSynthesizer.close();
            const bufferStream = new PassThrough();
            bufferStream.end(Buffer.from(audioData));
            resolve(bufferStream);
          } else {
            reject(result.errorDetails);
          }
        },
        (error) => {
          console.error("Speech synthesis error:", error);
          speechSynthesizer.close();
          reject(error);
        }
      );
    });

    const response = new Response(audioStream, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `inline; filename=tts.mp3`,
        Visemes: JSON.stringify(visemes),
      },
    });
    
    console.log('TTS request completed in', Date.now() - start, 'ms');
    return response;
  } catch (error) {
    console.error("Error during TTS:", error);
    return new Response(JSON.stringify({ error: "TTS failed", details: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}
