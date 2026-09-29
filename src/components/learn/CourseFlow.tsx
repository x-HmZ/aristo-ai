"use client";

/**
 * CourseFlow
 *
 * Course-mode bottom-bar state components.
 * The active quiz is handled by QuizView (src/components/quiz/QuizView.tsx).
 *
 *   CourseLoadingBar   — while the auto-teach API call is in flight
 *   CourseTakeQuizBar  — lesson loaded, quiz not yet started
 *   CourseAdvanceBar   — quiz done, shows "Next topic" or "Finish course"
 *
 * On the design system since V8.4b: they follow the theme like the lesson panel
 * above them (light under the Pages Router lock until V8.4c removes it).
 */

import { ArrowRight, CircleCheck, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const BAR = "rounded-b-2xl border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-md";

// ─── Loading bar (auto-teach in flight) ──────────────────────────────────────

export function CourseLoadingBar() {
  return (
    <div className={cn(BAR, "flex items-center gap-2")}>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 rounded-full bg-accent-text motion-safe:animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <span className="text-sm text-muted">Loading your lesson…</span>
    </div>
  );
}

// ─── Take Quiz bar ────────────────────────────────────────────────────────────

export function CourseTakeQuizBar({
  onTakeQuiz,
  isLoading,
}: {
  onTakeQuiz: () => void;
  isLoading:  boolean;
}) {
  return (
    <div className={BAR}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="text-sm font-medium text-body">
          Ready for the quiz?
        </p>
        <Button onClick={onTakeQuiz} disabled={isLoading} className="shrink-0">
          {isLoading ? "Loading quiz…" : (<>Take the quiz<ArrowRight aria-hidden /></>)}
        </Button>
      </div>
    </div>
  );
}

// ─── Advance bar (quiz complete) ──────────────────────────────────────────────

export function CourseAdvanceBar({
  score,
  total,
  isLastTopic,
  onAdvance,
  onFinish,
}: {
  score:       number;
  total:       number;
  isLastTopic: boolean;
  onAdvance:   () => void;
  onFinish:    () => void;
}) {
  const pct        = total > 0 ? Math.round((score / total) * 100) : 0;
  const passed     = score >= Math.ceil(total * 0.6);
  // Colour is never the only cue: the icon and the words change with it.
  const scoreColor = passed ? "text-success" : pct >= 40 ? "text-warning" : "text-danger";
  const Icon       = passed ? CircleCheck : TrendingUp;

  return (
    <div className={BAR}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className={cn("flex items-center gap-2", scoreColor)}>
          <Icon aria-hidden className="size-5 shrink-0" />
          <div>
            <span className="text-sm font-bold tabular-nums">
              {score}/{total}
            </span>
            <span className="ml-1.5 text-sm text-body">
              {passed ? "Nice work." : "Keep going."}
            </span>
          </div>
        </div>
        <Button onClick={isLastTopic ? onFinish : onAdvance} className="shrink-0">
          {isLastTopic ? "Finish course" : (<>Next topic<ArrowRight aria-hidden /></>)}
        </Button>
      </div>
    </div>
  );
}
