"use client";

import { useCallback, useEffect, useState } from "react";
import { AristoCanvas }     from "@/components/learn/AristoCanvas";
import { MessagePanel }     from "@/components/learn/MessagePanel";
import { InputBox }         from "@/components/learn/InputBox";
import { TeacherControls }  from "@/components/learn/TeacherControls";
import { StyleAssessment }  from "@/components/learn/StyleAssessment";
import { ModePicker }       from "@/components/learn/ModePicker";
import type { PublishedCourse } from "@/components/learn/ModePicker";
import {
  QuizPanel,
  CourseTakeQuizBar,
  CourseLoadingBar,
  CourseAdvanceBar,
} from "@/components/learn/CourseFlow";
import { useCourseAutoTeach } from "@/hooks/useCourseAutoTeach";
import {
  useAristoStore,
  type LearningStyle,
  type TeachingFlow,
  type ChatMessage,
} from "@/store/useAristoStore";

// ─── Props ────────────────────────────────────────────────────────────────────

interface LearnClientProps {
  userName: string;
  savedStyle: string;
  savedFlow: string;
  styleAssessmentDone: boolean;
  userId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function doSignOut() {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  await supabase.auth.signOut();
  window.location.href = "/sign-in";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LearnClient({
  userName,
  savedStyle,
  savedFlow,
  styleAssessmentDone,
  userId,
}: LearnClientProps) {
  // ── Store subscriptions ───────────────────────────────────────────────────
  const setUserId             = useAristoStore((s) => s.setUserId);
  const setLearningStyle      = useAristoStore((s) => s.setLearningStyle);
  const setTeachingFlow       = useAristoStore((s) => s.setTeachingFlow);
  const setStyleAssessmentDone = useAristoStore((s) => s.setStyleAssessmentDone);
  const setMode               = useAristoStore((s) => s.setMode);
  const setCourse             = useAristoStore((s) => s.setCourse);
  const advanceTopic          = useAristoStore((s) => s.advanceTopic);
  const clearMessages         = useAristoStore((s) => s.clearMessages);
  const clearQuiz             = useAristoStore((s) => s.clearQuiz);
  const startQuiz             = useAristoStore((s) => s.startQuiz);
  const stopAudio             = useAristoStore((s) => s.stopAudio);
  const setActiveModelUrl     = useAristoStore((s) => s.setActiveModelUrl);

  const mode          = useAristoStore((s) => s.mode);
  const course        = useAristoStore((s) => s.course);
  const messages      = useAristoStore((s) => s.messages);
  const isLoading     = useAristoStore((s) => s.isLoading);
  const teachingFlow  = useAristoStore((s) => s.teachingFlow);
  const learningStyle = useAristoStore((s) => s.learningStyle);
  const quiz          = useAristoStore((s) => s.quiz);

  // ── Local UI state ────────────────────────────────────────────────────────
  const [showAssessment, setShowAssessment] = useState(!styleAssessmentDone);
  const [showPicker, setShowPicker]         = useState(styleAssessmentDone);
  const [isQuizLoading, setIsQuizLoading]   = useState(false);

  // ── Boot: hydrate store from server-fetched profile ───────────────────────
  useEffect(() => {
    setUserId(userId);
    setLearningStyle(savedStyle as LearningStyle);
    setTeachingFlow(savedFlow as TeachingFlow);
    if (styleAssessmentDone) setStyleAssessmentDone(true);
  }, [
    userId, savedStyle, savedFlow, styleAssessmentDone,
    setUserId, setLearningStyle, setTeachingFlow, setStyleAssessmentDone,
  ]);

  // ── Course auto-teach (fires the lesson whenever a new topic starts) ──────
  useCourseAutoTeach();

  // ── Assessment complete ───────────────────────────────────────────────────
  const handleAssessmentComplete = useCallback(
    (style: LearningStyle, flow: TeachingFlow) => {
      setLearningStyle(style);
      setTeachingFlow(flow);
      setStyleAssessmentDone(true);
      setShowAssessment(false);
      setShowPicker(true); // show mode picker after assessment
    },
    [setLearningStyle, setTeachingFlow, setStyleAssessmentDone]
  );

  // ── Mode picker callbacks ─────────────────────────────────────────────────
  const handleExplore = useCallback(() => {
    setMode("free");
    setShowPicker(false);
  }, [setMode]);

  const handleStartCourse = useCallback(
    async (course: PublishedCourse) => {
      setShowPicker(false);

      // Create session record
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data: session } = await supabase
          .from("sessions")
          .insert({
            user_id: userId,
            course_id: course.id,
            mode: "course",
            active_style: learningStyle,
          })
          .select("id")
          .single();

        setCourse({
          courseId:          course.id,
          title:             course.title,
          topics:            course.topic_list,
          currentTopicIndex: 0,
          sessionId:         session?.id ?? null,
        });
      } catch {
        // Session creation is non-critical
        setCourse({
          courseId:          course.id,
          title:             course.title,
          topics:            course.topic_list,
          currentTopicIndex: 0,
          sessionId:         null,
        });
      }

      setMode("course");
    },
    [userId, learningStyle, setCourse, setMode]
  );

  // ── Clear / return to picker ──────────────────────────────────────────────
  const handleClear = useCallback(() => {
    stopAudio();
    clearMessages();
    clearQuiz();
    setActiveModelUrl(null);
    setMode("free");
    setCourse({
      courseId: null, title: "", topics: [],
      currentTopicIndex: 0, sessionId: null,
    });
    setShowPicker(true);
  }, [
    stopAudio, clearMessages, clearQuiz,
    setActiveModelUrl, setMode, setCourse,
  ]);

  // ── Quiz ──────────────────────────────────────────────────────────────────
  const handleTakeQuiz = useCallback(async () => {
    setIsQuizLoading(true);
    try {
      const topic = course.topics[course.currentTopicIndex] ?? "the current topic";
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics: [topic], learningStyle }),
      });
      if (!res.ok) throw new Error("Quiz API failed");
      const data = await res.json();
      startQuiz(data.questions ?? []);
    } catch (err) {
      console.error("Failed to load quiz:", err);
    } finally {
      setIsQuizLoading(false);
    }
  }, [course.topics, course.currentTopicIndex, learningStyle, startQuiz]);

  const handleQuizFinish = useCallback(() => {
    // quiz.score is now set in store; CourseAdvanceBar will render
  }, []);

  const handleAdvanceTopic = useCallback(() => {
    clearQuiz();
    advanceTopic();
  }, [clearQuiz, advanceTopic]);

  const handleFinishCourse = useCallback(() => {
    clearQuiz();
    clearMessages();
    setMode("free");
    setCourse({
      courseId: null, title: "", topics: [],
      currentTopicIndex: 0, sessionId: null,
    });
    setShowPicker(true);
  }, [
    clearQuiz, clearMessages, setMode, setCourse,
  ]);

  // ── Lesson-complete detection ─────────────────────────────────────────────
  // Structured: lesson is done as soon as the card is present.
  // Interactive: lesson is done when Aristo sends isLessonEnd = true.
  const lessonLoaded =
    mode === "course" &&
    (messages.some((m) => m.type === "structured") ||
      messages.some((m) => m.type === "chat" && m.role === "assistant"));

  const lessonComplete =
    mode === "course" &&
    (teachingFlow === "structured"
      ? messages.some((m) => m.type === "structured")
      : messages.some(
          (m) =>
            m.type === "chat" &&
            (m as ChatMessage).role === "assistant" &&
            (m as ChatMessage).isLessonEnd === true
        ));

  const isLastTopic =
    course.topics.length > 0 &&
    course.currentTopicIndex === course.topics.length - 1;

  // ── Bottom bar logic ──────────────────────────────────────────────────────
  const renderBottom = () => {
    if (mode !== "course") return <InputBox />;

    if (quiz.isActive) {
      return (
        <QuizPanel
          userId={userId}
          topic={course.topics[course.currentTopicIndex] ?? ""}
          onFinish={handleQuizFinish}
        />
      );
    }

    if (quiz.score !== null) {
      return (
        <CourseAdvanceBar
          score={quiz.score}
          total={quiz.questions.length}
          isLastTopic={isLastTopic}
          onAdvance={handleAdvanceTopic}
          onFinish={handleFinishCourse}
        />
      );
    }

    if (lessonComplete) {
      return (
        <CourseTakeQuizBar
          onTakeQuiz={handleTakeQuiz}
          isLoading={isQuizLoading}
        />
      );
    }

    if (isLoading || !lessonLoaded) {
      return <CourseLoadingBar />;
    }

    // Interactive mid-lesson — InputBox stays so student can reply
    return <InputBox />;
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* 3D scene */}
      <div className="absolute inset-0 z-0">
        <AristoCanvas />
      </div>

      {/* Top nav */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-[#3D2110] text-xl tracking-tight">aristo</span>
          <span className="text-[#F97B2F] text-xl font-bold">✦</span>
        </div>

        <div className="flex items-center gap-3 bg-white/60 backdrop-blur-md border border-white/50 rounded-full px-4 py-1.5 shadow-sm">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#F97B2F] to-[#FBA962] flex items-center justify-center text-white text-xs font-bold">
            {userName[0]?.toUpperCase()}
          </div>
          <span className="text-sm font-medium text-[#3D2110]">{userName}</span>
          <span className="w-px h-3 bg-[#E8D5BC]" />
          <button
            onClick={doSignOut}
            className="text-xs text-[#8B6E5A] hover:text-[#3D2110] transition-colors font-medium"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Right panel */}
      <div className="absolute right-5 top-[68px] bottom-5 z-10 w-[400px] flex flex-col rounded-2xl overflow-hidden shadow-[0_8px_40px_rgba(249,123,47,0.18)] border border-white/40">
        <TeacherControls onClear={handleClear} />
        <div className="flex-1 overflow-hidden bg-white/25 backdrop-blur-xl">
          <MessagePanel />
        </div>
        {renderBottom()}
      </div>

      {/* Assessment overlay */}
      {showAssessment && (
        <StyleAssessment userId={userId} onComplete={handleAssessmentComplete} />
      )}

      {/* Mode picker overlay */}
      {!showAssessment && showPicker && (
        <ModePicker onExplore={handleExplore} onStartCourse={handleStartCourse} />
      )}
    </div>
  );
}
