"use client";

import { useAristoStore, type ChatMessage } from "@/store/useAristoStore";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SpeechRecognitionInstance } from "@/lib/speech";
import "@/lib/speech";

// ─── Main component ───────────────────────────────────────────────────────────

export function InputBox() {
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const messages          = useAristoStore((s) => s.messages);
  const isLoading         = useAristoStore((s) => s.isLoading);
  const isGeneratingModel = useAristoStore((s) => s.isGeneratingModel);

  const addMessage               = useAristoStore((s) => s.addMessage);
  const setIsLoading             = useAristoStore((s) => s.setIsLoading);
  const setActiveModelUrl        = useAristoStore((s) => s.setActiveModelUrl);
  const setActivePreviewImageUrl = useAristoStore((s) => s.setActivePreviewImageUrl);
  const setIsGeneratingModel     = useAristoStore((s) => s.setIsGeneratingModel);
  const setPending3dImageUrl     = useAristoStore((s) => s.setPending3dImageUrl);
  const setViewMode3d            = useAristoStore((s) => s.setViewMode3d);

  const isBusy    = isLoading || isGeneratingModel;

  // ── Submit handler ──────────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (userInput: string) => {
      const trimmed = userInput.trim();
      if (!trimmed || isBusy) return;
      setInput("");

      const userMsg: ChatMessage = {
        id:        `msg_${Date.now()}_user`,
        type:      "chat",
        role:      "user",
        content:   trimmed,
        timestamp: Date.now(),
      };
      addMessage(userMsg);
      setIsLoading(true);

      try {
        const history = messages
          .filter((m): m is ChatMessage => m.type === "chat")
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await fetch("/api/teach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teachingFlow: "structured",
            learningStyle: "explorer",
            topic: trimmed,
            history,
          }),
        });

        if (!res.ok) throw new Error("Teaching API failed");

        const data = await res.json();
        setIsLoading(false);

        // Flatten structured response into a readable ChatMessage
        const summary = [
          data.definition  && `**Definition:** ${data.definition}`,
          data.explanation && `**Explanation:** ${data.explanation}`,
          data.example     && `**Example:** ${data.example}`,
          data.fun_fact    && `**Fun fact:** ${data.fun_fact}`,
        ]
          .filter(Boolean)
          .join("\n\n");

        const assistantMsg: ChatMessage = {
          id:        `msg_${Date.now()}_ai`,
          type:      "chat",
          role:      "assistant",
          content:   summary || `Here's what you need to know about: ${trimmed}`,
          timestamp: Date.now(),
        };

        // Narration is deliberately NOT started here. FreeTopicCard owns it:
        // it renders this answer, speaks the parsed text that matches what is on
        // screen, and handles the explaining/idle gesture plus cleanup on
        // unmount. Speaking here as well meant every free-topic answer was
        // narrated twice on one shared <audio> element -- two full-price
        // ElevenLabs generations per question, competing with each other.

        if (data.should_generate_model && data.model_image_prompt) {
          // Clear previous visuals so the scene resets for the new topic
          setActiveModelUrl(null);
          setActivePreviewImageUrl(null);
          setPending3dImageUrl(null);
          setViewMode3d(false);
          setIsGeneratingModel(true);
          addMessage(assistantMsg);
          // Stage 1 only: NB Pro (teaching image) + FLUX Schnell (3D source) in parallel.
          // 3D conversion is deferred — user clicks "View in 3D" in the scene to trigger it.
          fetch("/api/generate-model", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imagePrompt:   data.model_image_prompt,
              model3dPrompt: data.model_3d_prompt,
              topic:         trimmed,
            }),
          })
            .then(async (r) => {
              const payload = await r.json();
              if (!r.ok || !payload.imageUrl) {
                throw new Error(payload.error ?? `generate-model HTTP ${r.status}`);
              }
              setActivePreviewImageUrl(payload.imageUrl);
              setPending3dImageUrl(payload.model3dImageUrl ?? payload.imageUrl);
            })
            .catch((err) => {
              console.error("[free-mode] visual generation failed:", err);
              addMessage({
                id:        `msg_${Date.now()}_viz_err`,
                type:      "chat",
                role:      "assistant",
                content:   "_(I couldn't create the visual for this topic right now — the lesson above still stands!)_",
                timestamp: Date.now(),
              });
            })
            .finally(() => setIsGeneratingModel(false));
        } else {
          addMessage(assistantMsg);
          setActiveModelUrl(null);
          setActivePreviewImageUrl(null);
          setPending3dImageUrl(null);
          setViewMode3d(false);
        }
      } catch (err) {
        console.error("InputBox submit error:", err);
        setIsLoading(false);
      }
    },
    [
      isBusy,
      messages,
      addMessage,
      setIsLoading,
      setActiveModelUrl,
      setActivePreviewImageUrl,
      setIsGeneratingModel,
      setPending3dImageUrl,
      setViewMode3d,
    ]
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
    recognition.onend   = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, handleSubmit]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  const placeholder = isBusy
    ? isGeneratingModel
      ? "Generating 3D model…"
      : "Thinking…"
    : "Ask about any topic…";

  return (
    <div className="px-4 py-3 bg-white/40 backdrop-blur-xl border-t border-white/40 rounded-b-2xl">
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
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
