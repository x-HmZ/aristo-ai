/**
 * Which speech-to-text engine voice input uses. Pure so it can be tested without a browser.
 *
 * NEXT_PUBLIC_STT_ENGINE is "browser" (default: the Web Speech API) or "server" (record with
 * MediaRecorder and transcribe through /api/stt). "server" needs a recorder; where the browser
 * lacks one it degrades to the browser engine, and to "none" when neither exists.
 */
export type SttEngine = "browser" | "server" | "none";

export interface SttCapabilities {
  /** MediaRecorder and getUserMedia are available. */
  recorder:      boolean;
  /** SpeechRecognition or webkitSpeechRecognition is available. */
  browserSpeech: boolean;
}

export function selectSttEngine(raw: string | undefined, caps: SttCapabilities): SttEngine {
  const wantsServer = typeof raw === "string" && raw.trim().toLowerCase() === "server";
  if (wantsServer && caps.recorder) return "server";
  return caps.browserSpeech ? "browser" : "none";
}
