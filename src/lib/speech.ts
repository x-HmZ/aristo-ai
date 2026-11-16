/**
 * Shared Web Speech API typings.
 *
 * Declared once here so multiple components (InputBox, AnswerInputPanel, …)
 * can `import "@/lib/speech"` without re-declaring `window.SpeechRecognition`
 * — duplicate global declarations with structurally-identical-but-distinct
 * interface bodies are a TS2717 error.
 */

import { selectSttEngine } from "@/lib/stt/engine";
import { ServerRecognition } from "@/lib/stt/serverRecognition";

export interface SpeechRecognitionAlternative {
  transcript: string;
  confidence?: number;
}

export interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

export interface SpeechRecognitionResultList {
  length:               number;
  [index: number]:      SpeechRecognitionResult;
}

export interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionErrorEvent extends Event {
  error?: string;
}

export interface SpeechRecognitionInstance extends EventTarget {
  lang:           string;
  continuous:     boolean;
  interimResults: boolean;
  start():        void;
  stop():         void;
  abort():        void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror:  ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend:    ((e: Event) => void) | null;
  /** Set by the server engine only; absent on a native instance (which is the browser engine). */
  engine?:        "browser" | "server";
  /** Server engine only: fires as the recording moves between idle, recording and transcribing. */
  onstatechange?: ((s: "idle" | "recording" | "transcribing") => void) | null;
}

/**
 * The one place the components get a recogniser from. Returns the engine chosen by
 * NEXT_PUBLIC_STT_ENGINE ("browser" default, "server"), or null when voice input is impossible.
 * Both engines satisfy SpeechRecognitionInstance, so callers need not know which they got.
 */
export function createSpeechRecognition(): SpeechRecognitionInstance | null {
  if (typeof window === "undefined") return null;
  const Native = window.SpeechRecognition || window.webkitSpeechRecognition;
  const engine = selectSttEngine(process.env.NEXT_PUBLIC_STT_ENGINE, {
    recorder:      typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia,
    browserSpeech: !!Native,
  });
  if (engine === "server") return new ServerRecognition(Native);
  if (engine === "browser" && Native) return new Native();
  return null;
}

/** True when voice input can work at all in this browser with the configured engine. */
export function speechInputAvailable(): boolean {
  return createSpeechRecognition() !== null;
}

declare global {
  interface Window {
    SpeechRecognition?:       new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}
