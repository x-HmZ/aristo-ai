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
import { LoaderCircle, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
    <div className="rounded-b-2xl border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-md">
      {/* Avatar prompt strip */}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-semibold text-accent-text">
          Your turn
        </span>
        <span className="text-xs text-muted" aria-live="polite">
          {isListening
            ? "Listening… pause when you're done"
            : micError === "mic-unsupported"
            ? "Type your answer below"
            : "Speak or type your answer"}
        </span>
        {onSkip && (
          <Button
            variant="ghost"
            onClick={onSkip}
            className="ml-auto px-3 text-body"
            title="Skip this question"
          >
            Skip
          </Button>
        )}
      </div>

      <div className="flex items-end gap-2">
        {/* Mic toggle. Listening is the accent fill, the stop icon and the status text; the
            pulse is motion-safe so a reduced-motion reader still sees a ring. */}
        <Button
          variant={isListening ? "default" : "secondary"}
          size="icon"
          onClick={toggleListening}
          disabled={submitting || micError === "mic-unsupported"}
          title={isListening ? "Stop listening" : "Speak"}
          aria-label="Speak"
          aria-pressed={isListening}
          className={cn("shrink-0", isListening && "ring-2 ring-accent-text ring-offset-2 ring-offset-surface motion-safe:animate-pulse")}
        >
          {isListening ? <Square aria-hidden fill="currentColor" /> : <Mic aria-hidden />}
        </Button>

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
          className="aristo-scroll min-h-11 flex-1 resize-none rounded-[10px] border border-line bg-surface px-3.5 py-2 text-base text-ink transition-colors duration-fast placeholder:text-muted hover:border-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-text focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50 md:text-sm"
        />

        {/* Send button */}
        <Button
          onClick={handleSubmit}
          disabled={submitting || !answer.trim()}
          title="Submit answer"
          className="shrink-0"
        >
          {submitting ? (
            <>
              <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
              Sending…
            </>
          ) : (
            "Submit"
          )}
        </Button>
      </div>
    </div>
  );
}
