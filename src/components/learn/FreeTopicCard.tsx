"use client";

/**
 * FreeTopicCard — the free-mode answer to LessonView's PhaseCard set.
 *
 * The /api/teach route returns a structured response
 * (definition / explanation / example / fun_fact), but the legacy free-mode
 * UI flattened it into a single chat bubble.  This component renders the
 * same content as a stack of pastel-orange phase cards so the visual
 * language matches the course-mode lesson player.
 *
 * Each section uses the same colour accents as the corresponding lesson
 * phase so a student moving between free explore and course mode never
 * loses their place visually:
 *   • Definition  → orange (matches Explain)
 *   • Explanation → white (neutral body card)
 *   • Example     → green (matches Demonstrate)
 *   • Fun fact    → amber (matches the Explain key-insight callout)
 */

import type { ChatMessage } from "@/store/useAristoStore";
import { useEffect, useMemo, useRef } from "react";
import { useTTS } from "@/hooks/useTTS";
import { useAristoStore } from "@/store/useAristoStore";

// ─── Card shell (mirrors LessonView's PhaseCard) ─────────────────────────────

function FreeCard({
  label,
  accent,
  children,
}: {
  label:    string;
  accent:   string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur-sm border border-white/60 shadow-sm overflow-hidden animate-[fade-in_0.4s_ease-out]">
      <div
        className="px-4 py-2 flex items-center gap-2"
        style={{ backgroundColor: `${accent}18`, borderBottom: `1px solid ${accent}30` }}
      >
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>
          {label}
        </span>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

// ─── Parser — pull the structured fields back out of the chat-message body ───
//
// /api/teach returns { definition, explanation, example, fun_fact, … } and
// InputBox flattens it into a markdown-ish bubble:
//
//   **Definition:** …
//
//   **Explanation:** …
//
// To avoid changing the network shape we just split the bubble back into its
// sections here.  Any unknown content falls into a generic "Content" card.
//
// (When we later refactor the chat slice to store the raw object, this
// parser becomes a no-op and we read `msg.structured` directly.)

interface ParsedTopic {
  definition?:  string;
  explanation?: string;
  example?:     string;
  fun_fact?:    string;
  fallback?:    string;
}

function parseStructuredBubble(content: string): ParsedTopic {
  const out: ParsedTopic = {};
  const sections = content.split(/\n{2,}/);
  let matched = false;
  for (const raw of sections) {
    const section = raw.trim();
    // [\s\S] used instead of the /s dotAll flag for ES2017 target compatibility.
    const m = /^\*\*([^*]+):\*\*\s*([\s\S]+)$/.exec(section);
    if (!m) continue;
    const key  = m[1].toLowerCase().trim();
    const body = m[2].trim();
    if      (key === "definition")  { out.definition  = body; matched = true; }
    else if (key === "explanation") { out.explanation = body; matched = true; }
    else if (key === "example")     { out.example     = body; matched = true; }
    else if (key === "fun fact")    { out.fun_fact    = body; matched = true; }
  }
  if (!matched) out.fallback = content;
  return out;
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface FreeTopicCardProps {
  message: ChatMessage;
  /** True for the most recent assistant card — auto-narrates on mount. */
  isLatest?: boolean;
}

export function FreeTopicCard({ message, isLatest = false }: FreeTopicCardProps) {
  const parsed = useMemo(() => parseStructuredBubble(message.content), [message.content]);
  const { speak }     = useTTS();
  const setIsSpeaking = useAristoStore((s) => s.setIsSpeaking);
  const setGesture    = useAristoStore((s) => s.setGesture);
  const ttsRef        = useRef<ReturnType<typeof speak> | null>(null);

  // Auto-narrate the explanation when this card first lands.  We keep the
  // narration short — definition + explanation only — so the avatar stops
  // talking before the student starts reading the example/fun-fact at their
  // own pace.  Mirrors the course-mode TTS lifecycle exactly.
  useEffect(() => {
    if (!isLatest) return;
    const text = [parsed.definition, parsed.explanation].filter(Boolean).join(" ").trim();
    const speakText = text || parsed.fallback || message.content;
    if (!speakText) return;

    setIsSpeaking(true);
    setGesture("explaining");
    ttsRef.current = speak(speakText, {
      onEnd: () => {
        setIsSpeaking(false);
        setGesture("idle");
      },
    });
    return () => {
      ttsRef.current?.stop();
      setIsSpeaking(false);
      setGesture("idle");
    };
    // We deliberately re-run only when the message id changes — never on
    // every parent re-render (which would re-trigger TTS).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id]);

  // Generic fallback when the structured parse fails (unmatched free-form
  // bubbles, e.g. error responses): keep the original chat-style card so
  // information is never lost.
  if (parsed.fallback) {
    return (
      <FreeCard label="Aristo says" accent="#F97B2F">
        <p className="text-sm text-[#3D2110] leading-relaxed whitespace-pre-wrap">
          {parsed.fallback}
        </p>
      </FreeCard>
    );
  }

  return (
    <div className="flex flex-col gap-3 animate-[fade-in_0.3s_ease-out]">
      {parsed.definition && (
        <FreeCard label="Definition" accent="#F97B2F">
          <p className="text-sm text-[#3D2110] leading-relaxed">{parsed.definition}</p>
        </FreeCard>
      )}

      {parsed.explanation && (
        <FreeCard label="Explanation" accent="#F97B2F">
          {/* Soft accent border that "lights up" while the avatar narrates
              this section — matches SegmentScript's active-segment style. */}
          <p className="text-sm text-[#3D2110] leading-relaxed">{parsed.explanation}</p>
        </FreeCard>
      )}

      {parsed.example && (
        <FreeCard label="Example" accent="#10B981">
          <div className="px-3 py-2.5 rounded-xl bg-[#F0FDF4] border border-[#86EFAC]/35">
            <p className="text-sm text-[#15803D] leading-relaxed">{parsed.example}</p>
          </div>
        </FreeCard>
      )}

      {parsed.fun_fact && (
        <FreeCard label="Fun fact" accent="#F59E0B">
          <div className="flex gap-2 px-3 py-2 rounded-xl bg-[#FFFBEB] border border-[#FCD34D]/40">
            <span className="text-base shrink-0">💡</span>
            <p className="text-sm text-[#92400E] leading-relaxed">{parsed.fun_fact}</p>
          </div>
        </FreeCard>
      )}
    </div>
  );
}

// ─── User bubble — kept on the right side for chat continuity ────────────────

export function FreeUserBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="flex justify-end animate-[fade-in_0.3s_ease-out]">
      <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-tr-sm bg-[#F97B2F] text-white text-sm font-medium shadow-[0_2px_12px_rgba(249,123,47,0.3)]">
        {message.content}
      </div>
    </div>
  );
}
