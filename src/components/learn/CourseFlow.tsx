"use client";

/**
 * CourseFlow
 *
 * All course-mode bottom-bar states and the quiz panel, in one file.
 *
 * States rendered at the bottom of the learn panel (replacing InputBox):
 *
 *   CourseLoadingBar   — while the auto-teach API call is in flight
 *   CourseTakeQuizBar  — lesson loaded, quiz not yet started
 *   QuizPanel          — active MCQ quiz (5 questions)
 *   CourseAdvanceBar   — quiz done, shows "Next Topic" or "Finish Course"
 */

import { useState, useCallback } from "react";
import { useAristoStore, type MCQQuestion } from "@/store/useAristoStore";
import { useEffectivenessCheck } from "@/hooks/useEffectivenessCheck";

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
  isLoading: boolean;
}) {
  return (
    <div className="px-4 py-3 bg-white/40 backdrop-blur-xl border-t border-white/40 rounded-b-2xl">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-[#8B6E5A] font-medium">
          Lesson loaded — ready to test your knowledge?
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
  score: number;
  total: number;
  isLastTopic: boolean;
  onAdvance: () => void;
  onFinish: () => void;
}) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const passed = score >= Math.ceil(total * 0.6);
  const scoreColor = passed ? "#16A34A" : pct >= 40 ? "#C45A10" : "#DC2626";

  return (
    <div className="px-4 py-3 bg-white/40 backdrop-blur-xl border-t border-white/40 rounded-b-2xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">{passed ? "🎉" : "💪"}</span>
          <div>
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: scoreColor }}
            >
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

// ─── Quiz Panel ───────────────────────────────────────────────────────────────

interface QuizPanelProps {
  userId: string;
  topic: string;
  onFinish: () => void;
}

export function QuizPanel({ userId, topic, onFinish }: QuizPanelProps) {
  const questions = useAristoStore((s) => s.quiz.questions);
  const learningStyle = useAristoStore((s) => s.learningStyle);
  const teachingFlow = useAristoStore((s) => s.teachingFlow);

  const { checkAndAdapt } = useEffectivenessCheck();

  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [answers, setAnswers] = useState<string[]>([]);

  const currentQ: MCQQuestion | undefined = questions[currentIdx];

  const handleAnswer = useCallback(
    (option: string) => {
      if (selected !== null) return; // already answered
      setSelected(option);
      setShowResult(true);
    },
    [selected]
  );

  const handleNext = useCallback(async () => {
    const newAnswers = [...answers, selected ?? ""];
    setAnswers(newAnswers);

    if (currentIdx < questions.length - 1) {
      setCurrentIdx((i) => i + 1);
      setSelected(null);
      setShowResult(false);
    } else {
      // Quiz complete — calculate score from the local answers we've been tracking.
      // We do NOT call finishQuiz() because that reads state.quiz.answers which
      // is always empty (answerQuestion() is never called). Write directly instead.
      const finalScore = newAnswers.filter(
        (a, i) => a === questions[i]?.correct
      ).length;

      useAristoStore.setState((state) => ({
        quiz: {
          ...state.quiz,
          answers: newAnswers,
          score: finalScore,
          isActive: false,
        },
      }));

      // Persist to Supabase
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        await supabase.from("quiz_attempts").insert({
          user_id: userId,
          topic,
          questions,
          answers: newAnswers,
          score: finalScore,
          passed: finalScore >= Math.ceil(questions.length * 0.6),
          style_used: learningStyle,
          teaching_flow_used: teachingFlow,
        });
        await checkAndAdapt();
      } catch (err) {
        console.error("Failed to save quiz attempt:", err);
      }

      onFinish();
    }
  }, [
    answers,
    selected,
    currentIdx,
    questions,
    userId,
    topic,
    learningStyle,
    teachingFlow,
    checkAndAdapt,
    onFinish,
  ]);

  // ── Active question ───────────────────────────────────────────────────────

  if (!currentQ) return null;

  const isCorrect = selected === currentQ.correct;

  return (
    <div className="bg-white/40 backdrop-blur-xl border-t border-white/40 rounded-b-2xl overflow-hidden">
      {/* Progress bar */}
      <div className="h-1 bg-white/30">
        <div
          className="h-full bg-[#F97B2F] transition-all duration-500"
          style={{
            width: `${((currentIdx + (showResult ? 1 : 0)) / questions.length) * 100}%`,
          }}
        />
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Question header */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#F97B2F]">
            Question {currentIdx + 1} of {questions.length}
          </span>
          <span className="text-[10px] text-[#B8A99A]">
            {answers.filter((a, i) => a === questions[i]?.correct).length} correct
          </span>
        </div>

        {/* Question text */}
        <p className="text-sm font-medium text-[#3D2110] leading-snug">
          {currentQ.question}
        </p>

        {/* Options */}
        <div className="space-y-1.5">
          {currentQ.options.map((option) => {
            let style =
              "w-full text-left px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-200 ";

            if (!showResult) {
              style +=
                selected === option
                  ? "bg-[#F97B2F] text-white border-[#F97B2F]"
                  : "bg-white/70 border-white/60 text-[#3D2110] hover:border-[#F97B2F]/40 hover:bg-[#FFF8F4]";
            } else if (option === currentQ.correct) {
              style += "bg-[#DCFCE7] border-[#86EFAC] text-[#16A34A]";
            } else if (option === selected) {
              style += "bg-[#FEE2E2] border-[#FCA5A5] text-[#DC2626]";
            } else {
              style += "bg-white/40 border-white/40 text-[#B8A99A]";
            }

            return (
              <button
                key={option}
                onClick={() => handleAnswer(option)}
                disabled={showResult}
                className={style}
              >
                {option}
              </button>
            );
          })}
        </div>

        {/* Result feedback + Next button */}
        {showResult && (
          <div className="flex items-center justify-between gap-2 pt-1">
            <span
              className="text-xs font-semibold"
              style={{ color: isCorrect ? "#16A34A" : "#DC2626" }}
            >
              {isCorrect ? "Correct! ✓" : `Correct answer: ${currentQ.correct}`}
            </span>
            <button
              onClick={handleNext}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#F97B2F] text-white hover:bg-[#E06A20] transition-all"
            >
              {currentIdx < questions.length - 1 ? "Next →" : "See Score"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Score display (stored in quiz.score for the advance bar) ─────────────────

export function useQuizScore() {
  const quiz = useAristoStore((s) => s.quiz);
  return {
    isActive: quiz.isActive,
    isDone: quiz.score !== null && !quiz.isActive,
    score: quiz.score ?? 0,
    total: quiz.questions.length,
  };
}
