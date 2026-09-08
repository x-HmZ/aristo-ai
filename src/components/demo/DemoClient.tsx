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
import { useGLTF } from "@react-three/drei";
import { AristoCanvas } from "@/components/learn/AristoCanvas";
import { SceneLoadingOverlay } from "@/components/learn/SceneLoadingOverlay";
import { LessonPlayer } from "@/components/learn/LessonPlayer";
import { CourseTakeQuizBar } from "@/components/learn/CourseFlow";
import { useAristoStore } from "@/store/useAristoStore";
import { AVATAR_ASSETS } from "@/components/three/Teacher";
import { DEMO_TOPICS, type DemoTopic } from "@/data/demo";

/**
 * The demo must use an avatar that can actually lipsync. Only the Avaturn
 * rigs (marcus, priya) carry the 15 ARKit viseme blend shapes wawa-lipsync
 * drives; Teacher.tsx gates the viseme path on cfg.morphs.visemes, which
 * they alone set. The store default (ryan) has 0 viseme morphs and only a
 * binary mouthSmile, so his mouth never moves while narrating -- on the one
 * page whose job is to show a talking 3D teacher.
 *
 * marcus pairs with the already-rendered narration voice (ElevenLabs Antoni).
 * Switching to priya would mean re-rendering every segment.
 *
 * This currently equals DEFAULT_TEACHER, but is set explicitly rather than
 * relying on that: /demo's narration files are baked against this avatar's
 * voice, and the demo is the one page that cannot tolerate a mute mouth, so a
 * future change to the global default must not silently retarget it.
 */
const DEMO_TEACHER = "marcus" as const;

// ─── Topic picker overlay ─────────────────────────────────────────────────────

function TopicPicker({ onPick }: { onPick: (topic: DemoTopic) => void }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#1E0E06]/55 backdrop-blur-sm px-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white/90 backdrop-blur-xl border border-white/60 shadow-[0_24px_80px_rgba(30,14,6,0.35)] p-8">
        <div className="text-center mb-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF5EC] border border-[#F97B2F]/25 text-[10px] font-bold uppercase tracking-widest text-[#C45A10] mb-3">
            Live demo — no account needed
          </span>
          <h1 className="text-2xl font-bold text-[#3D2110]">Pick a lesson to watch</h1>
          <p className="text-sm text-[#8B6E5A] mt-1">
            Your 3D teacher will explain it, show visuals, and quiz you at the end.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DEMO_TOPICS.map((topic) => (
            <button
              key={topic.slug}
              onClick={() => onPick(topic)}
              className="text-left rounded-2xl bg-[#FFF8F2] border border-[#F97B2F]/20 p-5 hover:border-[#F97B2F]/50 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(249,123,47,0.2)] transition-all"
            >
              <div className="text-3xl mb-2">{topic.emoji}</div>
              <div className="font-bold text-[#3D2110] mb-1">{topic.title}</div>
              <div className="text-xs text-[#8B6E5A] leading-relaxed">{topic.blurb}</div>
            </button>
          ))}
        </div>
      </div>
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
  return (
    <div className="px-4 py-3 bg-white/50 backdrop-blur-xl border-t border-[#F97B2F]/30 rounded-b-2xl space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="text-sm">{passed ? "🎉" : "💪"}</span>
        <span className="text-sm font-bold text-[#3D2110] tabular-nums">{score}/{total} correct</span>
      </div>
      <p className="text-xs text-[#8B6E5A] leading-relaxed">
        Aristo remembers what you learn and adjusts every lesson to your pace. Sign up to keep this progress and start your own course.
      </p>
      <div className="flex items-center gap-2">
        <Link
          href="/sign-up"
          className="flex-1 text-center px-4 py-2 rounded-xl text-xs font-semibold bg-[#F97B2F] text-white hover:bg-[#E06A20] shadow-aristo-sm transition-all"
        >
          Create your free account →
        </Link>
        <button
          onClick={onTryAnother}
          className="shrink-0 px-3 py-2 rounded-xl text-xs font-medium text-[#8B6E5A] hover:text-[#3D2110] transition-colors"
        >
          Try another topic
        </button>
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

  const activeQuiz  = useAristoStore((s) => s.activeQuiz);
  const quizResult  = useAristoStore((s) => s.quizResult);

  const [topic, setTopic] = useState<DemoTopic | null>(null);

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
    setTeacher(DEMO_TEACHER);

    // Warm the avatar while the topic picker is on screen. Teacher.tsx only
    // module-preloads ryan (T02 trimmed the cold payload to default-only), and
    // the Avaturn rig plus its shared animation pack is ~11.6 MB, so without
    // this the download does not start until the visitor picks a topic.
    useGLTF.preload(`/models/${AVATAR_ASSETS[DEMO_TEACHER].sceneFile}`);
    useGLTF.preload(`/models/${AVATAR_ASSETS[DEMO_TEACHER].animFile}`);

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
        <div className="px-4 py-3 bg-white/55 backdrop-blur-xl border-t border-[#F97B2F]/30 rounded-b-2xl flex items-center justify-center gap-2 text-xs text-[#8B6E5A]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F97B2F] animate-pulse" />
          <span>Quiz on your desk — look down</span>
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

      {/* Top nav */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-[#3D2110] text-xl tracking-tight">aristo</span>
          <span className="text-[#F97B2F] text-xl font-bold">✦</span>
        </div>

        {/* Persistent, unobtrusive demo banner + soft CTA */}
        <div className="flex items-center gap-3 bg-white/60 backdrop-blur-md border border-white/50 rounded-full px-4 py-1.5 shadow-sm">
          <span className="text-xs text-[#8B6E5A]">
            You&apos;re in the demo
          </span>
          <span className="w-px h-3 bg-[#E8D5BC]" />
          <Link
            href="/sign-up"
            className="text-xs font-semibold text-[#F97B2F] hover:text-[#E06A20] transition-colors"
          >
            Create an account →
          </Link>
        </div>
      </div>

      {/* Right panel */}
      {topic && (
        <div className="absolute right-5 top-[68px] bottom-5 z-10 w-[400px] flex flex-col rounded-2xl overflow-hidden shadow-[0_8px_40px_rgba(249,123,47,0.18)] border border-white/40">
          <div className="px-4 py-2.5 bg-white/55 backdrop-blur-xl border-b border-white/40 flex items-center gap-2">
            <span className="text-sm">{topic.emoji}</span>
            <span className="text-sm font-bold text-[#3D2110] truncate flex-1">{topic.title}</span>
            <button
              onClick={handleTryAnother}
              className="text-[11px] text-[#8B6E5A] hover:text-[#3D2110] font-medium transition-colors shrink-0"
            >
              Change topic
            </button>
          </div>
          <div className="flex-1 overflow-hidden bg-white/25 backdrop-blur-xl">
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
