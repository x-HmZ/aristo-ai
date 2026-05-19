"use client";

/**
 * QuizView — Phase 4
 *
 * Full quiz flow component supporting all 8 question types from spec §6.1.
 * Manages its own state; calls onComplete(score, total) when done.
 * Calls /api/quiz/submit per question (for mastery update + LLM feedback on subjective types).
 * Calls /api/quiz/complete at the end.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import type { QuizQuestion }                         from "@/lib/agents/assessment";
import { useAristoStore }                            from "@/store/useAristoStore";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnswerResult {
  is_correct:             boolean;
  score:                  number;
  feedback:               string;
  misconception_detected: string | null;
  new_mastery?:           number;
}

interface QuizViewProps {
  conceptId:  string;
  questions:  QuizQuestion[];
  userId:     string;
  onComplete: (score: number, total: number) => void;
  /** "lesson" (default) writes initial SRS seed; "review" runs full FSRS update */
  context?:   "lesson" | "review";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bloomBadge(level: string) {
  const colors: Record<string, string> = {
    remember:  "#64748B",
    understand:"#7C3AED",
    apply:     "#2563EB",
    analyze:   "#0891B2",
    evaluate:  "#059669",
    create:    "#D97706",
  };
  return (
    <span
      className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md"
      style={{
        backgroundColor: (colors[level] ?? "#64748B") + "22",
        color:           colors[level] ?? "#64748B",
      }}
    >
      {level}
    </span>
  );
}

function typeLabel(t: string) {
  const labels: Record<string, string> = {
    multiple_choice:  "Multiple Choice",
    true_false:       "True / False",
    fill_blank:       "Fill in the Blank",
    short_answer:     "Short Answer",
    code_completion:  "Code Completion",
    code_debugging:   "Debug the Code",
    ordering:         "Put in Order",
    matching:         "Matching",
  };
  return labels[t] ?? t;
}

// ─── MCQ Renderer ─────────────────────────────────────────────────────────────

function MCQRenderer({
  question,
  result,
  onAnswer,
}: {
  question: QuizQuestion;
  result:   AnswerResult | null;
  onAnswer: (answer: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleClick = (opt: string) => {
    if (result) return;
    setSelected(opt);
    onAnswer(opt);
  };

  return (
    <div className="space-y-2">
      {(question.options ?? []).map((opt) => {
        let cls =
          "w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium border transition-all duration-200 ";
        if (!result) {
          cls += selected === opt
            ? "bg-[#F97B2F] text-white border-[#F97B2F]"
            : "bg-white/70 border-white/60 text-[#3D2110] hover:border-[#F97B2F]/40 hover:bg-[#FFF8F4]";
        } else if (opt === question.correct_answer) {
          cls += "bg-[#DCFCE7] border-[#86EFAC] text-[#16A34A]";
        } else if (opt === selected) {
          cls += "bg-[#FEE2E2] border-[#FCA5A5] text-[#DC2626]";
        } else {
          cls += "bg-white/30 border-white/30 text-[#B8A99A]";
        }
        return (
          <button key={opt} onClick={() => handleClick(opt)} disabled={!!result} className={cls}>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ─── True / False Renderer ────────────────────────────────────────────────────

function TrueFalseRenderer({
  question,
  result,
  onAnswer,
}: {
  question: QuizQuestion;
  result:   AnswerResult | null;
  onAnswer: (answer: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleClick = (val: string) => {
    if (result) return;
    setSelected(val);
    onAnswer(val);
  };

  return (
    <div className="flex gap-3">
      {["True", "False"].map((val) => {
        let cls =
          "flex-1 py-3 rounded-xl text-sm font-bold border transition-all duration-200 ";
        if (!result) {
          cls += selected === val
            ? "bg-[#F97B2F] text-white border-[#F97B2F]"
            : "bg-white/70 border-white/60 text-[#3D2110] hover:border-[#F97B2F]/40";
        } else if (val === question.correct_answer) {
          cls += "bg-[#DCFCE7] border-[#86EFAC] text-[#16A34A]";
        } else if (val === selected) {
          cls += "bg-[#FEE2E2] border-[#FCA5A5] text-[#DC2626]";
        } else {
          cls += "bg-white/30 border-white/30 text-[#B8A99A]";
        }
        return (
          <button key={val} onClick={() => handleClick(val)} disabled={!!result} className={cls}>
            {val}
          </button>
        );
      })}
    </div>
  );
}

// ─── Fill in the Blank Renderer ───────────────────────────────────────────────

function FillBlankRenderer({
  question,
  result,
  onAnswer,
}: {
  question: QuizQuestion;
  result:   AnswerResult | null;
  onAnswer: (answer: string) => void;
}) {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    if (!value.trim() || result) return;
    onAnswer(value.trim());
  };

  // Replace ____ with an inline input-like display
  const parts = question.question.split("____");

  return (
    <div className="space-y-3">
      <div className="text-sm text-[#3D2110] leading-relaxed">
        {parts[0]}
        <span
          className="inline-block border-b-2 border-[#F97B2F] px-2 mx-1 min-w-[80px] text-center text-[#F97B2F] font-semibold"
        >
          {result ? question.correct_answer : (value || "___")}
        </span>
        {parts[1]}
      </div>
      {!result && (
        <div className="flex gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Type your answer…"
            className="flex-1 px-3 py-2 rounded-xl text-xs bg-white/70 border border-white/60 text-[#3D2110] placeholder-[#B8A99A] focus:outline-none focus:border-[#F97B2F]"
          />
          <button
            onClick={handleSubmit}
            disabled={!value.trim()}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-[#F97B2F] text-white hover:bg-[#E06A20] disabled:opacity-50 transition-all"
          >
            Submit
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Short Answer + Code Debugging Renderer ───────────────────────────────────

function ShortAnswerRenderer({
  question,
  result,
  onAnswer,
  isEvaluating,
}: {
  question:     QuizQuestion;
  result:       AnswerResult | null;
  onAnswer:     (answer: string) => void;
  isEvaluating: boolean;
}) {
  const [value, setValue]     = useState("");
  const [revealed, setRevealed] = useState(false);

  const handleSubmit = () => {
    if (!value.trim() || result || isEvaluating) return;
    onAnswer(value.trim());
  };

  const isCode = question.question_type === "code_debugging" || question.question_type === "code_completion";

  return (
    <div className="space-y-3">
      {isCode && (
        <pre className="bg-[#1E1E1E] text-[#D4D4D4] text-[11px] rounded-xl p-3 overflow-x-auto font-mono leading-relaxed">
          {question.question.includes("```")
            ? question.question.replace(/```\w*\n?/g, "").trim()
            : question.question}
        </pre>
      )}

      {!result && (
        <div className="space-y-2">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={isCode ? 4 : 3}
            placeholder={isCode ? "Write the corrected code here…" : "Type your answer here…"}
            className={`w-full px-3 py-2 rounded-xl text-xs bg-white/70 border border-white/60 text-[#3D2110] placeholder-[#B8A99A] focus:outline-none focus:border-[#F97B2F] resize-none ${isCode ? "font-mono" : ""}`}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleSubmit}
              disabled={!value.trim() || isEvaluating}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-[#F97B2F] text-white hover:bg-[#E06A20] disabled:opacity-50 transition-all"
            >
              {isEvaluating ? "Evaluating…" : "Submit"}
            </button>
            {!revealed && (
              <button
                onClick={() => { setRevealed(true); onAnswer("__skipped__"); }}
                className="px-3 py-2 rounded-xl text-xs text-[#8B6E5A] hover:text-[#3D2110] transition-colors"
              >
                I don&apos;t know →
              </button>
            )}
          </div>
        </div>
      )}

      {result && (
        <div className="bg-white/50 rounded-xl p-3 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B6E5A]">Model Answer</p>
          <pre className={`text-xs text-[#3D2110] leading-relaxed whitespace-pre-wrap ${isCode ? "font-mono" : ""}`}>
            {question.correct_answer}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Ordering Renderer ────────────────────────────────────────────────────────

function OrderingRenderer({
  question,
  result,
  onAnswer,
}: {
  question: QuizQuestion;
  result:   AnswerResult | null;
  onAnswer: (answer: string) => void;
}) {
  const initialItems = question.items ?? [];
  const [ordered, setOrdered] = useState<string[]>(() => [...initialItems]);
  const [submitted, setSubmitted] = useState(false);

  const moveUp = (idx: number) => {
    if (idx === 0 || submitted) return;
    const newArr = [...ordered];
    [newArr[idx - 1], newArr[idx]] = [newArr[idx], newArr[idx - 1]];
    setOrdered(newArr);
  };

  const moveDown = (idx: number) => {
    if (idx === ordered.length - 1 || submitted) return;
    const newArr = [...ordered];
    [newArr[idx], newArr[idx + 1]] = [newArr[idx + 1], newArr[idx]];
    setOrdered(newArr);
  };

  const handleSubmit = () => {
    if (submitted || result) return;
    setSubmitted(true);
    onAnswer(JSON.stringify(ordered));
  };

  let correctOrder: string[] = [];
  try {
    correctOrder = JSON.parse(question.correct_answer);
  } catch { /* ignore */ }

  return (
    <div className="space-y-2">
      {ordered.map((item, idx) => {
        const isCorrectPos = result && correctOrder[idx] === item;
        const isWrongPos   = result && correctOrder[idx] !== item;
        return (
          <div
            key={item}
            className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${
              result
                ? isCorrectPos
                  ? "bg-[#DCFCE7] border-[#86EFAC]"
                  : isWrongPos
                  ? "bg-[#FEE2E2] border-[#FCA5A5]"
                  : "bg-white/40 border-white/40"
                : "bg-white/70 border-white/60"
            }`}
          >
            <span className="text-[10px] font-bold text-[#B8A99A] w-4 tabular-nums">{idx + 1}.</span>
            <span className="text-xs text-[#3D2110] flex-1">{item}</span>
            {!result && (
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveUp(idx)} className="text-[#B8A99A] hover:text-[#F97B2F] text-xs leading-none">▲</button>
                <button onClick={() => moveDown(idx)} className="text-[#B8A99A] hover:text-[#F97B2F] text-xs leading-none">▼</button>
              </div>
            )}
          </div>
        );
      })}
      {!result && !submitted && (
        <button
          onClick={handleSubmit}
          className="w-full py-2 rounded-xl text-xs font-semibold bg-[#F97B2F] text-white hover:bg-[#E06A20] transition-all mt-1"
        >
          Submit Order
        </button>
      )}
      {result && (
        <div className="text-[10px] text-[#8B6E5A] pt-1">
          Correct order: {correctOrder.join(" → ")}
        </div>
      )}
    </div>
  );
}

// ─── Matching Renderer ────────────────────────────────────────────────────────

function MatchingRenderer({
  question,
  result,
  onAnswer,
}: {
  question: QuizQuestion;
  result:   AnswerResult | null;
  onAnswer: (answer: string) => void;
}) {
  const terms   = question.items   ?? [];
  const defs    = question.matches ?? [];
  const [pairs, setPairs]       = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const handleSelect = (term: string, def: string) => {
    if (submitted) return;
    setPairs((prev) => ({ ...prev, [term]: def }));
  };

  const handleSubmit = () => {
    if (submitted || result) return;
    setSubmitted(true);
    const answerArr = terms.map((t) => [t, pairs[t] ?? ""] as [string, string]);
    onAnswer(JSON.stringify(answerArr));
  };

  let correctPairs: [string, string][] = [];
  try {
    correctPairs = JSON.parse(question.correct_answer);
  } catch { /* ignore */ }
  const correctMap = Object.fromEntries(correctPairs);

  const allMatched = terms.every((t) => pairs[t]);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {terms.map((term) => {
          const chosen    = pairs[term];
          const isCorrect = result && correctMap[term] === chosen;
          const isWrong   = result && correctMap[term] !== chosen;
          return (
            <div key={term} className="space-y-1">
              <span className="text-[10px] font-bold text-[#3D2110]">{term}</span>
              <select
                value={chosen ?? ""}
                onChange={(e) => handleSelect(term, e.target.value)}
                disabled={submitted || !!result}
                className={`w-full px-2 py-1.5 rounded-lg text-xs border focus:outline-none transition-all ${
                  result
                    ? isCorrect
                      ? "bg-[#DCFCE7] border-[#86EFAC] text-[#16A34A]"
                      : isWrong
                      ? "bg-[#FEE2E2] border-[#FCA5A5] text-[#DC2626]"
                      : "bg-white/40 border-white/40"
                    : "bg-white/70 border-white/60 text-[#3D2110] focus:border-[#F97B2F]"
                }`}
              >
                <option value="">— select —</option>
                {defs.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
      {!result && !submitted && (
        <button
          onClick={handleSubmit}
          disabled={!allMatched}
          className="w-full py-2 rounded-xl text-xs font-semibold bg-[#F97B2F] text-white hover:bg-[#E06A20] disabled:opacity-50 transition-all"
        >
          Submit Matches
        </button>
      )}
      {result && (
        <div className="text-[10px] text-[#8B6E5A] space-y-0.5">
          {correctPairs.map(([t, d]) => (
            <div key={t}><span className="font-semibold">{t}</span> → {d}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Feedback Banner ──────────────────────────────────────────────────────────

function FeedbackBanner({ result }: { result: AnswerResult }) {
  return (
    <div
      className={`rounded-xl p-3 text-xs leading-relaxed ${
        result.is_correct
          ? "bg-[#DCFCE7] border border-[#86EFAC] text-[#15803D]"
          : "bg-[#FEF3C7] border border-[#FCD34D] text-[#92400E]"
      }`}
    >
      <span className="font-bold mr-1">{result.is_correct ? "✓ Correct!" : "Not quite."}</span>
      {result.feedback}
    </div>
  );
}

// ─── Main QuizView ────────────────────────────────────────────────────────────

export function QuizView({ conceptId, questions, userId, onComplete, context = "lesson" }: QuizViewProps) {
  const incrementSignal = useAristoStore((s) => s.incrementSignal);

  const [currentIdx,    setCurrentIdx]    = useState(0);
  const [results,       setResults]       = useState<(AnswerResult | null)[]>(
    () => new Array(questions.length).fill(null)
  );
  const [isEvaluating,  setIsEvaluating]  = useState(false);
  const [scores,        setScores]        = useState<number[]>([]);
  const [isDone,        setIsDone]        = useState(false);

  // Track time spent per question
  const questionStartRef = useRef<number>(Date.now());
  useEffect(() => {
    questionStartRef.current = Date.now();
  }, [currentIdx]);

  const currentQ  = questions[currentIdx];
  const currentR  = results[currentIdx];
  const totalQs   = questions.length;
  const answered  = results.filter(Boolean).length;

  // ── Submit a single answer ────────────────────────────────────────────────
  const handleAnswer = useCallback(async (userAnswer: string) => {
    if (!currentQ || currentR || isEvaluating) return;

    // Record time spent on this question
    const elapsed = Math.round((Date.now() - questionStartRef.current) / 1000);
    if (elapsed > 0 && elapsed < 600) {
      incrementSignal("time_on_quizzes_seconds", elapsed);
    }
    incrementSignal("questions_attempted");

    setIsEvaluating(true);

    try {
      const res = await fetch("/api/quiz/submit", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          questionId:            currentQ.id,
          conceptId:             currentQ.concept_id,
          questionType:          currentQ.question_type,
          question:              currentQ.question,
          correctAnswer:         currentQ.correct_answer,
          misconceptionTargeted: currentQ.misconception_targeted,
          difficulty:            currentQ.difficulty,
          userAnswer,
          context,
        }),
      });
      const data: AnswerResult & { new_mastery?: number } = await res.json();
      if (data.is_correct) incrementSignal("questions_correct");
      setResults((prev) => {
        const next = [...prev];
        next[currentIdx] = data;
        return next;
      });
      setScores((prev) => [...prev, data.score]);
    } catch {
      // Fallback: evaluate locally
      const isCorrect = userAnswer.trim().toLowerCase() === currentQ.correct_answer.trim().toLowerCase();
      if (isCorrect) incrementSignal("questions_correct");
      const fb: AnswerResult = {
        is_correct:             isCorrect,
        score:                  isCorrect ? 1 : 0,
        feedback:               isCorrect
          ? currentQ.explanation_correct
          : `The correct answer is: ${currentQ.correct_answer}. ${currentQ.explanation_correct}`,
        misconception_detected: null,
      };
      setResults((prev) => { const n=[...prev]; n[currentIdx]=fb; return n; });
      setScores((prev) => [...prev, fb.score]);
    } finally {
      setIsEvaluating(false);
    }
  }, [currentQ, currentR, currentIdx, isEvaluating]);

  // ── Advance to next question ──────────────────────────────────────────────
  const handleNext = useCallback(async () => {
    if (currentIdx < totalQs - 1) {
      setCurrentIdx((i) => i + 1);
    } else {
      // All done — calculate final score
      const total  = totalQs;
      const correct = results.filter((r) => r?.is_correct).length;
      setIsDone(true);

      // Persist attempt
      try {
        await fetch("/api/quiz/complete", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            conceptId,
            score: correct,
            total,
            context,
          }),
        });
      } catch { /* non-critical */ }

      onComplete(correct, total);
    }
  }, [currentIdx, totalQs, results, conceptId, onComplete]);

  if (!currentQ || isDone) return null;

  const progressPct = ((answered) / totalQs) * 100;

  return (
    <div className="bg-white/40 backdrop-blur-xl border-t border-white/40 rounded-b-2xl overflow-hidden">
      {/* Progress bar */}
      <div className="h-1 bg-white/30">
        <div
          className="h-full bg-[#F97B2F] transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="px-4 py-3 space-y-3">

        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#F97B2F]">
              Question {currentIdx + 1} of {totalQs}
            </span>
            {bloomBadge(currentQ.bloom_level)}
            <span className="text-[9px] text-[#B8A99A]">{typeLabel(currentQ.question_type)}</span>
          </div>
          <span className="text-[10px] text-[#B8A99A] tabular-nums">
            {results.filter((r) => r?.is_correct).length} correct
          </span>
        </div>

        {/* Question text — shown separately for code types */}
        {currentQ.question_type !== "code_debugging" &&
          currentQ.question_type !== "code_completion" && (
          <p className="text-sm font-medium text-[#3D2110] leading-snug">
            {currentQ.question}
          </p>
        )}
        {(currentQ.question_type === "code_debugging" ||
          currentQ.question_type === "code_completion") && (
          <p className="text-sm font-medium text-[#3D2110] leading-snug">
            {currentQ.question_type === "code_debugging"
              ? "Find and fix the bug in this code:"
              : "Complete the code:"}
          </p>
        )}

        {/* Question type renderer */}
        {currentQ.question_type === "multiple_choice" && (
          <MCQRenderer question={currentQ} result={currentR} onAnswer={handleAnswer} />
        )}
        {currentQ.question_type === "true_false" && (
          <TrueFalseRenderer question={currentQ} result={currentR} onAnswer={handleAnswer} />
        )}
        {currentQ.question_type === "fill_blank" && (
          <FillBlankRenderer question={currentQ} result={currentR} onAnswer={handleAnswer} />
        )}
        {(currentQ.question_type === "short_answer" ||
          currentQ.question_type === "code_debugging" ||
          currentQ.question_type === "code_completion") && (
          <ShortAnswerRenderer
            question={currentQ}
            result={currentR}
            onAnswer={handleAnswer}
            isEvaluating={isEvaluating}
          />
        )}
        {currentQ.question_type === "ordering" && (
          <OrderingRenderer question={currentQ} result={currentR} onAnswer={handleAnswer} />
        )}
        {currentQ.question_type === "matching" && (
          <MatchingRenderer question={currentQ} result={currentR} onAnswer={handleAnswer} />
        )}

        {/* Feedback + Next */}
        {currentR && (
          <div className="space-y-2">
            <FeedbackBanner result={currentR} />
            {isEvaluating && (
              <div className="flex items-center gap-1.5 text-[11px] text-[#8B6E5A]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F97B2F] animate-bounce" />
                Evaluating…
              </div>
            )}
            <div className="flex justify-end">
              <button
                onClick={handleNext}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#F97B2F] text-white hover:bg-[#E06A20] shadow-sm transition-all"
              >
                {currentIdx < totalQs - 1 ? "Next →" : "See Results"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
