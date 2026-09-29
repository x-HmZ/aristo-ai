"use client";

/**
 * ReviewView — Phase 6 Spaced Repetition
 *
 * Daily review session UI. Fetches overdue concepts from /api/quiz/review,
 * then renders them using QuizView with context="review" so SRS intervals
 * are updated (not just BKT mastery).
 *
 * Shows a completion summary: "You reviewed N concepts, M correct."
 */

import { useState, useEffect, useCallback } from "react";
import { QuizView }                          from "@/components/quiz/QuizView";
import type { QuizQuestion }                 from "@/lib/agents/assessment";

interface ReviewViewProps {
  userId:   string;
  onClose:  () => void;
}

type ReviewPhase = "loading" | "empty" | "quiz" | "done";

export function ReviewView({ userId, onClose }: ReviewViewProps) {
  const [phase,        setPhase]        = useState<ReviewPhase>("loading");
  const [questions,    setQuestions]    = useState<QuizQuestion[]>([]);
  const [conceptCount, setConceptCount] = useState(0);
  const [result,       setResult]       = useState<{ score: number; total: number } | null>(null);

  // ── Fetch review questions on mount ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/quiz/review");
        if (!res.ok) throw new Error("Review API failed");
        const data = await res.json() as { questions: QuizQuestion[]; conceptCount: number };

        if (cancelled) return;

        if (!data.questions || data.questions.length === 0) {
          setPhase("empty");
        } else {
          setQuestions(data.questions);
          setConceptCount(data.conceptCount);
          setPhase("quiz");
        }
      } catch {
        if (!cancelled) setPhase("empty");
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const handleComplete = useCallback((score: number, total: number) => {
    setResult({ score, total });
    setPhase("done");
  }, []);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-white/90 rounded-2xl px-8 py-7 shadow-xl flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-aristo-orange-main border-t-transparent animate-spin" />
          <p className="text-sm font-medium text-aristo-brown-main">Loading your review…</p>
        </div>
      </div>
    );
  }

  // ── No reviews due ─────────────────────────────────────────────────────────
  if (phase === "empty") {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-white/95 rounded-2xl px-8 py-7 shadow-xl flex flex-col items-center gap-4 max-w-sm text-center">
          <span className="text-3xl">🎉</span>
          <p className="text-base font-semibold text-aristo-brown-main">All caught up!</p>
          <p className="text-sm text-aristo-brown-muted">No reviews are due right now. Come back later or keep learning.</p>
          <button
            onClick={onClose}
            className="mt-1 px-5 py-2.5 rounded-xl text-sm font-semibold bg-aristo-orange-main text-accent-ink hover:bg-accent-hover transition-all"
          >
            Back to Learning
          </button>
        </div>
      </div>
    );
  }

  // ── Completion summary ─────────────────────────────────────────────────────
  if (phase === "done" && result) {
    const pct        = Math.round((result.score / result.total) * 100);
    const allCorrect = result.score === result.total;
    const mostRight  = pct >= 70;

    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-white/95 rounded-2xl px-8 py-7 shadow-xl flex flex-col items-center gap-4 max-w-sm text-center">
          <span className="text-4xl">{allCorrect ? "🏆" : mostRight ? "✅" : "💪"}</span>

          <div>
            <p className="text-lg font-bold text-aristo-brown-main">Review Complete</p>
            <p className="text-sm text-aristo-brown-muted mt-0.5">
              You reviewed <span className="font-semibold text-aristo-brown-main">{conceptCount}</span>{" "}
              concept{conceptCount !== 1 ? "s" : ""} —{" "}
              <span className="font-semibold text-aristo-brown-main">{result.score}</span> of{" "}
              <span className="font-semibold text-aristo-brown-main">{result.total}</span> correct ({pct}%)
            </p>
          </div>

          <p className="text-xs text-aristo-brown-faint">
            {allCorrect
              ? "Perfect retention! Your review intervals have been extended."
              : mostRight
              ? "Good work — keep it up and those concepts will stick."
              : "Keep reviewing — repetition is how memory forms."}
          </p>

          <button
            onClick={onClose}
            className="mt-1 px-5 py-2.5 rounded-xl text-sm font-semibold bg-aristo-orange-main text-accent-ink hover:bg-accent-hover transition-all"
          >
            Continue Learning
          </button>
        </div>
      </div>
    );
  }

  // ── Active quiz ────────────────────────────────────────────────────────────
  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-black/40 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white/90 backdrop-blur-md border-b border-white/50 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-aristo-orange-main font-bold text-lg">↻</span>
          <div>
            <p className="text-sm font-bold text-aristo-brown-main">Daily Review</p>
            <p className="text-[11px] text-aristo-brown-muted">
              {conceptCount} concept{conceptCount !== 1 ? "s" : ""} due · {questions.length} question{questions.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-aristo-brown-muted hover:text-aristo-brown-main transition-colors font-medium"
        >
          Skip for now
        </button>
      </div>

      {/* Quiz panel — centred, same width as the right panel */}
      <div className="flex-1 flex items-start justify-end pr-5 pt-4 pb-5 overflow-y-auto">
        <div className="w-[400px]">
          <QuizView
            conceptId={questions[0]?.concept_id ?? ""}
            questions={questions}
            userId={userId}
            context="review"
            onComplete={handleComplete}
          />
        </div>
      </div>
    </div>
  );
}
