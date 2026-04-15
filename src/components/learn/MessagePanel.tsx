"use client";

import {
  useAristoStore,
  type Message,
  type StructuredMessage,
  type ChatMessage,
} from "@/store/useAristoStore";
import { useEffect, useRef } from "react";

// ─── Structured message card (used in structured teaching flow) ───────────────

function StructuredCard({ message }: { message: StructuredMessage }) {
  return (
    <div className="flex flex-col gap-2 animate-[fade-in_0.4s_ease-out]">
      {/* User question */}
      <div className="self-end max-w-[85%]">
        <div className="px-4 py-2.5 rounded-2xl rounded-tr-sm bg-[#F97B2F] text-white text-sm font-medium shadow-[0_2px_12px_rgba(249,123,47,0.3)]">
          {message.question}
        </div>
      </div>

      {/* Response cards */}
      <div className="self-start w-full flex flex-col gap-2">
        {/* Definition */}
        <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white/80 backdrop-blur-sm border border-white/60 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[#F97B2F] font-bold text-xs">✦</span>
            <span className="text-[#F97B2F] text-[10px] font-bold uppercase tracking-widest">
              Definition
            </span>
          </div>
          <p className="text-[#3D2110] text-sm leading-relaxed font-medium">
            {message.definition}
          </p>
        </div>

        {/* Explanation */}
        <div className="px-4 py-3 rounded-2xl bg-white/55 backdrop-blur-sm border border-white/40">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B6E5A] mb-1.5">
            Explanation
          </p>
          <p className="text-[#3D2110] text-sm leading-relaxed">
            {message.explanation}
          </p>
        </div>

        {/* Example */}
        {message.example && (
          <div className="px-4 py-2.5 rounded-xl bg-[#FDF5EC]/80 border border-[#F4DFC0]/60">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#C4803A] mb-1">
              Example
            </p>
            <p className="text-[#5C3D1E] text-sm leading-relaxed">
              {message.example}
            </p>
          </div>
        )}

        {/* Fun fact */}
        {message.fun_fact && (
          <div className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#FFECD8] to-[#FFF5EC] border border-[#F97B2F]/20">
            <div className="flex gap-2">
              <span className="text-[#F97B2F] font-bold mt-0.5 shrink-0">
                💡
              </span>
              <p className="text-[#5C3D1E] text-sm leading-relaxed">
                {message.fun_fact}
              </p>
            </div>
          </div>
        )}

        {/* 3D model badge */}
        {message.modelUrl && (
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-[#F97B2F] bg-[#FFF0E4] border border-[#F97B2F]/25 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F97B2F]" />
              3D model in scene
            </span>
            {message.annotationHints?.map((hint) => (
              <span
                key={hint}
                className="text-xs text-[#8B6E5A] bg-white/70 border border-[#E8D5BC] rounded-full px-2.5 py-1"
              >
                {hint}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Chat bubble (used in interactive teaching flow) ──────────────────────────

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end animate-[fade-in_0.3s_ease-out]">
        <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-tr-sm bg-[#F97B2F] text-white text-sm font-medium shadow-[0_2px_12px_rgba(249,123,47,0.3)]">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start animate-[fade-in_0.3s_ease-out]">
      <div className="max-w-[92%] flex flex-col gap-1">
        {/* Aristo label */}
        <div className="flex items-center gap-1.5 ml-1 mb-0.5">
          <span className="text-[#F97B2F] text-[10px] font-bold">✦</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#F97B2F]">
            Aristo
          </span>
        </div>
        <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white/80 backdrop-blur-sm border border-white/60 shadow-sm">
          <p className="text-[#3D2110] text-sm leading-relaxed">
            {message.content}
          </p>
        </div>
        {/* Lesson-end divider */}
        {message.isLessonEnd && (
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-px bg-[#F4DFC0]" />
            <span className="text-[10px] text-[#B8957A] font-medium uppercase tracking-widest">
              Topic complete
            </span>
            <div className="flex-1 h-px bg-[#F4DFC0]" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Thinking indicator ───────────────────────────────────────────────────────

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/70 backdrop-blur-sm border border-white/50 shadow-sm w-fit animate-[fade-in_0.2s_ease-out]">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[#F97B2F]"
            style={{
              animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
      <span className="text-sm text-[#8B6E5A]">Aristo is thinking…</span>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ isInteractive }: { isInteractive: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#FFDBB8] to-[#FFF0E4] border border-[#F97B2F]/20 flex items-center justify-center text-2xl shadow-sm">
        ✦
      </div>
      <div>
        <p className="text-[#3D2110] font-bold text-base mb-1">
          Ask Aristo anything!
        </p>
        <p className="text-[#8B6E5A] text-sm leading-relaxed">
          {isInteractive
            ? "Type a topic and Aristo will guide you through it with questions — like a real tutor."
            : "Type a topic below or tap the mic — Aristo will explain it clearly, and may even show a 3D model."}
        </p>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function MessagePanel() {
  const messages = useAristoStore((s) => s.messages);
  const isLoading = useAristoStore((s) => s.isLoading);
  const teachingFlow = useAristoStore((s) => s.teachingFlow);
  const mode = useAristoStore((s) => s.mode);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const isInteractive = teachingFlow === "interactive";

  if (messages.length === 0 && !isLoading) {
    if (mode === "course") {
      // Auto-teach is about to fire — show a neutral placeholder
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#FFDBB8] to-[#FFF0E4] border border-[#F97B2F]/20 flex items-center justify-center text-2xl shadow-sm">
            📖
          </div>
          <p className="text-[#8B6E5A] text-sm">Preparing your lesson…</p>
        </div>
      );
    }
    return <EmptyState isInteractive={isInteractive} />;
  }

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

      <div className="flex flex-col gap-3 px-4 py-4 overflow-y-auto h-full">
        {messages.map((msg, i) => {
          if (msg.type === "chat") {
            return <ChatBubble key={msg.id} message={msg} />;
          }

          // Structured message — add divider between topics
          return (
            <div key={msg.id}>
              {i > 0 && messages[i - 1]?.type === "structured" && (
                <hr className="border-white/30 mb-3" />
              )}
              <StructuredCard message={msg} />
            </div>
          );
        })}

        {isLoading && (
          <div className="flex flex-col gap-2">
            <ThinkingIndicator />
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </>
  );
}
