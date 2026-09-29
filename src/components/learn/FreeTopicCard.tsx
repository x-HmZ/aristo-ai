"use client";

/**
 * FreeTopicCard — the free-mode answer to LessonView's PhaseCard set.
 *
 * The /api/teach route returns a structured response
 * (definition / explanation / example / fun_fact), but the legacy free-mode
 * UI flattened it into a single chat bubble.  This component renders the
 * same content as a stack of cards so the visual language matches the
 * course-mode lesson player.
 *
 * On the design system (V8.4c), like LessonView's cards: sections are told
 * apart by an icon and a label, not a colour.
 *   • Definition, Explanation → neutral surface cards
 *   • Example     → ink on the warm tint (LessonView's hint and analogy)
 *   • Fun fact    → warning on its tint with a Lightbulb (the key insight)
 */

import type { ChatMessage } from "@/store/useAristoStore";
import { useEffect, useMemo, useRef } from "react";
import { AudioLines, BookOpen, Lightbulb, MessageSquareText, Shapes } from "lucide-react";
import { useTTS } from "@/hooks/useTTS";
import { useAristoStore } from "@/store/useAristoStore";
import { SHAPE } from "@/lib/design/shape";
import { cn } from "@/lib/utils";

// ─── Card shell (mirrors LessonView's cards) ─────────────────────────────────

function FreeCard({
  label,
  icon: Icon,
  children,
}: {
  label:    string;
  icon:     typeof BookOpen;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(SHAPE.surface, "overflow-hidden border border-line bg-surface motion-safe:animate-[fade-in_0.4s_ease-out]")}>
      <div className="flex items-center gap-2 border-b border-line px-4 py-2">
        <Icon aria-hidden className="size-4 text-accent-text" />
        <span className="text-xs font-semibold text-muted">{label}</span>
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
      <FreeCard label="Aristo says" icon={MessageSquareText}>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
          {parsed.fallback}
        </p>
      </FreeCard>
    );
  }

  return (
    <div className="flex flex-col gap-3 motion-safe:animate-[fade-in_0.3s_ease-out]">
      {parsed.definition && (
        <FreeCard label="Definition" icon={BookOpen}>
          <p className="text-sm leading-relaxed text-ink">{parsed.definition}</p>
        </FreeCard>
      )}

      {parsed.explanation && (
        <FreeCard label="Explanation" icon={AudioLines}>
          <p className="text-sm leading-relaxed text-ink">{parsed.explanation}</p>
        </FreeCard>
      )}

      {parsed.example && (
        <FreeCard label="Example" icon={Shapes}>
          <div className={cn(SHAPE.control, "border border-tint-line bg-tint px-3 py-2.5")}>
            <p className="text-sm leading-relaxed text-ink">{parsed.example}</p>
          </div>
        </FreeCard>
      )}

      {parsed.fun_fact && (
        <FreeCard label="Fun fact" icon={Lightbulb}>
          <div className={cn(SHAPE.control, "flex gap-2 border border-warning/25 bg-warning/10 px-3 py-2")}>
            <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
            <p className="text-sm leading-relaxed text-warning">{parsed.fun_fact}</p>
          </div>
        </FreeCard>
      )}
    </div>
  );
}

// ─── User bubble — kept on the right side for chat continuity ────────────────

// The warm tint, not the accent: the accent fill is kept for the one primary
// action in view (the send button below).
export function FreeUserBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="flex justify-end motion-safe:animate-[fade-in_0.3s_ease-out]">
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm border border-tint-line bg-tint px-4 py-2.5 text-sm font-medium text-ink">
        {message.content}
      </div>
    </div>
  );
}
