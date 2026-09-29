"use client";

import { useCallback, useEffect, useState } from "react";
import { AristoCanvas }        from "@/components/learn/AristoCanvas";
import { preloadDefaultAvatar } from "@/components/three/Teacher";
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
import { LayoutDashboard, LogOut, Map as MapIcon, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import {
  TOP_BAR, GlassPill, ClassroomWordmark, PillDivider, panelColumn, PANEL_SLOT,
} from "@/components/learn/ClassroomChrome";
import { SHAPE } from "@/lib/design/shape";
import { cn } from "@/lib/utils";

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

  // Warm the default avatar's GLBs. Teacher.tsx used to do this at module
  // scope, which also charged /demo for an avatar it does not render (see
  // preloadDefaultAvatar's comment). /learn is the page that actually starts
  // on DEFAULT_TEACHER, so it owns the preload.
  useEffect(() => {
    preloadDefaultAvatar();
  }, []);

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

  // The quiz is on the desk (the same condition as the strip below): the panel
  // collapses to that strip so the paper is not under it. CSS only.
  const quizOnDesk = mode === "course" && !!activeQuiz;

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
        <div className="flex items-center justify-center gap-2 rounded-b-2xl border-t border-line bg-surface/95 px-4 py-3 text-sm text-body backdrop-blur-md">
          <span className="size-1.5 rounded-full bg-accent-text motion-safe:animate-pulse" />
          <span>Your quiz is on the desk. Look down.</span>
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

      {/* Top nav. Above the mode picker's blur (z-30) so the wordmark stays sharp
          on the first screen; dialogs (map z-40, dashboard, review, onboarding and
          the lightbox at z-50) still cover it. Ink glass on the room
          (ClassroomChrome). Below md the actions are icons with their names kept
          for screen readers. */}
      <div className={cn(TOP_BAR, "z-[35]")}>
        <ClassroomWordmark />

        <GlassPill>
          {/* Reviews-due chip — Phase 6 */}
          {localOnboarded && overdueCount > 0 && (
            <Button
              onClick={() => setShowReview(true)}
              className="rounded-full px-3"
              title="Start your daily review"
            >
              <RotateCcw aria-hidden />
              <span>{overdueCount}<span className="max-md:sr-only"> due</span></span>
            </Button>
          )}
          {/* Progress dashboard button */}
          {localOnboarded && (
            <Button
              variant="ghost"
              onClick={() => setShowDashboard(true)}
              className="rounded-full px-3 text-body hover:text-ink max-md:w-11 max-md:px-0"
              title="View your progress"
            >
              <LayoutDashboard aria-hidden />
              <span className="max-md:sr-only">Progress</span>
            </Button>
          )}
          {/* Map button — visible while in a course that has structure */}
          {mode === "course" && course.structure && (
            <Button
              variant="ghost"
              onClick={handleViewMap}
              className="rounded-full px-3 text-body hover:text-ink max-md:w-11 max-md:px-0"
              title="View course map"
            >
              <MapIcon aria-hidden />
              <span className="max-md:sr-only">Map</span>
            </Button>
          )}
          <PillDivider />
          <span className="hidden min-w-0 items-center gap-2 px-2 md:flex">
            <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full border border-tint-line bg-tint text-xs font-bold text-accent-text">
              {userName[0]?.toUpperCase()}
            </span>
            <span className="max-w-[10rem] truncate text-sm font-medium text-ink">{userName}</span>
          </span>
          <ThemeToggle className="rounded-full border-transparent text-body hover:border-transparent hover:bg-sunk hover:text-ink" />
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="rounded-full px-3 text-body hover:text-ink max-md:w-11 max-md:px-0"
          >
            <LogOut aria-hidden />
            <span className="max-md:sr-only">Sign out</span>
          </Button>
        </GlassPill>
      </div>

      {/* Right panel */}
      <div className={panelColumn(quizOnDesk)}>
        <div className={quizOnDesk ? "hidden" : "contents"}>
          <TeacherControls onClear={handleClear} />
        </div>
        <div className={cn(PANEL_SLOT, quizOnDesk && "hidden")}>
          <MessagePanel />
        </div>
        {renderBottom()}
      </div>

      {/* Onboarding overlay. Onboarding, the course map and the dashboard are
          not on the design system yet (V8.6): `.theme-paper` keeps them light
          in both themes, as the lock did. */}
      {!localOnboarded && (
        <div className="theme-paper absolute inset-0 z-50 text-ink">
          <OnboardingView userName={userName} onComplete={handleOnboardingComplete} />
        </div>
      )}

      {/* Mode picker overlay */}
      {localOnboarded && showPicker && (
        <ModePicker onExplore={handleExplore} onStartCourse={handleStartCourse} />
      )}

      {/* Course map overlay */}
      {showCourseMap && pendingCourse && (
        <div className="theme-paper contents text-ink">
        <CourseMapView
          courseId={pendingCourse.id}
          currentTopicIndex={
            pendingCourse.id === course.courseId ? course.currentTopicIndex : 0
          }
          onSelectConcept={handleSelectConcept}
          onClose={handleCloseMap}
        />
        </div>
      )}

      {/* Student dashboard overlay — Phase 9 */}
      {showDashboard && (
        <div className="theme-paper contents text-ink">
          <DashboardView onClose={() => setShowDashboard(false)} />
        </div>
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
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setPreviewZoomUrl(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewZoomUrl}
            alt="Teaching diagram"
            onClick={(e) => e.stopPropagation()}
            className={cn(SHAPE.surface, "max-h-[80vh] max-w-[min(90vw,700px)] object-contain shadow-e2")}
          />
          <div className="theme-ink absolute right-5 top-5">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setPreviewZoomUrl(null)}
              aria-label="Close image"
              className="rounded-full"
            >
              <X aria-hidden />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
