"use client";

/**
 * CourseFlow
 *
 * Course-mode bottom-bar state components.
 * The active quiz is handled by QuizView (src/components/quiz/QuizView.tsx).
 *
 *   CourseLoadingBar   — while the auto-teach API call is in flight
 *   CourseTakeQuizBar  — lesson loaded, quiz not yet started
 *   CourseAdvanceBar   — quiz done, shows "Next Topic" or "Finish Course"
 */

// ─── Loading bar (auto-teach in flight) ──────────────────────────────────────

export function CourseLoadingBar() {
  return (
    <div className="px-4 py-3 bg-white/40 backdrop-blur-xl border-t border-white/40 rounded-b-2xl flex items-center gap-2">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[#F97B2F] animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <span className="text-xs text-[#8B6E5A]">Loading your lesson…</span>
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
    <div className="px-4 py-3 bg-white/40 backdrop-blur-xl border-t border-white/40 rounded-b-2xl">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-[#8B6E5A] font-medium">
          Lesson complete — ready to test your knowledge?
        </p>
        <button
          onClick={onTakeQuiz}
          disabled={isLoading}
          className="shrink-0 px-4 py-2 rounded-xl text-xs font-semibold bg-[#F97B2F] text-white hover:bg-[#E06A20] disabled:opacity-50 shadow-aristo-sm transition-all"
        >
          {isLoading ? "Loading quiz…" : "Take Quiz →"}
        </button>
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
  const scoreColor = passed ? "#16A34A" : pct >= 40 ? "#C45A10" : "#DC2626";

  return (
    <div className="px-4 py-3 bg-white/40 backdrop-blur-xl border-t border-white/40 rounded-b-2xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">{passed ? "🎉" : "💪"}</span>
          <div>
            <span className="text-sm font-bold tabular-nums" style={{ color: scoreColor }}>
              {score}/{total}
            </span>
            <span className="text-xs text-[#8B6E5A] ml-1.5">
              {passed ? "Nice work!" : "Keep going!"}
            </span>
          </div>
        </div>
        <button
          onClick={isLastTopic ? onFinish : onAdvance}
          className="shrink-0 px-4 py-2 rounded-xl text-xs font-semibold bg-[#F97B2F] text-white hover:bg-[#E06A20] shadow-aristo-sm transition-all"
        >
          {isLastTopic ? "Finish Course ✓" : "Next Topic →"}
        </button>
      </div>
    </div>
  );
}
