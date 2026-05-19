"use client";

import { useAristoStore }                  from "@/store/useAristoStore";
import { LessonView }                       from "@/components/learn/LessonView";
import { LessonPlayer, ADAPTIVE_VISUALS_ENABLED } from "@/components/learn/LessonPlayer";
import { FreeTopicCard, FreeUserBubble }    from "@/components/learn/FreeTopicCard";
import { useEffect, useRef }                from "react";

// ─── Thinking indicator ───────────────────────────────────────────────────────

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/70 backdrop-blur-sm border border-white/50 shadow-sm w-fit animate-[fade-in_0.2s_ease-out]">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[#F97B2F]"
            style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
      <span className="text-sm text-[#8B6E5A]">Aristo is thinking…</span>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#FFDBB8] to-[#FFF0E4] border border-[#F97B2F]/20 flex items-center justify-center text-2xl shadow-sm">
        ✦
      </div>
      <div>
        <p className="text-[#3D2110] font-bold text-base mb-1">Ask Aristo anything!</p>
        <p className="text-[#8B6E5A] text-sm leading-relaxed">
          Type a topic below or tap the mic — Aristo will explain it clearly, and may even show a 3D model.
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
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#FFDBB8] to-[#FFF0E4] border border-[#F97B2F]/20 flex items-center justify-center text-2xl shadow-sm">
          📖
        </div>
        <p className="text-[#8B6E5A] text-sm">Preparing your lesson…</p>
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
