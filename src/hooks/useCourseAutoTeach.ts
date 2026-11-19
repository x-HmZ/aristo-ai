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
import { useLessonStatus }   from "@/hooks/useLessonStatus";
import { classifyLessonFailure } from "@/lib/learn/lessonError";

export function useCourseAutoTeach() {
  const mode   = useAristoStore((s) => s.mode);
  const course = useAristoStore((s) => s.course);

  const clearMessages       = useAristoStore((s) => s.clearMessages);
  const setIsLoading        = useAristoStore((s) => s.setIsLoading);
  const setActiveLesson     = useAristoStore((s) => s.setActiveLesson);
  const setActiveModelUrl   = useAristoStore((s) => s.setActiveModelUrl);
  const stopAudio           = useAristoStore((s) => s.stopAudio);
  const retryNonce          = useLessonStatus((s) => s.retryNonce);
  const setFailure          = useLessonStatus((s) => s.setFailure);

  // Tracks the last topic key that was fired: "courseId:topicIndex"
  const firedRef = useRef<string | null>(null);

  useEffect(() => {
    if (mode !== "course") return;

    const { courseId, topics, currentTopicIndex } = course;
    if (!courseId || topics.length === 0) return;
    if (currentTopicIndex >= topics.length)  return;

    // Retry bumps retryNonce, which makes this a new key and so a new fetch.
    const key = `${courseId}:${currentTopicIndex}:${retryNonce}`;
    if (firedRef.current === key) return;
    firedRef.current = key;

    const topic = topics[currentTopicIndex];

    stopAudio();
    clearMessages();
    setActiveLesson(null);
    setActiveModelUrl(null);
    setFailure(null);
    setIsLoading(true);

    (async () => {
      try {
        // Encode the topic name as the conceptId. The lesson API resolves
        // KG concept IDs first; if not found it falls back to using the
        // topic name directly. Phase 5 will replace topics[] with concept IDs.
        const conceptId = encodeURIComponent(topic);
        const res = await fetch(`/api/learn/lesson/${conceptId}`);

        if (!res.ok) {
          // The body says why (allowance used, paused for today); a body that is not JSON is fine.
          const body = await res.json().catch(() => null);
          if (firedRef.current !== key) return; // the learner moved on meanwhile
          console.error(`Course auto-teach failed: lesson API ${res.status}`);
          setIsLoading(false);
          setFailure(classifyLessonFailure({ status: res.status, body }));
          return;
        }

        const lesson = await res.json();
        if (firedRef.current !== key) return;
        setIsLoading(false);
        setActiveLesson(lesson);
      } catch (err) {
        console.error("Course auto-teach failed:", err);
        if (firedRef.current !== key) return;
        setIsLoading(false);
        setFailure(classifyLessonFailure({ status: 0 }));
      }
    })();
  }, [
    retryNonce,
    setFailure,
    mode,
    course.courseId,
    course.currentTopicIndex,
    course.topics,
    clearMessages,
    setIsLoading,
    setActiveLesson,
    setActiveModelUrl,
    stopAudio,
  ]);
}
