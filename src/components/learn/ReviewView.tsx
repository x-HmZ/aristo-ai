"use client";

/**
 * ReviewView — Phase 6 Spaced Repetition
 *
 * Daily review session UI. Fetches overdue concepts from /api/quiz/review,
 * then renders them using QuizView with context="review" so SRS intervals
 * are updated (not just BKT mastery).
 *
 * Shows a completion summary: "You reviewed N concepts. M of T correct."
 *
 * On the design system (V8.4c): it follows the theme. The system scrim over
 * the room, surface cards, and QuizView (host-agnostic since V8.4b) in the
 * lesson panel's column.
 */

import { useState, useEffect, useCallback } from "react";
import { CircleCheck, RotateCcw, TrendingUp } from "lucide-react";
import { QuizView }                          from "@/components/quiz/QuizView";
import type { QuizQuestion }                 from "@/lib/agents/assessment";
import { Button }                            from "@/components/ui/button";
import { SHAPE }                             from "@/lib/design/shape";
import { cn }                                from "@/lib/utils";

const SCRIM = "absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm";
const CARD  = cn(SHAPE.surface, "flex flex-col border border-line bg-surface px-8 py-7 shadow-e2");

function CardIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex size-12 items-center justify-center rounded-full border border-tint-line bg-tint text-accent-text [&_svg]:size-6">
      {children}
    </span>
  );
}

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
      <div className={SCRIM}>
        <div role="status" className={cn(CARD, "items-center gap-3")}>
          <div aria-hidden className="size-8 rounded-full border-2 border-accent border-t-transparent motion-safe:animate-spin" />
          <p className="text-sm font-medium text-ink">Loading your review…</p>
        </div>
      </div>
    );
  }

  // ── No reviews due ─────────────────────────────────────────────────────────
  if (phase === "empty") {
    return (
      <div className={SCRIM}>
        <div className={cn(CARD, "max-w-sm items-center gap-4 text-center")}>
          <CardIcon><CircleCheck aria-hidden /></CardIcon>
          <div>
            <h2 className="type-h4 font-semibold text-ink">All Caught Up</h2>
            <p className="mt-1 text-sm text-body">Nothing is due. Each concept comes back before you would forget it.</p>
          </div>
          <Button onClick={onClose}>Back to learning</Button>
        </div>
      </div>
    );
  }

  // ── Completion summary ─────────────────────────────────────────────────────
  if (phase === "done" && result) {
    const pct        = Math.round((result.score / result.total) * 100);
    const allCorrect = result.score === result.total;
    const mostRight  = pct >= 70;
    // Status in words and an icon, never colour alone (the DemoResultBar pattern).
    const status = allCorrect
      ? { Icon: CircleCheck, tone: "text-success", line: "Every answer right. These come back later now." }
      : mostRight
      ? { Icon: TrendingUp, tone: "text-warning", line: "Good work. Keep going and these will stick." }
      : { Icon: RotateCcw, tone: "text-danger", line: "These come back sooner, so you get another go." };

    return (
      <div className={SCRIM}>
        <div className={cn(CARD, "max-w-sm items-center gap-4 text-center")}>
          <CardIcon><RotateCcw aria-hidden /></CardIcon>

          <div>
            <h2 className="type-h4 font-bold text-ink">Review Complete</h2>
            <p className="mt-1 text-sm text-body">
              You reviewed <span className="font-semibold text-ink">{conceptCount}</span>{" "}
              concept{conceptCount !== 1 ? "s" : ""}.{" "}
              <span className="font-semibold text-ink">{result.score}</span> of{" "}
              <span className="font-semibold text-ink">{result.total}</span> correct ({pct}%).
            </p>
          </div>

          <p className={cn("flex items-start gap-2 text-left text-sm font-medium", status.tone)}>
            <status.Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
            {status.line}
          </p>

          <Button onClick={onClose}>Continue learning</Button>
        </div>
      </div>
    );
  }

  // ── Active quiz ────────────────────────────────────────────────────────────
  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-black/50 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-line bg-surface/95 px-5 py-2 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-2.5">
          <RotateCcw aria-hidden className="size-5 shrink-0 text-accent-text" />
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-ink">Daily Review</h2>
            <p className="truncate text-xs text-muted">
              {conceptCount} concept{conceptCount !== 1 ? "s" : ""} due · {questions.length} question{questions.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button variant="ghost" onClick={onClose} className="shrink-0 px-3 text-body">
          Skip for now
        </Button>
      </div>

      {/* Quiz panel: in the lesson panel's column (right-5, 400px) */}
      <div className="aristo-scroll flex flex-1 items-start justify-end overflow-y-auto pb-5 pr-5 pt-4">
        <div className="w-[400px] max-w-[calc(100vw-2.5rem)]">
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
