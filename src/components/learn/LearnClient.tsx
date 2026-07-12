"use client";

import { useCallback, useEffect, useState } from "react";
import { AristoCanvas }        from "@/components/learn/AristoCanvas";
import { SceneLoadingOverlay } from "@/components/learn/SceneLoadingOverlay";
import { MessagePanel }     from "@/components/learn/MessagePanel";
import { InputBox }         from "@/components/learn/InputBox";
import { TeacherControls }  from "@/components/learn/TeacherControls";
import { ModePicker }       from "@/components/learn/ModePicker";
import type { PublishedCourse } from "@/components/learn/ModePicker";
import { CourseMapView }    from "@/components/learn/CourseMapView";
import {
  CourseTakeQuizBar,
  CourseLoadingBar,
  CourseAdvanceBar,
} from "@/components/learn/CourseFlow";
import { useCourseAutoTeach }  from "@/hooks/useCourseAutoTeach";
import { useSessionFlush }     from "@/hooks/useSessionFlush";
import OnboardingView from "@/components/onboarding/OnboardingView";
import { ReviewView }          from "@/components/learn/ReviewView";
import { DashboardView }       from "@/components/learn/DashboardView";
import { useAristoStore }      from "@/store/useAristoStore";
import type { CourseStructure }    from "@/store/useAristoStore";

function flattenCourseConceptIds(structure: CourseStructure): string[] {
  return structure.modules.flatMap((m) =>
    m.lessons.flatMap((l) => l.concept_ids)
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface LearnClientProps {
  userName:       string;
  userId:         string;
  onboardingDone: boolean;
  domain:         string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Note: flushSession is passed in where needed — doSignOut is called from the
// component so it can access the flush function via closure below.

// ─── Component ────────────────────────────────────────────────────────────────

export function LearnClient({ userName, userId, onboardingDone, domain }: LearnClientProps) {
  // ── Store ─────────────────────────────────────────────────────────────────
  const setUserId              = useAristoStore((s) => s.setUserId);
  const setOnboardingDone      = useAristoStore((s) => s.setOnboardingDone);
  const setMode                = useAristoStore((s) => s.setMode);
  const setCourse              = useAristoStore((s) => s.setCourse);
  const advanceTopic           = useAristoStore((s) => s.advanceTopic);
  const clearMessages          = useAristoStore((s) => s.clearMessages);
  const clearQuiz              = useAristoStore((s) => s.clearQuiz);
  const stopAudio              = useAristoStore((s) => s.stopAudio);
  const setActiveModelUrl      = useAristoStore((s) => s.setActiveModelUrl);
  const setActiveLesson        = useAristoStore((s) => s.setActiveLesson);
  const setCustomTeacherGlbUrl = useAristoStore((s) => s.setCustomTeacherGlbUrl);

  const mode              = useAristoStore((s) => s.mode);
  const course            = useAristoStore((s) => s.course);
  const activeLesson      = useAristoStore((s) => s.activeLesson);
  const isLoading         = useAristoStore((s) => s.isLoading);
  const previewZoomUrl    = useAristoStore((s) => s.previewZoomUrl);
  const setPreviewZoomUrl = useAristoStore((s) => s.setPreviewZoomUrl);
  // Quiz state moved into the store so the in-scene DeskQuiz (rendered
  // inside the R3F Canvas) can mount QuizView and surface its result back
  // here for the CourseAdvanceBar.
  const activeQuiz        = useAristoStore((s) => s.activeQuiz);
  const setActiveQuiz     = useAristoStore((s) => s.setActiveQuiz);
  const quizResult        = useAristoStore((s) => s.quizResult);
  const setQuizResult     = useAristoStore((s) => s.setQuizResult);

  // ── Local UI state ────────────────────────────────────────────────────────
  const [showPicker,       setShowPicker]       = useState(onboardingDone);
  const [localOnboarded,   setLocalOnboarded]   = useState(onboardingDone);
  const [isQuizLoading,    setIsQuizLoading]     = useState(false);
  const [pendingCourse,    setPendingCourse]     = useState<PublishedCourse | null>(null);
  const [showCourseMap,    setShowCourseMap]     = useState(false);
  // Phase 6: spaced repetition review
  const [overdueCount,  setOverdueCount]  = useState(0);
  const [showReview,    setShowReview]    = useState(false);
  // Phase 9: student dashboard
  const [showDashboard, setShowDashboard] = useState(false);

  // ── Phase 7: session flush + concept tracking ─────────────────────────────
  const { flushSession, addConceptViewed } = useSessionFlush();

  const handleSignOut = useCallback(async () => {
    await flushSession();
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/sign-in";
  }, [flushSession]);

  // ── Boot: hydrate store ───────────────────────────────────────────────────
  useEffect(() => {
    setUserId(userId);
    if (onboardingDone) setOnboardingDone(true);
    // Seed domain from onboarding if store is empty
    if (domain && !course.domain) {
      setCourse({ domain });
    }
  }, [userId, onboardingDone, domain, course.domain, setUserId, setOnboardingDone, setCourse]);

  // Hydrate custom teacher GLB URL from learner_profiles once on mount
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const url = data?.dynamic_profile?.custom_teacher_glb_url;
        if (url) setCustomTeacherGlbUrl(url);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Track active lesson concept for session log
  useEffect(() => {
    if (activeLesson?.concept_id) {
      addConceptViewed(activeLesson.concept_id);
    }
  }, [activeLesson?.concept_id, addConceptViewed]);

  // ── Phase 6: poll overdue review count ───────────────────────────────────
  useEffect(() => {
    if (!onboardingDone) return;
    let cancelled = false;

    const fetchCount = async () => {
      try {
        const res  = await fetch("/api/learn/overdue-count");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setOverdueCount(data.overdueCount ?? 0);
      } catch { /* non-critical */ }
    };

    fetchCount();
    // Re-check every 5 minutes in case the user stays on the page
    const id = setInterval(fetchCount, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [onboardingDone]);

  // ── Course auto-teach ─────────────────────────────────────────────────────
  useCourseAutoTeach();

  // ── Onboarding complete ───────────────────────────────────────────────────
  const handleOnboardingComplete = useCallback(() => {
    setOnboardingDone(true);
    setLocalOnboarded(true);
    setShowPicker(true);
  }, [setOnboardingDone]);

  // ── Mode picker callbacks ─────────────────────────────────────────────────
  const handleExplore = useCallback(() => {
    setMode("free");
    setShowPicker(false);
  }, [setMode]);

  /**
   * Called by ModePicker when user picks or generates a course.
   * Shows the CourseMapView before committing to course mode.
   */
  const handleStartCourse = useCallback((courseData: PublishedCourse) => {
    setShowPicker(false);
    setPendingCourse(courseData);
    setShowCourseMap(true);
  }, []);

  /**
   * Called by CourseMapView when the user clicks "Start / Continue"
   * or taps a specific concept node.
   */
  const handleSelectConcept = useCallback((flatIndex: number) => {
    if (!pendingCourse) return;

    const conceptIds = flattenCourseConceptIds(pendingCourse.structure);

    setCourse({
      courseId:          pendingCourse.id,
      title:             pendingCourse.title,
      domain:            pendingCourse.domain,
      topics:            conceptIds,
      currentTopicIndex: flatIndex,
      sessionId:         null,
      structure:         pendingCourse.structure,
    });
    setMode("course");
    setShowCourseMap(false);
    setPendingCourse(null);
  }, [pendingCourse, setCourse, setMode]);

  const handleCloseMap = useCallback(() => {
    setShowCourseMap(false);
    setPendingCourse(null);
    setShowPicker(true);
  }, []);

  // ── Clear / return to picker ──────────────────────────────────────────────
  const handleClear = useCallback(() => {
    stopAudio();
    clearMessages();
    clearQuiz();
    setActiveLesson(null);
    setActiveModelUrl(null);
    setActiveQuiz(null);
    setQuizResult(null);
    setMode("free");
    setCourse({
      courseId: null, title: "", domain: "", topics: [],
      currentTopicIndex: 0, sessionId: null, structure: null,
    });
    setShowPicker(true);
  }, [stopAudio, clearMessages, clearQuiz, setActiveLesson, setActiveModelUrl, setActiveQuiz, setQuizResult, setMode, setCourse]);

  // ── View map while in a course ─────────────────────────────────────────────
  const handleViewMap = useCallback(() => {
    if (!course.courseId || !course.structure) return;
    // Re-use pendingCourse slot with current course data
    setPendingCourse({
      id:              course.courseId,
      domain:          course.domain,
      title:           course.title,
      description:     null,
      structure:       course.structure,
      estimated_hours: null,
    });
    setShowCourseMap(true);
  }, [course]);

  // ── Quiz ──────────────────────────────────────────────────────────────────
  // handleTakeQuiz fetches the question set, then pushes it into the store.
  // The DeskQuiz component (inside the R3F Canvas) picks up activeQuiz and
  // mounts QuizView via <Html transform> on the desk paper; the
  // CameraController parallel-lerps the camera down to frame it.  No bottom
  // bar is rendered during the quiz — the quiz IS the bottom of the scene.
  const handleTakeQuiz = useCallback(async () => {
    setIsQuizLoading(true);
    setQuizResult(null);
    try {
      const conceptId = course.topics[course.currentTopicIndex] ?? "the current topic";
      const res = await fetch(`/api/quiz/lesson/${encodeURIComponent(conceptId)}`);
      if (!res.ok) throw new Error("Quiz API failed");
      const data = await res.json();
      setActiveQuiz({ conceptId, questions: data.questions ?? [] });
    } catch (err) {
      console.error("Failed to load quiz:", err);
    } finally {
      setIsQuizLoading(false);
    }
  }, [course.topics, course.currentTopicIndex, setActiveQuiz, setQuizResult]);

  // When DeskQuiz completes it has already cleared activeQuiz and set
  // quizResult on the store.  We mirror that into the legacy signal-flush
  // hook here.
  useEffect(() => {
    if (quizResult !== null) {
      flushSession().catch(() => {});
    }
  }, [quizResult, flushSession]);

  const handleAdvanceTopic = useCallback(() => {
    clearQuiz();
    setActiveLesson(null);
    setActiveQuiz(null);
    setQuizResult(null);
    advanceTopic();
  }, [clearQuiz, setActiveLesson, setActiveQuiz, setQuizResult, advanceTopic]);

  const handleFinishCourse = useCallback(() => {
    clearQuiz();
    clearMessages();
    setActiveLesson(null);
    setActiveQuiz(null);
    setQuizResult(null);
    setMode("free");
    setCourse({
      courseId: null, title: "", domain: "", topics: [],
      currentTopicIndex: 0, sessionId: null, structure: null,
    });
    setShowPicker(true);
  }, [clearQuiz, clearMessages, setActiveLesson, setActiveQuiz, setQuizResult, setMode, setCourse]);

  // ── Lesson-complete detection ─────────────────────────────────────────────
  const lessonLoaded   = mode === "course" && activeLesson !== null;
  const lessonComplete = lessonLoaded;

  const isLastTopic =
    course.topics.length > 0 &&
    course.currentTopicIndex === course.topics.length - 1;

  // ── Bottom bar ────────────────────────────────────────────────────────────
  const renderBottom = () => {
    if (mode !== "course") return <InputBox />;

    // Active in-scene quiz — bottom bar collapses to a tiny status strip so
    // the student's attention is fully on the desk paper.  Nothing to type
    // here; QuizView owns its own controls.
    if (activeQuiz) {
      return (
        <div className="px-4 py-3 bg-white/55 backdrop-blur-xl border-t border-[#F97B2F]/30 rounded-b-2xl flex items-center justify-center gap-2 text-xs text-[#8B6E5A]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F97B2F] animate-pulse" />
          <span>Quiz on your desk — look down</span>
        </div>
      );
    }

    // Quiz result → advance bar
    if (quizResult !== null) {
      return (
        <CourseAdvanceBar
          score={quizResult.score}
          total={quizResult.total}
          isLastTopic={isLastTopic}
          onAdvance={handleAdvanceTopic}
          onFinish={handleFinishCourse}
        />
      );
    }

    if (lessonComplete) {
      return <CourseTakeQuizBar onTakeQuiz={handleTakeQuiz} isLoading={isQuizLoading} />;
    }

    if (isLoading || !lessonLoaded) return <CourseLoadingBar />;

    return <InputBox />;
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* 3D scene */}
      <div className="absolute inset-0 z-0">
        <AristoCanvas />
      </div>

      {/* Cold-start loading overlay — fades out once assets are downloaded
          AND the scene has painted a frame. Sits above the top nav / right
          panel so nothing is visible/interactive until the classroom is
          actually ready. */}
      <SceneLoadingOverlay />

      {/* Top nav */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-[#3D2110] text-xl tracking-tight">aristo</span>
          <span className="text-[#F97B2F] text-xl font-bold">✦</span>
        </div>

        <div className="flex items-center gap-3 bg-white/60 backdrop-blur-md border border-white/50 rounded-full px-4 py-1.5 shadow-sm">
          {/* Reviews-due chip — Phase 6 */}
          {localOnboarded && overdueCount > 0 && (
            <button
              onClick={() => setShowReview(true)}
              className="flex items-center gap-1 text-xs font-semibold text-white bg-[#F97B2F] hover:bg-[#E06A20] rounded-full px-2.5 py-0.5 transition-all shadow-sm"
              title="Start your daily review"
            >
              ↻ {overdueCount} due
            </button>
          )}
          {/* Progress dashboard button */}
          {localOnboarded && (
            <button
              onClick={() => setShowDashboard(true)}
              className="text-xs text-[#8B6E5A] hover:text-[#F97B2F] transition-colors font-medium"
              title="View your progress"
            >
              ⊞ Progress
            </button>
          )}
          {/* Map button — visible while in a course that has structure */}
          {mode === "course" && course.structure && (
            <button
              onClick={handleViewMap}
              className="text-xs text-[#8B6E5A] hover:text-[#F97B2F] transition-colors font-medium"
              title="View course map"
            >
              🗺 Map
            </button>
          )}
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#F97B2F] to-[#FBA962] flex items-center justify-center text-white text-xs font-bold">
            {userName[0]?.toUpperCase()}
          </div>
          <span className="text-sm font-medium text-[#3D2110]">{userName}</span>
          <span className="w-px h-3 bg-[#E8D5BC]" />
          <button
            onClick={handleSignOut}
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

      {/* Onboarding overlay */}
      {!localOnboarded && (
        <div className="absolute inset-0 z-50">
          <OnboardingView userName={userName} onComplete={handleOnboardingComplete} />
        </div>
      )}

      {/* Mode picker overlay */}
      {localOnboarded && showPicker && (
        <ModePicker onExplore={handleExplore} onStartCourse={handleStartCourse} />
      )}

      {/* Course map overlay */}
      {showCourseMap && pendingCourse && (
        <CourseMapView
          courseId={pendingCourse.id}
          currentTopicIndex={
            pendingCourse.id === course.courseId ? course.currentTopicIndex : 0
          }
          onSelectConcept={handleSelectConcept}
          onClose={handleCloseMap}
        />
      )}

      {/* Student dashboard overlay — Phase 9 */}
      {showDashboard && (
        <DashboardView onClose={() => setShowDashboard(false)} />
      )}

      {/* Daily review overlay — Phase 6 */}
      {showReview && (
        <ReviewView
          userId={userId}
          onClose={() => {
            setShowReview(false);
            // Re-fetch count after finishing a review session
            fetch("/api/learn/overdue-count")
              .then((r) => r.json())
              .then((d) => setOverdueCount(d.overdueCount ?? 0))
              .catch(() => {});
          }}
        />
      )}

      {/* Image zoom lightbox */}
      {previewZoomUrl && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(30,14,6,0.82)", backdropFilter: "blur(6px)" }}
          onClick={() => setPreviewZoomUrl(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewZoomUrl}
            alt="Teaching diagram"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "min(90vw, 700px)",
              maxHeight: "80vh",
              borderRadius: "16px",
              boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
              border: "2px solid rgba(249,123,47,0.4)",
              objectFit: "contain",
            }}
          />
          <button
            onClick={() => setPreviewZoomUrl(null)}
            style={{
              position: "absolute", top: "20px", right: "24px",
              background: "rgba(253,240,228,0.15)", border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "50%", width: "36px", height: "36px",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: "18px", cursor: "pointer",
              backdropFilter: "blur(4px)",
            }}
            title="Close"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
