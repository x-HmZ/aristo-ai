"use client";

import { useAristoStore, type ChatMessage } from "@/store/useAristoStore";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, LoaderCircle, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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
                content:   "_(I couldn't create the visual for this topic right now. The lesson above still stands.)_",
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
      ? "Building your 3D model…"
      : "Thinking…"
    : "Ask about any topic…";

  return (
    <div className="rounded-b-2xl border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-md">
      <div className="flex items-center gap-2">
        {/* Mic button. Listening is the accent fill and the stop icon; the pulse is
            motion-safe, so a reduced-motion reader still sees the ring. */}
        <Button
          variant={isListening ? "default" : "secondary"}
          size="icon"
          onClick={toggleListening}
          disabled={isBusy}
          title={isListening ? "Stop listening" : "Speak"}
          aria-label="Speak"
          aria-pressed={isListening}
          className={cn("shrink-0", isListening && "ring-2 ring-accent-text ring-offset-2 ring-offset-surface motion-safe:animate-pulse")}
        >
          {isListening ? <Square aria-hidden fill="currentColor" /> : <Mic aria-hidden />}
        </Button>

        {/* Text input */}
        <Input
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
          className="flex-1"
        />

        {/* Send button */}
        <Button
          size="icon"
          onClick={() => handleSubmit(input)}
          disabled={isBusy || !input.trim()}
          title="Send"
          aria-label={isBusy ? "Working" : "Send"}
          className="shrink-0"
        >
          {isBusy ? (
            <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
          ) : (
            <ArrowRight aria-hidden />
          )}
        </Button>
      </div>
    </div>
  );
}
