"use client";

import {
  useAristoStore,
  type StructuredMessage,
  type ChatMessage,
} from "@/store/useAristoStore";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Web Speech API types ─────────────────────────────────────────────────────

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: ((e: Event) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function speakText(text: string, onStart: () => void, onEnd: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.05;
  utterance.pitch = 1.05;
  utterance.onstart = onStart;
  utterance.onend = onEnd;
  window.speechSynthesis.speak(utterance);
}

// ─── Main component ───────────────────────────────────────────────────────────

export function InputBox() {
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const learningStyle = useAristoStore((s) => s.learningStyle);
  const teachingFlow = useAristoStore((s) => s.teachingFlow);
  const messages = useAristoStore((s) => s.messages);
  const isLoading = useAristoStore((s) => s.isLoading);
  const isGeneratingModel = useAristoStore((s) => s.isGeneratingModel);

  const addMessage = useAristoStore((s) => s.addMessage);
  const setIsLoading = useAristoStore((s) => s.setIsLoading);
  const setIsSpeaking = useAristoStore((s) => s.setIsSpeaking);
  const setActiveModelUrl = useAristoStore((s) => s.setActiveModelUrl);
  const setIsGeneratingModel = useAristoStore((s) => s.setIsGeneratingModel);

  const isBusy = isLoading || isGeneratingModel;
  const isInteractive = teachingFlow === "interactive";

  // Determine if the last Aristo message is waiting for a student response
  const lastMsg = messages[messages.length - 1];
  const isAnsweringQuestion =
    isInteractive &&
    lastMsg?.type === "chat" &&
    lastMsg.role === "assistant";

  // ── Interactive mode handler ────────────────────────────────────────────────

  const handleSubmitInteractive = useCallback(
    async (userInput: string) => {
      const trimmed = userInput.trim();
      if (!trimmed || isBusy) return;
      setInput("");

      // Add the user's chat bubble immediately
      const userMsg: ChatMessage = {
        id: `msg_${Date.now()}_user`,
        type: "chat",
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };
      addMessage(userMsg);
      setIsLoading(true);

      try {
        // Build conversation history from existing chat messages + this new one
        const chatHistory = messages
          .filter((m): m is ChatMessage => m.type === "chat")
          .map((m) => ({ role: m.role, content: m.content }));
        chatHistory.push({ role: "user", content: trimmed });

        const res = await fetch("/api/teach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teachingFlow: "interactive",
            learningStyle,
            messages: chatHistory,
          }),
        });

        if (!res.ok) throw new Error("Teaching API failed");

        const data: {
          message: string;
          has_question: boolean;
          is_lesson_complete: boolean;
        } = await res.json();

        setIsLoading(false);

        const aristoMsg: ChatMessage = {
          id: `msg_${Date.now()}_ai`,
          type: "chat",
          role: "assistant",
          content: data.message,
          isLessonEnd: data.is_lesson_complete,
          timestamp: Date.now(),
        };
        addMessage(aristoMsg);

        speakText(
          data.message,
          () => setIsSpeaking(true),
          () => setIsSpeaking(false)
        );
      } catch (err) {
        console.error("Interactive submit error:", err);
        setIsLoading(false);
      }
    },
    [
      isBusy,
      messages,
      learningStyle,
      addMessage,
      setIsLoading,
      setIsSpeaking,
    ]
  );

  // ── Structured mode handler ─────────────────────────────────────────────────

  const handleSubmitStructured = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || isBusy) return;
      setInput("");
      setIsLoading(true);

      try {
        const history = messages
          .filter((m): m is StructuredMessage => m.type === "structured")
          .map((m) => m.question);

        const teachRes = await fetch("/api/teach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: trimmed,
            learningStyle,
            teachingFlow: "structured",
            history,
          }),
        });

        if (!teachRes.ok) throw new Error("Teaching API failed");

        const teach = await teachRes.json();
        setIsLoading(false);

        const msgId = `msg_${Date.now()}`;
        const newMessage: StructuredMessage = {
          id: msgId,
          type: "structured",
          question: trimmed,
          definition: teach.definition,
          explanation: teach.explanation,
          example: teach.example,
          fun_fact: teach.fun_fact,
          annotationHints: teach.annotation_hints ?? [],
          timestamp: Date.now(),
        };

        const textToSpeak = `${teach.definition} ${teach.explanation}`;
        speakText(
          textToSpeak,
          () => setIsSpeaking(true),
          () => setIsSpeaking(false)
        );

        if (teach.should_generate_model && teach.model_image_prompt) {
          setIsGeneratingModel(true);
          addMessage(newMessage);

          try {
            const modelRes = await fetch("/api/generate-model", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                imagePrompt: teach.model_image_prompt,
                topic: trimmed,
              }),
            });

            if (modelRes.ok) {
              const { modelUrl, imageUrl } = await modelRes.json();
              const updatedMessages = useAristoStore
                .getState()
                .messages.map((m) =>
                  m.id === msgId ? { ...m, modelUrl, imageUrl } : m
                );
              useAristoStore.setState({ messages: updatedMessages });
              setActiveModelUrl(modelUrl);
            }
          } catch (err) {
            console.error("Model generation failed:", err);
          } finally {
            setIsGeneratingModel(false);
          }
        } else {
          addMessage(newMessage);
          setActiveModelUrl(null);
        }
      } catch (err) {
        console.error("Structured submit error:", err);
        setIsLoading(false);
      }
    },
    [
      isBusy,
      messages,
      learningStyle,
      addMessage,
      setIsLoading,
      setIsSpeaking,
      setActiveModelUrl,
      setIsGeneratingModel,
    ]
  );

  // ── Unified submit ──────────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    (value: string) => {
      if (isInteractive) {
        handleSubmitInteractive(value);
      } else {
        handleSubmitStructured(value);
      }
    },
    [isInteractive, handleSubmitInteractive, handleSubmitStructured]
  );

  // ── Speech recognition ──────────────────────────────────────────────────────

  const toggleListening = useCallback(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript ?? "";
      if (transcript) handleSubmit(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, handleSubmit]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  // ── Placeholder text ────────────────────────────────────────────────────────

  const placeholder = isBusy
    ? isGeneratingModel
      ? "Generating 3D model…"
      : "Thinking…"
    : isInteractive
    ? isAnsweringQuestion
      ? "Your answer…"
      : "Ask about a topic…"
    : "Ask anything…";

  return (
    <div className="px-4 py-3 bg-white/40 backdrop-blur-xl border-t border-white/40 rounded-b-2xl">
      {/* Mode indicator for interactive */}
      {isInteractive && isAnsweringQuestion && !isBusy && (
        <div className="flex items-center gap-1.5 mb-2 ml-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F97B2F] animate-pulse" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#F97B2F]">
            Aristo is waiting for your answer
          </span>
        </div>
      )}

      <div className="flex items-center gap-2">
        {/* Mic button */}
        <button
          onClick={toggleListening}
          disabled={isBusy}
          title={isListening ? "Stop listening" : "Speak"}
          className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 border ${
            isListening
              ? "bg-[#F97B2F] border-[#F97B2F] text-white shadow-[0_0_16px_rgba(249,123,47,0.5)] animate-pulse"
              : "bg-white/70 border-white/60 text-[#8B6E5A] hover:border-[#F97B2F]/40 hover:text-[#F97B2F] hover:bg-[#FFF5EC]"
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {isListening ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          ) : (
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"
              />
            </svg>
          )}
        </button>

        {/* Text input */}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(input);
            }
          }}
          placeholder={placeholder}
          disabled={isBusy}
          className="flex-1 h-9 px-4 rounded-full bg-white/80 border border-white/60 text-sm text-[#3D2110] placeholder:text-[#B8957A] focus:outline-none focus:ring-2 focus:ring-[#F97B2F]/30 focus:border-[#F97B2F]/50 disabled:opacity-50 transition-all"
        />

        {/* Send button */}
        <button
          onClick={() => handleSubmit(input)}
          disabled={isBusy || !input.trim()}
          title="Send"
          className="shrink-0 w-9 h-9 rounded-full bg-[#F97B2F] flex items-center justify-center text-white shadow-[0_2px_12px_rgba(249,123,47,0.35)] hover:bg-[#E06A20] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {isBusy ? (
            <svg
              className="w-4 h-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
          ) : (
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 12h14M12 5l7 7-7 7"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
