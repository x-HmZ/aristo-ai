/**
 * Shared Web Speech API typings.
 *
 * Declared once here so multiple components (InputBox, AnswerInputPanel, …)
 * can `import "@/lib/speech"` without re-declaring `window.SpeechRecognition`
 * — duplicate global declarations with structurally-identical-but-distinct
 * interface bodies are a TS2717 error.
 */

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
}

declare global {
  interface Window {
    SpeechRecognition?:       new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}
