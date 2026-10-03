"use client";

/**
 * DemoClient — the unauthenticated /demo experience shell.
 *
 * A leaner sibling of LearnClient: reuses AristoCanvas / Experience /
 * LessonPlayer directly instead of threading a demoMode flag through the
 * full authed shell (course auto-teach, session flush, profile hydration,
 * review polling — none of which apply to a signed-out visitor and all of
 * which call authed API routes).
 *
 * Every interaction here is local: topics are frozen LessonPayload objects
 * from src/data/demo, the desk quiz is evaluated client-side, and narration
 * plays from static mp3s under public/demo/<slug>/ (rendered once by
 * scripts/prerender-demo-tts.mjs) — so a demo session never calls
 * /api/anything.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, CircleCheck, HeartPulse, Mountain, TrendingUp } from "lucide-react";
import { useGLTF } from "@react-three/drei";
import { AristoCanvas } from "@/components/learn/AristoCanvas";
import { SceneLoadingOverlay } from "@/components/learn/SceneLoadingOverlay";
import { LessonPlayer } from "@/components/learn/LessonPlayer";
import { CourseTakeQuizBar } from "@/components/learn/CourseFlow";
import { Button } from "@/components/ui/button";
import { useAristoStore, ACTIVE_TEACHERS } from "@/store/useAristoStore";
import { AVATAR_ASSETS } from "@/components/three/Teacher";
import { AvatarCredit } from "@/components/learn/AvatarCredit";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import {
  TOP_BAR, GlassPill, ClassroomWordmark, PillDivider, panelColumn, PANEL_SLOT,
} from "@/components/learn/ClassroomChrome";
import { DEMO_TOPICS, type DemoTopic } from "@/data/demo";
import { demoTeacherFrom } from "./demoTeacher";
import { FOCUS, PRESS, SHAPE } from "@/lib/design/shape";
import { cn } from "@/lib/utils";

/**
 * The avatar the demo opens on. It must lipsync (the page exists to show a
 * talking 3D teacher), and it pairs with the pre-rendered narration, which is
 * a male voice (ElevenLabs Antoni, public/demo/<slug>/audio.json). The visitor
 * can switch to any ACTIVE_TEACHERS avatar; MJ then speaks with that same male
 * narration until a female one is rendered.
 *
 * Set explicitly rather than read from DEFAULT_TEACHER: the narration files are
 * baked against this voice, so a future change to the global default must not
 * silently retarget the demo.
 */
const DEMO_TEACHER = "jake" as const;

/** An icon per demo topic (the data's emoji is not rendered: no emoji in the UI). */
const TOPIC_ICON: Record<string, typeof BookOpen> = {
  "volcano-eruption": Mountain,
  heart: HeartPulse,
};
const topicIcon = (slug: string) => TOPIC_ICON[slug] ?? BookOpen;

/** The segmented control's item (TeacherControls' pattern). */
function segmentClass(selected: boolean) {
  return cn(
    FOCUS,
    "flex h-11 shrink-0 items-center rounded-[6px] px-3 text-sm font-semibold transition-colors duration-fast ease-out-soft",
    selected ? "bg-surface text-ink shadow-e1" : "text-body hover:text-ink",
  );
}

// ─── Topic picker overlay ─────────────────────────────────────────────────────

// The system scrim over the room and a surface card that follows the theme.
function TopicPicker({ onPick }: { onPick: (topic: DemoTopic) => void }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/50 px-4 py-20 backdrop-blur-sm">
      <section
        aria-labelledby="demo-picker-title"
        className={cn(SHAPE.surface, "w-full max-w-2xl border border-line bg-surface p-6 shadow-e2 sm:p-8")}
      >
        <div className="mb-6 text-center">
          <span className="mb-3 inline-flex items-center rounded-full border border-tint-line bg-tint px-3 py-1 text-xs font-medium text-ink">
            No account needed
          </span>
          <h1 id="demo-picker-title" className="type-h2 font-bold text-ink">Pick a Lesson to Watch</h1>
          <p className="mt-2 text-sm text-body">
            Your teacher explains it out loud, shows it on the board, then puts a quiz on your desk.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {DEMO_TOPICS.map((topic) => {
            const Icon = topicIcon(topic.slug);
            return (
              <button
                key={topic.slug}
                onClick={() => onPick(topic)}
                className={cn(
                  SHAPE.surface,
                  FOCUS,
                  PRESS,
                  "border border-line bg-surface p-5 text-left duration-fast hover:border-muted/50 hover:bg-sunk",
                )}
              >
                <span className="mb-3 flex size-10 items-center justify-center rounded-full border border-tint-line bg-tint text-accent-text">
                  <Icon aria-hidden className="size-5" />
                </span>
                <span className="mb-1 block font-bold text-ink">{topic.title}</span>
                <span className="block text-sm leading-relaxed text-body">{topic.blurb}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ─── Final CTA (quiz complete) ────────────────────────────────────────────────

function DemoResultBar({
  score,
  total,
  onTryAnother,
}: {
  score: number;
  total: number;
  onTryAnother: () => void;
}) {
  const passed = score >= Math.ceil(total * 0.6);
  const Icon = passed ? CircleCheck : TrendingUp;
  return (
    <div className="space-y-2.5 rounded-b-2xl border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-md">
      <div className="flex items-center gap-2 text-ink">
        <Icon aria-hidden className={passed ? "size-5 text-success" : "size-5 text-warning"} />
        <span className="text-sm font-bold tabular-nums">{score}/{total} correct</span>
      </div>
      <p className="type-caption text-body">
        Aristo remembers what you know and paces each lesson to your answers. Create an account to keep this progress.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild className="flex-1">
          <Link href="/sign-up">
            Create an account
            <ArrowRight aria-hidden />
          </Link>
        </Button>
        <Button variant="ghost" onClick={onTryAnother} className="shrink-0 text-body">
          Try another topic
        </Button>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DemoClient() {
  const setDemoMode      = useAristoStore((s) => s.setDemoMode);
  const setUserId        = useAristoStore((s) => s.setUserId);
  const setActiveLesson  = useAristoStore((s) => s.setActiveLesson);
  const setActiveQuiz    = useAristoStore((s) => s.setActiveQuiz);
  const setQuizResult    = useAristoStore((s) => s.setQuizResult);
  const setActiveModelUrl = useAristoStore((s) => s.setActiveModelUrl);
  const setActivePreviewImageUrl = useAristoStore((s) => s.setActivePreviewImageUrl);
  const setPending3dImageUrl = useAristoStore((s) => s.setPending3dImageUrl);
  const setViewMode3d    = useAristoStore((s) => s.setViewMode3d);
  const stopAudio        = useAristoStore((s) => s.stopAudio);
  const setTeacher       = useAristoStore((s) => s.setTeacher);
  const teacher          = useAristoStore((s) => s.teacher);

  const activeQuiz  = useAristoStore((s) => s.activeQuiz);
  const quizResult  = useAristoStore((s) => s.quizResult);

  const [topic, setTopic] = useState<DemoTopic | null>(null);
  // The quiz is on the desk: the panel collapses to its strip (CSS only).
  const quizOnDesk = !!activeQuiz;
  const TopicIcon = topicIcon(topic?.slug ?? "");

  // Boot: mark demo mode + a stable non-null userId (DeskQuiz's guard checks
  // truthiness only — no learner row is ever read/written for it). Reset
  // everything on unmount so a subsequent authed /learn session never
  // inherits demo state from the shared sessionStorage-backed store.
  useEffect(() => {
    setDemoMode(true);
    setUserId("demo-visitor");

    // Remember whatever the visitor had chosen so an authed /learn session
    // later in the same tab does not inherit the demo's avatar.
    const previousTeacher = useAristoStore.getState().teacher;
    // The landing's choice comes in as ?teacher= (V8.3c); MJ then speaks with the demo's male narration, as when
    // switched here.
    const opening = demoTeacherFrom(window.location.search, DEMO_TEACHER);
    setTeacher(opening);

    // Warm the avatar while the topic picker is on screen: Teacher.tsx does not
    // preload at module scope, so without this the download does not start
    // until the visitor picks a topic.
    useGLTF.preload(`/models/${AVATAR_ASSETS[opening].sceneFile}`);
    useGLTF.preload(`/models/${AVATAR_ASSETS[opening].animFile}`);

    return () => {
      stopAudio();
      setTeacher(previousTeacher);
      setDemoMode(false);
      setUserId(null);
      setActiveLesson(null);
      setActiveQuiz(null);
      setQuizResult(null);
      setActiveModelUrl(null);
      setActivePreviewImageUrl(null);
      setPending3dImageUrl(null);
      setViewMode3d(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePick = useCallback((t: DemoTopic) => {
    setTopic(t);
    setQuizResult(null);
    setActiveQuiz(null);
    setActiveLesson(t.lesson);
  }, [setActiveLesson, setActiveQuiz, setQuizResult]);

  const handleTakeQuiz = useCallback(() => {
    if (!topic) return;
    setActiveQuiz({ conceptId: topic.lesson.concept_id, questions: topic.quiz });
  }, [topic, setActiveQuiz]);

  const handleTryAnother = useCallback(() => {
    stopAudio();
    setTopic(null);
    setQuizResult(null);
    setActiveQuiz(null);
    setActiveLesson(null);
    setActiveModelUrl(null);
    setActivePreviewImageUrl(null);
    setPending3dImageUrl(null);
    setViewMode3d(false);
  }, [stopAudio, setActiveLesson, setActiveQuiz, setQuizResult, setActiveModelUrl, setActivePreviewImageUrl, setPending3dImageUrl, setViewMode3d]);

  const renderBottom = () => {
    if (!topic) return null;
    if (activeQuiz) {
      return (
        <div className="flex items-center justify-center gap-2 bg-surface/95 px-4 py-3 text-sm text-body backdrop-blur-md">
          <span className="size-1.5 rounded-full bg-accent-text motion-safe:animate-pulse" />
          <span>Your quiz is on the desk. Look down.</span>
        </div>
      );
    }
    if (quizResult !== null) {
      return (
        <DemoResultBar score={quizResult.score} total={quizResult.total} onTryAnother={handleTryAnother} />
      );
    }
    return <CourseTakeQuizBar onTakeQuiz={handleTakeQuiz} isLoading={false} />;
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* 3D scene */}
      <div className="absolute inset-0 z-0">
        <AristoCanvas />
      </div>

      <SceneLoadingOverlay />

      {/* Top nav. Above the topic picker's blur (z-40) so the wordmark stays sharp
          on the first screen. Ink glass on the room (ClassroomChrome). */}
      <div className={cn(TOP_BAR, "z-[45]")}>
        <ClassroomWordmark />

        {/* Persistent, unobtrusive demo banner + soft CTA */}
        <GlassPill>
          <span className="hidden px-3 text-sm text-body sm:inline">
            You&apos;re in the demo
          </span>
          <PillDivider />
          <Button asChild variant="ghost" className="rounded-full px-3 text-accent-text hover:text-accent-text">
            <Link href="/sign-up">
              Create an account
              <ArrowRight aria-hidden />
            </Link>
          </Button>
          <ThemeToggle className="rounded-full border-transparent text-body hover:border-transparent hover:bg-sunk hover:text-ink" />
        </GlassPill>
      </div>

      {/* Right panel */}
      {topic && (
        <div className={panelColumn(quizOnDesk)}>
          <div className={cn("flex flex-col gap-2 rounded-t-2xl border-b border-line bg-surface/95 px-4 py-3 backdrop-blur-xl", quizOnDesk && "hidden")}>
            <div className="flex items-center gap-2">
              <TopicIcon aria-hidden className="size-4 shrink-0 text-accent-text" />
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{topic.title}</span>
              <Button variant="ghost" onClick={handleTryAnother} className="shrink-0 px-3 text-body">
                Change topic
              </Button>
            </div>
            {/* Teacher switcher, with the licence credit for the one on screen. */}
            <div className="flex items-center gap-3">
              <span id="demo-teacher-label" className="shrink-0 text-xs font-semibold text-muted">Teacher</span>
              <div role="group" aria-labelledby="demo-teacher-label" className={cn(SHAPE.control, "flex items-center gap-1 bg-sunk p-1")}>
                {ACTIVE_TEACHERS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTeacher(t)}
                    onMouseEnter={() => {
                      useGLTF.preload(`/models/${AVATAR_ASSETS[t].sceneFile}`);
                      useGLTF.preload(`/models/${AVATAR_ASSETS[t].animFile}`);
                    }}
                    aria-pressed={teacher === t}
                    className={segmentClass(teacher === t)}
                  >
                    {AVATAR_ASSETS[t].label}
                  </button>
                ))}
              </div>
            </div>
            <AvatarCredit avatar={teacher} className="px-1" />
          </div>
          <div className={cn(PANEL_SLOT, quizOnDesk && "hidden")}>
            <LessonPlayer demoMode />
          </div>
          {renderBottom()}
        </div>
      )}

      {/* Topic picker */}
      {!topic && <TopicPicker onPick={handlePick} />}
    </div>
  );
}
