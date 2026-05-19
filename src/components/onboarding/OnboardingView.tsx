"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

const DOMAINS: { value: string; label: string; emoji: string }[] = [
  { value: "python_programming",   label: "Python Programming",  emoji: "🐍" },
  { value: "middle_school_science", label: "Middle School Science", emoji: "🔬" },
];

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
    <div className="min-h-screen bg-aristo-gradient flex items-center justify-center p-4">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-aristo-orange-pale/40 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-aristo-orange-light/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gradient mb-2">Aristo</h1>
          <p className="text-[#8B6E5A] text-sm">
            {userName ? `Welcome, ${userName}!` : "Welcome!"} Let&apos;s personalise your experience.
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`h-2 rounded-full transition-all duration-300 ${
                n === step
                  ? "w-6 bg-[#F97B2F]"
                  : n < step
                  ? "w-2 bg-[#F97B2F]/40"
                  : "w-2 bg-[#E5D5CB]"
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <div className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-2xl p-8 shadow-aristo">

          {/* Step 1 — Goal */}
          {step === 1 && (
            <div>
              <h2 className="text-lg font-bold text-[#3D2110] mb-1">What&apos;s your goal?</h2>
              <p className="text-sm text-[#8B6E5A] mb-6">This shapes how we pace and structure your lessons.</p>
              <div className="space-y-3">
                {GOALS.map((g) => (
                  <button
                    key={g.value}
                    onClick={() => setGoal(g.value)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                      goal === g.value
                        ? "border-[#F97B2F] bg-[#FFF0E4]"
                        : "border-white/60 bg-white/50 hover:border-[#F97B2F]/40 hover:bg-[#FFF8F4]"
                    }`}
                  >
                    <div className="font-semibold text-[#3D2110] text-sm">{g.label}</div>
                    <div className="text-xs text-[#8B6E5A] mt-0.5">{g.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 — Daily time */}
          {step === 2 && (
            <div>
              <h2 className="text-lg font-bold text-[#3D2110] mb-1">How much time can you commit daily?</h2>
              <p className="text-sm text-[#8B6E5A] mb-6">We&apos;ll size lessons and reviews to fit your schedule.</p>
              <div className="grid grid-cols-2 gap-3">
                {TIMES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTime(t.value)}
                    className={`p-4 rounded-xl border-2 text-center transition-all duration-200 ${
                      time === t.value
                        ? "border-[#F97B2F] bg-[#FFF0E4]"
                        : "border-white/60 bg-white/50 hover:border-[#F97B2F]/40 hover:bg-[#FFF8F4]"
                    }`}
                  >
                    <div className="font-semibold text-[#3D2110] text-sm">{t.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3 — Domain */}
          {step === 3 && (
            <div>
              <h2 className="text-lg font-bold text-[#3D2110] mb-1">What do you want to learn?</h2>
              <p className="text-sm text-[#8B6E5A] mb-6">We&apos;ll load a curated knowledge graph for your subject.</p>
              <div className="space-y-3">
                {DOMAINS.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setDomain(d.value)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 flex items-center gap-4 ${
                      domain === d.value
                        ? "border-[#F97B2F] bg-[#FFF0E4]"
                        : "border-white/60 bg-white/50 hover:border-[#F97B2F]/40 hover:bg-[#FFF8F4]"
                    }`}
                  >
                    <span className="text-2xl">{d.emoji}</span>
                    <span className="font-semibold text-[#3D2110] text-sm">{d.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between mt-8">
            {step > 1 ? (
              <button
                onClick={() => setStep((s) => (s - 1) as 1 | 2)}
                className="text-sm text-[#8B6E5A] hover:text-[#3D2110] transition-colors"
              >
                ← Back
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                onClick={advance}
                disabled={!canAdvance}
                className="px-6 py-2.5 rounded-xl bg-[#F97B2F] text-white font-semibold text-sm shadow-aristo-sm hover:bg-[#C45A10] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canAdvance || submitting}
                className="px-6 py-2.5 rounded-xl bg-[#F97B2F] text-white font-semibold text-sm shadow-aristo-sm hover:bg-[#C45A10] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? "Setting up…" : "Start learning →"}
              </button>
            )}
          </div>
        </div>

        {/* Step label */}
        <p className="text-center text-xs text-[#8B6E5A] mt-4">
          Step {step} of 3
        </p>
      </div>
    </div>
  );
}
