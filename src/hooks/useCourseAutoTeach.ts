/**
 * useCourseAutoTeach
 *
 * Fires whenever a new course topic becomes active (mode === "course" and
 * currentTopicIndex changes). Calls GET /api/learn/lesson/:conceptId which
 * runs the 5-phase TeachingAgent (Claude Sonnet) and returns a LessonPayload.
 *
 * The payload is stored as `activeLesson` in the Zustand store.
 * MessagePanel renders LessonView when activeLesson is non-null.
 */

import { useEffect, useRef } from "react";
import { useAristoStore }    from "@/store/useAristoStore";

export function useCourseAutoTeach() {
  const mode   = useAristoStore((s) => s.mode);
  const course = useAristoStore((s) => s.course);

  const clearMessages       = useAristoStore((s) => s.clearMessages);
  const setIsLoading        = useAristoStore((s) => s.setIsLoading);
  const setActiveLesson     = useAristoStore((s) => s.setActiveLesson);
  const setActiveModelUrl   = useAristoStore((s) => s.setActiveModelUrl);
  const stopAudio           = useAristoStore((s) => s.stopAudio);
  const clearQuiz           = useAristoStore((s) => s.clearQuiz);

  // Tracks the last topic key that was fired: "courseId:topicIndex"
  const firedRef = useRef<string | null>(null);

  useEffect(() => {
    if (mode !== "course") return;

    const { courseId, topics, currentTopicIndex } = course;
    if (!courseId || topics.length === 0) return;
    if (currentTopicIndex >= topics.length)  return;

    const key = `${courseId}:${currentTopicIndex}`;
    if (firedRef.current === key) return;
    firedRef.current = key;

    const topic = topics[currentTopicIndex];

    stopAudio();
    clearMessages();
    clearQuiz();
    setActiveLesson(null);
    setActiveModelUrl(null);
    setIsLoading(true);

    (async () => {
      try {
        // Encode the topic name as the conceptId. The lesson API resolves
        // KG concept IDs first; if not found it falls back to using the
        // topic name directly. Phase 5 will replace topics[] with concept IDs.
        const conceptId = encodeURIComponent(topic);
        const res = await fetch(`/api/learn/lesson/${conceptId}`);

        if (!res.ok) throw new Error(`Lesson API error ${res.status}`);

        const lesson = await res.json();
        setIsLoading(false);
        setActiveLesson(lesson);
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
    clearMessages,
    clearQuiz,
    setIsLoading,
    setActiveLesson,
    setActiveModelUrl,
    stopAudio,
  ]);
}
