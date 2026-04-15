/**
 * useCourseAutoTeach
 *
 * Automatically fires the /api/teach endpoint whenever a new course topic
 * becomes active (mode === "course" and currentTopicIndex changes).
 *
 * - Clears existing messages before loading the new topic.
 * - For structured flow: adds a StructuredMessage and optionally triggers
 *   3D model generation.
 * - For interactive flow: adds the initial Aristo ChatMessage so the
 *   Socratic conversation can begin.
 * - A ref guards against double-fire in React StrictMode.
 */

import { useEffect, useRef } from "react";
import { useAristoStore, type StructuredMessage, type ChatMessage } from "@/store/useAristoStore";

export function useCourseAutoTeach() {
  const mode          = useAristoStore((s) => s.mode);
  const course        = useAristoStore((s) => s.course);
  const learningStyle = useAristoStore((s) => s.learningStyle);
  const teachingFlow  = useAristoStore((s) => s.teachingFlow);

  const addMessage         = useAristoStore((s) => s.addMessage);
  const clearMessages      = useAristoStore((s) => s.clearMessages);
  const setIsLoading       = useAristoStore((s) => s.setIsLoading);
  const setActiveModelUrl  = useAristoStore((s) => s.setActiveModelUrl);
  const setIsGeneratingModel = useAristoStore((s) => s.setIsGeneratingModel);
  const stopAudio          = useAristoStore((s) => s.stopAudio);
  const clearQuiz          = useAristoStore((s) => s.clearQuiz);

  // Tracks the last topic key that was fired: "courseId:topicIndex"
  const firedRef = useRef<string | null>(null);

  useEffect(() => {
    if (mode !== "course") return;

    const { courseId, topics, currentTopicIndex } = course;
    if (!courseId || topics.length === 0) return;
    if (currentTopicIndex >= topics.length) return;

    const key = `${courseId}:${currentTopicIndex}`;
    if (firedRef.current === key) return; // already fired
    firedRef.current = key;

    const topic = topics[currentTopicIndex];

    // Reset UI state for the new topic
    stopAudio();
    clearMessages();
    clearQuiz();
    setActiveModelUrl(null);
    setIsLoading(true);

    // ── Call /api/teach ──────────────────────────────────────────────────────

    (async () => {
      try {
        const body =
          teachingFlow === "interactive"
            ? {
                teachingFlow: "interactive",
                learningStyle,
                // Seed the conversation with the topic as the first user message
                messages: [{ role: "user", content: topic }],
              }
            : {
                teachingFlow: "structured",
                learningStyle,
                topic,
                history: [],
              };

        const res = await fetch("/api/teach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) throw new Error("Teaching API error");

        const data = await res.json();
        setIsLoading(false);

        if (teachingFlow === "interactive") {
          // Add Aristo's opening message
          const msg: ChatMessage = {
            id: `course_${Date.now()}`,
            type: "chat",
            role: "assistant",
            content: (data as { message: string }).message,
            isLessonEnd: false,
            timestamp: Date.now(),
          };
          addMessage(msg);
        } else {
          // Structured: build the lesson card
          const msgId = `course_${Date.now()}`;
          const structured = data as {
            definition: string;
            explanation: string;
            example: string;
            fun_fact?: string;
            should_generate_model?: boolean;
            model_image_prompt?: string;
            annotation_hints?: string[];
          };

          const msg: StructuredMessage = {
            id: msgId,
            type: "structured",
            question: topic,
            definition: structured.definition ?? "",
            explanation: structured.explanation ?? "",
            example: structured.example ?? "",
            fun_fact: structured.fun_fact,
            annotationHints: structured.annotation_hints ?? [],
            timestamp: Date.now(),
          };

          addMessage(msg);

          // Optionally trigger 3D model generation
          if (structured.should_generate_model && structured.model_image_prompt) {
            setIsGeneratingModel(true);
            try {
              const modelRes = await fetch("/api/generate-model", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  imagePrompt: structured.model_image_prompt,
                  topic,
                }),
              });
              if (modelRes.ok) {
                const { modelUrl, imageUrl } = await modelRes.json();
                // Patch the model URL into the message
                const messages = useAristoStore.getState().messages.map((m) =>
                  m.id === msgId ? { ...m, modelUrl, imageUrl } : m
                );
                useAristoStore.setState({ messages });
                setActiveModelUrl(modelUrl);
              }
            } catch {
              // Model generation is non-critical
            } finally {
              setIsGeneratingModel(false);
            }
          }
        }
      } catch (err) {
        console.error("Course auto-teach failed:", err);
        setIsLoading(false);
      }
    })();
  }, [
    mode,
    course.courseId,
    course.currentTopicIndex,
    course.topics,
    learningStyle,
    teachingFlow,
    addMessage,
    clearMessages,
    clearQuiz,
    setIsLoading,
    setActiveModelUrl,
    setIsGeneratingModel,
    stopAudio,
  ]);
}
