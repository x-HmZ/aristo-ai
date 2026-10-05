"use client";

/**
 * Onboarding: three questions before the first lesson (goal, daily time, subject).
 *
 * On the design system since V8.6: it follows the theme like the rest of /learn.
 * Choices are surface cards (the ModePicker pattern); the chosen one is an accent
 * border on the warm tint with a check, so colour is never the only cue.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Circle, CircleAlert, CircleCheck, Code, FlaskConical, type LucideIcon,
} from "lucide-react";
import { AristoMark } from "@/components/brand/AristoMark";
import { Button } from "@/components/ui/button";
import { FOCUS, PRESS, SHAPE } from "@/lib/design/shape";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────

type Goal = "learn_from_scratch" | "fill_gaps" | "exam_prep" | "refresher";
type DailyTime = 10 | 20 | 45 | 60;

interface OnboardingViewProps {
  userName?: string;
  onComplete?: () => void;
}

// ── Option data ───────────────────────────────────────────────

const GOALS: { value: Goal; label: string; description: string }[] = [
  { value: "learn_from_scratch", label: "Learn from scratch", description: "I'm new to this subject" },
  { value: "fill_gaps",          label: "Fill in gaps",       description: "I know some things but have holes" },
  { value: "exam_prep",          label: "Exam prep",          description: "Preparing for a test or certification" },
  { value: "refresher",          label: "Quick refresher",    description: "I've seen this before, just need a review" },
];

const TIMES: { value: DailyTime; label: string }[] = [
  { value: 10,  label: "10–15 min / day" },
  { value: 20,  label: "20–30 min / day" },
  { value: 45,  label: "45–60 min / day" },
  { value: 60,  label: "1+ hours / day"  },
];

const DOMAINS: { value: string; label: string; Icon: LucideIcon }[] = [
  { value: "python_programming",    label: "Python Programming",    Icon: Code },
  { value: "middle_school_science", label: "Middle School Science", Icon: FlaskConical },
];

// ── Pieces ────────────────────────────────────────────────────

// A choice: a surface card with a line border, a sunk hover and the system focus
// ring; chosen, an accent border on the tint and a check.
function Choice({
  selected,
  onSelect,
  className,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        SHAPE.surface,
        FOCUS,
        PRESS,
        "flex min-h-11 w-full items-center gap-3 border p-4 text-left duration-fast",
        selected
          ? "border-accent bg-tint"
          : "border-line bg-surface hover:border-muted/50 hover:bg-sunk",
        className,
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {selected
        ? <CircleCheck aria-hidden className="size-5 shrink-0 text-accent-text" />
        : <Circle aria-hidden className="size-5 shrink-0 text-muted" />}
    </button>
  );
}

function OptionIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-tint-line bg-tint text-accent-text [&_svg]:size-5">
      {children}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────

export default function OnboardingView({ userName, onComplete }: OnboardingViewProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [goal, setGoal]         = useState<Goal | null>(null);
  const [time, setTime]         = useState<DailyTime | null>(null);
  const [domain, setDomain]     = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const canAdvance = step === 1 ? !!goal : step === 2 ? !!time : !!domain;

  const advance = () => {
    if (step < 3) setStep((s) => (s + 1) as 2 | 3);
  };

  const handleSubmit = async () => {
    if (!goal || !time || !domain) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/auth/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal, daily_time_minutes: time, domain }),
    });

    if (!res.ok) {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    onComplete?.();
    router.refresh();
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-bg p-4 text-ink">
      <div className="w-full max-w-lg py-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="mb-3 flex justify-center">
            <AristoMark decorative={false} className="h-6 text-ink" litClassName="text-accent" />
          </h1>
          <p className="text-sm text-body">
            {userName ? `Welcome, ${userName}!` : "Welcome!"} Let&apos;s personalise your experience.
          </p>
        </div>

        {/* Progress: the current step is the wide pill; "Step n of 3" below says it in words. */}
        <div aria-hidden className="mb-8 flex items-center justify-center gap-2">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={cn(
                "h-2 rounded-full transition-all duration-base motion-reduce:transition-none",
                n === step ? "w-6 bg-accent" : n < step ? "w-2 bg-accent-text" : "w-2 bg-line",
              )}
            />
          ))}
        </div>

        {/* Card */}
        <div className={cn(SHAPE.surface, "border border-line bg-surface p-6 shadow-e1 sm:p-8")}>

          {/* Step 1 — Goal */}
          {step === 1 && (
            <div>
              <h2 className="type-h3 mb-1 font-bold text-ink">What&apos;s your goal?</h2>
              <p className="mb-6 text-sm text-body">This shapes how we pace and structure your lessons.</p>
              <div className="space-y-3">
                {GOALS.map((g) => (
                  <Choice key={g.value} selected={goal === g.value} onSelect={() => setGoal(g.value)}>
                    <div className="text-sm font-semibold text-ink">{g.label}</div>
                    <div className="mt-0.5 text-sm text-body">{g.description}</div>
                  </Choice>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 — Daily time */}
          {step === 2 && (
            <div>
              <h2 className="type-h3 mb-1 font-bold text-ink">How much time can you commit daily?</h2>
              <p className="mb-6 text-sm text-body">We&apos;ll size lessons and reviews to fit your schedule.</p>
              <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
                {TIMES.map((t) => (
                  <Choice key={t.value} selected={time === t.value} onSelect={() => setTime(t.value)}>
                    <div className="text-sm font-semibold text-ink">{t.label}</div>
                  </Choice>
                ))}
              </div>
            </div>
          )}

          {/* Step 3 — Domain */}
          {step === 3 && (
            <div>
              <h2 className="type-h3 mb-1 font-bold text-ink">What do you want to learn?</h2>
              <p className="mb-6 text-sm text-body">We&apos;ll load a curated knowledge graph for your subject.</p>
              <div className="space-y-3">
                {DOMAINS.map((d) => (
                  <Choice key={d.value} selected={domain === d.value} onSelect={() => setDomain(d.value)}>
                    <div className="flex items-center gap-4">
                      <OptionIcon><d.Icon aria-hidden /></OptionIcon>
                      <span className="text-sm font-semibold text-ink">{d.label}</span>
                    </div>
                  </Choice>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p role="alert" className={cn(SHAPE.control, "mt-4 flex items-start gap-2 border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger")}>
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="mt-8 flex items-center justify-between gap-3">
            {step > 1 ? (
              <Button variant="ghost" onClick={() => setStep((s) => (s - 1) as 1 | 2)} className="-ml-3">
                <ArrowLeft aria-hidden />
                Back
              </Button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <Button onClick={advance} disabled={!canAdvance}>
                Continue
                <ArrowRight aria-hidden />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!canAdvance || submitting}>
                {submitting ? "Setting up…" : (<>Start learning<ArrowRight aria-hidden /></>)}
              </Button>
            )}
          </div>
        </div>

        {/* Step label */}
        <p className="mt-4 text-center text-xs text-muted">
          Step {step} of 3
        </p>
      </div>
    </div>
  );
}
