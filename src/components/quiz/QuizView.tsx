"use client";

/**
 * QuizView — Phase 4
 *
 * Full quiz flow component supporting all 8 question types from spec §6.1.
 * Manages its own state; calls onComplete(score, total) when done.
 * Calls /api/quiz/submit per question (for mastery update + LLM feedback on subjective types).
 * Calls /api/quiz/complete at the end.
 *
 * On the design system since V8.4b: semantic tokens only, so it follows whatever
 * theme its host resolves. The desk card wraps it in `.theme-paper` (always light);
 * the daily review hosts it in the panel. Right and wrong are never colour alone:
 * each carries an icon and words. Bloom levels have no colours (one neutral chip).
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { ArrowRight, BookOpen, Check, ChevronDown, ChevronUp, Hammer, Lightbulb, Scale, ScanSearch, Wrench, X } from "lucide-react";
import type { LucideIcon }                              from "lucide-react";
import type { QuizQuestion }                         from "@/lib/agents/assessment";
import { evaluateObjective }                         from "@/lib/quiz/localEval";
import { useAristoStore }                            from "@/store/useAristoStore";
import { Button }                                    from "@/components/ui/button";
import { Input }                                     from "@/components/ui/input";
import { FOCUS }                                     from "@/lib/design/shape";
import { cn }                                        from "@/lib/utils";

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
  /**
   * True only in the unauthenticated /demo route. Evaluates every answer
   * with the pure evaluateObjective() helper and skips /api/quiz/submit +
   * /api/quiz/complete entirely — the demo desk quiz only ever uses
   * objective question types (multiple_choice / true_false), so this is
   * always exact, not a degraded fallback.
   */
  localOnly?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BLOOM_ICON: Record<string, LucideIcon> = {
  remember:   BookOpen,
  understand: Lightbulb,
  apply:      Wrench,
  analyze:    ScanSearch,
  evaluate:   Scale,
  create:     Hammer,
};

// Levels have no colours (V8.2): one neutral chip, told apart by icon and label.
function bloomBadge(level: string) {
  const Icon = BLOOM_ICON[level] ?? BookOpen;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sunk px-2 py-0.5 text-[11px] font-semibold capitalize text-body">
      <Icon aria-hidden className="size-3" />
      {level}
    </span>
  );
}

function typeLabel(t: string) {
  const labels: Record<string, string> = {
    multiple_choice:  "Multiple choice",
    true_false:       "True or false",
    fill_blank:       "Fill in the blank",
    short_answer:     "Short answer",
    code_completion:  "Code completion",
    code_debugging:   "Debug the code",
    ordering:         "Put in order",
    matching:         "Matching",
  };
  return labels[t] ?? t;
}

/** Look of a choice, a row or a select after an answer: right, wrong, or neither. */
const STATE_RIGHT = "border-success/40 bg-success/15 text-success";
const STATE_WRONG = "border-danger/40 bg-danger/15 text-danger";
const STATE_REST  = "border-line bg-sunk text-muted";

/** The system's field (Input) for the multi-line and native controls that cannot use it. */
const FIELD =
  "w-full rounded-[10px] border border-line bg-surface px-3.5 text-base text-ink transition-colors duration-fast hover:border-muted/50 placeholder:text-muted md:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-text focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-default";

/** A choice button: idle, picked and waiting for the mark, right, wrong, or the rest after an answer. */
function choiceClass(opts: { result: AnswerResult | null; picked: boolean; right: boolean }) {
  const { result, picked, right } = opts;
  const state = !result
    ? picked
      ? "border-accent bg-accent text-accent-ink"
      : "border-line bg-surface text-ink hover:border-muted/50 hover:bg-sunk"
    : right
    ? STATE_RIGHT
    : picked
    ? STATE_WRONG
    : STATE_REST;
  return cn("flex w-full items-center justify-between gap-2 rounded-[10px] border px-4 text-left font-medium transition-colors duration-fast disabled:cursor-default", FOCUS, state);
}

/** The mark that goes with a right or wrong state, so it never rests on colour alone. */
function Mark({ right, wrong, what }: { right: boolean; wrong: boolean; what: string }) {
  if (right) return <><Check aria-hidden className="size-4 shrink-0" /><span className="sr-only">{what} is correct</span></>;
  if (wrong) return <><X aria-hidden className="size-4 shrink-0" /><span className="sr-only">{what} is incorrect</span></>;
  return null;
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
        const right = !!result && opt === question.correct_answer;
        const wrong = !!result && !right && opt === selected;
        return (
          <button
            key={opt}
            onClick={() => handleClick(opt)}
            disabled={!!result}
            className={cn(choiceClass({ result, picked: selected === opt, right }), "min-h-11 py-2.5 text-[13px]")}
          >
            <span>{opt}</span>
            <Mark right={right} wrong={wrong} what={opt} />
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
        const right = !!result && val === question.correct_answer;
        const wrong = !!result && !right && val === selected;
        return (
          <button
            key={val}
            onClick={() => handleClick(val)}
            disabled={!!result}
            className={cn(choiceClass({ result, picked: selected === val, right }), "min-h-12 flex-1 justify-center py-3 text-sm font-semibold")}
          >
            <span>{val}</span>
            <Mark right={right} wrong={wrong} what={val} />
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
      <div className="text-[13px] leading-relaxed text-ink">
        {parts[0]}
        <span
          className="mx-1 inline-block min-w-[80px] border-b-2 border-accent px-2 text-center font-semibold text-accent-text"
        >
          {result ? question.correct_answer : (value || "___")}
        </span>
        {parts[1]}
      </div>
      {!result && (
        <div className="flex gap-2">
          <Input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Type your answer…"
            className="flex-1"
          />
          <Button onClick={handleSubmit} disabled={!value.trim()}>
            Submit
          </Button>
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
        <pre className="overflow-x-auto rounded-[10px] bg-sunk p-3 font-mono text-xs leading-relaxed text-ink">
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
            className={cn(FIELD, "resize-none py-2", isCode && "font-mono")}
          />
          <div className="flex items-center gap-2">
            <Button onClick={handleSubmit} disabled={!value.trim() || isEvaluating}>
              {isEvaluating ? "Marking…" : "Submit"}
            </Button>
            {!revealed && (
              <Button
                variant="ghost"
                onClick={() => { setRevealed(true); onAnswer("__skipped__"); }}
                className="text-body"
              >
                I don&apos;t know
              </Button>
            )}
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-1 rounded-[10px] bg-sunk p-3">
          <p className="text-[11px] font-semibold text-muted">Model answer</p>
          <pre className={cn("whitespace-pre-wrap text-[13px] leading-relaxed text-ink", isCode && "font-mono")}>
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
        const isCorrectPos = !!result && correctOrder[idx] === item;
        const isWrongPos   = !!result && correctOrder[idx] !== item;
        return (
          <div
            key={item}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-[10px] border py-1 pl-3 pr-1 transition-colors duration-fast",
              result
                ? isCorrectPos
                  ? STATE_RIGHT
                  : STATE_WRONG
                : "border-line bg-surface",
            )}
          >
            <span className={cn("w-4 text-[11px] font-semibold tabular-nums", result ? "text-current" : "text-muted")}>{idx + 1}.</span>
            <span className={cn("flex-1 text-[13px]", result ? "text-current" : "text-ink")}>{item}</span>
            <Mark right={isCorrectPos} wrong={isWrongPos} what={item} />
            {!result && (
              <div className="flex">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0 || submitted}
                  aria-label={`Move ${item} up`}
                >
                  <ChevronUp aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => moveDown(idx)}
                  disabled={idx === ordered.length - 1 || submitted}
                  aria-label={`Move ${item} down`}
                >
                  <ChevronDown aria-hidden />
                </Button>
              </div>
            )}
          </div>
        );
      })}
      {!result && !submitted && (
        <Button onClick={handleSubmit} className="mt-1 w-full">
          Submit order
        </Button>
      )}
      {result && (
        <div className="pt-1 text-xs text-body">
          Correct order: {correctOrder.join(", ")}
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
          const isCorrect = !!result && correctMap[term] === chosen;
          const isWrong   = !!result && correctMap[term] !== chosen;
          return (
            <div key={term} className="space-y-1">
              <span className="flex items-center gap-1 text-xs font-semibold text-ink">
                {term}
                <Mark right={isCorrect} wrong={isWrong} what={term} />
              </span>
              <select
                value={chosen ?? ""}
                onChange={(e) => handleSelect(term, e.target.value)}
                disabled={submitted || !!result}
                className={cn(
                  FIELD,
                  "h-11 py-2",
                  result && (isCorrect ? STATE_RIGHT : STATE_WRONG),
                )}
              >
                <option value="">Choose one</option>
                {defs.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
      {!result && !submitted && (
        <Button onClick={handleSubmit} disabled={!allMatched} className="w-full">
          Submit matches
        </Button>
      )}
      {result && (
        <div className="space-y-0.5 text-xs text-body">
          {correctPairs.map(([t, d]) => (
            <div key={t}><span className="font-semibold text-ink">{t}</span>: {d}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Feedback Banner ──────────────────────────────────────────────────────────

function FeedbackBanner({ result }: { result: AnswerResult }) {
  const ok = result.is_correct;
  return (
    <div
      className={cn(
        "flex gap-2 rounded-[10px] border p-3 type-caption text-ink",
        ok ? "border-success/40 bg-success/10" : "border-danger/40 bg-danger/10",
      )}
    >
      {ok
        ? <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
        : <X aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />}
      <p>
        <span className={cn("mr-1 font-semibold", ok ? "text-success" : "text-danger")}>{ok ? "Correct." : "Not quite."}</span>
        {result.feedback}
      </p>
    </div>
  );
}

// ─── Main QuizView ────────────────────────────────────────────────────────────

export function QuizView({ conceptId, questions, userId, onComplete, context = "lesson", localOnly = false }: QuizViewProps) {
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

    if (localOnly) {
      // Demo path: pure client-side eval, no network, no mastery/SRS writes.
      const data = evaluateObjective(currentQ, userAnswer);
      if (data.is_correct) incrementSignal("questions_correct");
      setResults((prev) => {
        const next = [...prev];
        next[currentIdx] = data;
        return next;
      });
      setScores((prev) => [...prev, data.score]);
      setIsEvaluating(false);
      return;
    }

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
      if (!res.ok) {
        // Non-2xx bodies are error JSON, not an AnswerResult — treating
        // them as one renders "Not quite." for every answer.  Throw into
        // the local-eval fallback instead.
        throw new Error(`quiz/submit HTTP ${res.status}`);
      }
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
  }, [currentQ, currentR, currentIdx, isEvaluating, localOnly, incrementSignal]);

  // ── Advance to next question ──────────────────────────────────────────────
  const handleNext = useCallback(async () => {
    if (currentIdx < totalQs - 1) {
      setCurrentIdx((i) => i + 1);
    } else {
      // All done — calculate final score
      const total  = totalQs;
      const correct = results.filter((r) => r?.is_correct).length;
      setIsDone(true);

      // Persist attempt — skipped in the demo path (no learner row exists).
      if (!localOnly) {
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
      }

      onComplete(correct, total);
    }
  }, [currentIdx, totalQs, results, conceptId, onComplete, context, localOnly]);

  if (!currentQ || isDone) return null;

  const progressPct = ((answered) / totalQs) * 100;

  return (
    <div className="overflow-hidden rounded-2xl bg-surface">
      {/* Progress bar: the number is also in the header, so the fill is not the only cue */}
      <div className="h-1 bg-sunk">
        <div
          className="h-full bg-accent transition-all duration-slow"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="space-y-3 px-4 py-3">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-accent-text">
              Question {currentIdx + 1} of {totalQs}
            </span>
            {bloomBadge(currentQ.bloom_level)}
            <span className="text-xs text-muted">{typeLabel(currentQ.question_type)}</span>
          </div>
          <span className="text-xs tabular-nums text-muted">
            {results.filter((r) => r?.is_correct).length} correct
          </span>
        </div>

        {/* Question text — shown separately for code types */}
        {currentQ.question_type !== "code_debugging" &&
          currentQ.question_type !== "code_completion" && (
          <p className="text-[15px] font-medium leading-snug text-ink">
            {currentQ.question}
          </p>
        )}
        {(currentQ.question_type === "code_debugging" ||
          currentQ.question_type === "code_completion") && (
          <p className="text-[15px] font-medium leading-snug text-ink">
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

        {/* Feedback + Next. The live region is always mounted, so a screen reader
            announces the banner when it appears. */}
        <div role="status" className="empty:!mt-0">
          {currentR && <FeedbackBanner result={currentR} />}
        </div>
        {currentR && (
          <div className="space-y-2">
            {isEvaluating && (
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <span className="size-1.5 rounded-full bg-accent-text motion-safe:animate-bounce" />
                Marking…
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={handleNext}>
                {currentIdx < totalQs - 1 ? "Next question" : "See results"}
                <ArrowRight aria-hidden />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
