"use client";

/**
 * AnswerInputPanel — the student-facing response widget that opens when the
 * avatar finishes asking a challenge question.
 *
 * Blends three input modes:
 *  • A) Inline text box (Enter to submit, focused on mount).
 *  • B) Anchored to the avatar via a 3D speech-bubble (rendered separately in
 *       Experience.tsx — this component is the actual interactive surface
 *       in the right panel where typing makes sense).
 *  • C) Auto-opened microphone with silence-submit. As soon as the panel
 *       mounts we ask the Web Speech API to listen; if the user pauses for
 *       1.5 s with non-empty interim text we auto-submit, otherwise we hand
 *       control back to the text box on error / "speak again" tap.
 *
 * The submit handler is provided by useLessonPlayback.submitAnswer — it fires
 * /api/learn/challenge for misconception telemetry, sets a nod/shake gesture,
 * and releases the playback gate so the next segment (challenge_reveal) plays.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { NarrationSegment } from "@/lib/agents/teaching";
import type { SpeechRecognitionInstance } from "@/lib/speech";
import "@/lib/speech";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AnswerInputPanelProps {
  /** The challenge segment whose narration just ended. */
  segment:      NarrationSegment;
  /** Called when the student submits — returns once the next segment is queued. */
  onSubmit:     (answer: string) => Promise<void>;
  /** Optional skip — equivalent to pressing the playback "Next" button. */
  onSkip?:      () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const SILENCE_SUBMIT_MS = 1500;

export function AnswerInputPanel({ segment, onSubmit, onSkip }: AnswerInputPanelProps) {
  const [answer,      setAnswer]      = useState("");
  const [isListening, setIsListening] = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [micError,    setMicError]    = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const silenceTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);
  const submittedRef   = useRef(false);

  // Submit guard so silence-timer + onSubmit + Enter don't race.
  const doSubmit = useCallback(async (value: string) => {
    if (submittedRef.current) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      recognitionRef.current?.abort();
    } catch { /* ignore */ }
    if (silenceTimer.current) {
      clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    }
    await onSubmit(trimmed);
    // After submit the parent unmounts this component, so no need to reset state.
  }, [onSubmit]);

  // Auto-open the mic on mount (Option C) — falls back silently if the browser
  // doesn't support Web Speech (Firefox, some Safari).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      setMicError("mic-unsupported");
      // Focus the textarea instead so the student can still type.
      inputRef.current?.focus();
      return;
    }

    const rec = new Ctor();
    rec.lang           = "en-US";
    rec.continuous     = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      // Concatenate all results into a single transcript — Web Speech delivers
      // interim chunks while the user is mid-sentence and finalised chunks
      // when it detects a phrase boundary.
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0]?.transcript ?? "";
      }
      const cleaned = transcript.trim();
      if (cleaned) {
        setAnswer(cleaned);
        // Reset the silence-submit countdown each time we hear new audio.
        if (silenceTimer.current) clearTimeout(silenceTimer.current);
        silenceTimer.current = setTimeout(() => {
          doSubmit(cleaned);
        }, SILENCE_SUBMIT_MS);
      }
    };

    rec.onerror = (ev) => {
      // Common cases: "not-allowed" (mic permission), "no-speech" (silence).
      // We surface a short message and refocus the textarea.
      const err = (ev as Event & { error?: string }).error ?? "mic-error";
      setMicError(err);
      setIsListening(false);
      inputRef.current?.focus();
    };

    rec.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setIsListening(true);
    } catch {
      // Some browsers throw if start() is called twice; treat as benign.
      setIsListening(false);
    }

    return () => {
      try { rec.abort(); } catch { /* ignore */ }
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment.id]);

  // Toggle the mic on/off when the student taps the button.
  const toggleListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (isListening) {
      try { rec.stop(); } catch { /* ignore */ }
      setIsListening(false);
      return;
    }
    try {
      rec.start();
      setIsListening(true);
      setMicError(null);
    } catch {
      setIsListening(false);
    }
  }, [isListening]);

  const handleSubmit = () => { doSubmit(answer); };

  return (
    <div className="px-4 py-3 bg-white/55 backdrop-blur-xl border-t border-[#F97B2F]/30 rounded-b-2xl shadow-[inset_0_1px_0_rgba(249,123,47,0.18)]">
      {/* Avatar prompt strip */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#C45A10]">
          Your turn
        </span>
        <span className="text-[10px] text-[#8B6E5A]">
          {isListening
            ? "Listening… pause when you're done"
            : micError === "mic-unsupported"
            ? "Type your answer below"
            : "Speak or type your answer"}
        </span>
        {onSkip && (
          <button
            onClick={onSkip}
            className="ml-auto text-[10px] text-[#8B6E5A] hover:text-[#3D2110] underline underline-offset-2"
            title="Skip this question"
          >
            Skip
          </button>
        )}
      </div>

      <div className="flex items-end gap-2">
        {/* Mic toggle */}
        <button
          onClick={toggleListening}
          disabled={submitting || micError === "mic-unsupported"}
          title={isListening ? "Stop listening" : "Speak"}
          className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 border ${
            isListening
              ? "bg-[#F97B2F] border-[#F97B2F] text-white shadow-[0_0_18px_rgba(249,123,47,0.55)] animate-pulse"
              : "bg-white/70 border-white/60 text-[#8B6E5A] hover:border-[#F97B2F]/40 hover:text-[#F97B2F] hover:bg-[#FFF5EC]"
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {isListening ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
            </svg>
          )}
        </button>

        {/* Text input (textarea so multi-line answers don't get cut off) */}
        <textarea
          ref={inputRef}
          value={answer}
          onChange={(e) => {
            setAnswer(e.target.value);
            // If the student starts typing while the mic is listening, the
            // silence timer would race against keystrokes — cancel it.
            if (silenceTimer.current) {
              clearTimeout(silenceTimer.current);
              silenceTimer.current = null;
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={isListening ? "Listening…" : "Type your answer…"}
          rows={2}
          disabled={submitting}
          className="aristo-scroll flex-1 px-3 py-2 rounded-2xl bg-white/85 border border-white/60 text-sm text-[#3D2110] placeholder:text-[#B8957A] focus:outline-none focus:ring-2 focus:ring-[#F97B2F]/35 focus:border-[#F97B2F]/50 disabled:opacity-50 transition-all resize-none"
        />

        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !answer.trim()}
          title="Submit answer"
          className="shrink-0 h-9 px-3 rounded-full bg-[#F97B2F] flex items-center justify-center text-white text-xs font-semibold shadow-[0_2px_12px_rgba(249,123,47,0.35)] hover:bg-[#E06A20] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {submitting ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            "Submit"
          )}
        </button>
      </div>
    </div>
  );
}
