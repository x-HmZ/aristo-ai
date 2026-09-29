"use client";

import { useAristoStore }                  from "@/store/useAristoStore";
import { LessonView }                       from "@/components/learn/LessonView";
import { LessonPlayer, ADAPTIVE_VISUALS_ENABLED } from "@/components/learn/LessonPlayer";
import { FreeTopicCard, FreeUserBubble }    from "@/components/learn/FreeTopicCard";
import { useEffect, useRef }                from "react";
import { BookOpen }                         from "lucide-react";
import { AristoMark } from "@/components/brand/AristoMark";

// ─── Thinking indicator ───────────────────────────────────────────────────────

function ThinkingIndicator() {
  return (
    <div
      role="status"
      className="flex w-fit items-center gap-2 rounded-full border border-line bg-surface/95 px-4 py-2.5 shadow-e1 backdrop-blur-sm motion-safe:animate-[fade-in_0.2s_ease-out]"
    >
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="aristo-thinking-dot size-1.5 rounded-full bg-accent"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
      <span className="text-sm text-muted">Aristo is thinking…</span>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-bg/95 px-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-full border border-tint-line bg-tint">
        <AristoMark
          variant="column"
          className="h-7 text-ink"
          litClassName="text-accent"
        />
      </div>
      <div>
        <h2 className="mb-1 text-base font-bold text-ink">What Do You Want to Learn?</h2>
        <p className="text-sm leading-relaxed text-body">
          Type a topic below, or tap the mic and say it. Your teacher explains it out loud and shows it on the board.
        </p>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function MessagePanel() {
  const activeLesson = useAristoStore((s) => s.activeLesson);
  const messages     = useAristoStore((s) => s.messages);
  const isLoading    = useAristoStore((s) => s.isLoading);
  const mode         = useAristoStore((s) => s.mode);
  const bottomRef    = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Course mode with a loaded lesson — adaptive flag picks the playback path.
  // Adaptive: LessonPlayer mounts useLessonPlayback and drives narration per
  // segment with per-moment visuals.  Legacy: LessonView owns its own TTS
  // and a single topic-wide image.  The adaptive path falls back to the
  // legacy synthesised-segments shim if the lesson came in without segments.
  if (mode === "course" && activeLesson) {
    if (ADAPTIVE_VISUALS_ENABLED) return <LessonPlayer />;
    return <LessonView />;
  }

  // Course mode, lesson still loading
  if (mode === "course" && isLoading) {
    return (
      <div role="status" className="flex h-full flex-col items-center justify-center gap-3 bg-bg/95 px-8 text-center">
        <div className="flex size-14 items-center justify-center rounded-full border border-tint-line bg-tint">
          <BookOpen aria-hidden className="size-6 text-accent-text" />
        </div>
        <p className="text-sm text-muted">Preparing your lesson…</p>
      </div>
    );
  }

  // Free mode — no messages yet
  if (messages.length === 0 && !isLoading) {
    return <EmptyState />;
  }

  // Free mode — structured topic cards (mirrors the course-mode LessonView
  // visual language so users moving between modes feel continuity).  The
  // most recent assistant card auto-narrates via the same useTTS pipeline
  // that powers course-mode lessons.
  const latestAssistantId = [...messages]
    .reverse()
    .find((m) => m.role === "assistant")?.id;

  return (
    <>
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .aristo-thinking-dot { animation: bounce 1.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .aristo-thinking-dot { animation: none; }
        }
      `}</style>

      <div className="aristo-scroll flex flex-col gap-3 px-4 py-4 overflow-y-auto h-full">
        {messages.map((msg) =>
          msg.role === "user" ? (
            <FreeUserBubble key={msg.id} message={msg} />
          ) : (
            <FreeTopicCard
              key={msg.id}
              message={msg}
              isLatest={msg.id === latestAssistantId}
            />
          )
        )}
        {isLoading && <ThinkingIndicator />}
        <div ref={bottomRef} />
      </div>
    </>
  );
}
