"use client";

/**
 * StyleAssessment — Onboarding learning profile wizard.
 *
 * Measures two independent dimensions from the Felder-Silverman Learning
 * Styles Model (FSLSM), then overlays an engagement preference:
 *
 *  Dimension 1 — Processing   : Active  ↔  Reflective  (3 questions)
 *  Dimension 2 — Understanding: Sequential ↔  Global    (3 questions)
 *  → Combined into 4 style profiles:
 *      Explorer    (Active + Global)
 *      Builder     (Active + Sequential)
 *      Synthesizer (Reflective + Global)
 *      Analyst     (Reflective + Sequential)
 *
 *  Engagement preference      : Interactive ↔ Structured (4 questions incl. demo)
 *
 * Question format: forced-choice A/B scenario questions (research-validated
 * for adolescents — low cognitive load, high engagement).
 *
 * Total: 10 questions. ~2 minutes for a middle-schooler.
 */

import { useState, useCallback } from "react";
import type { LearningStyle, TeachingFlow } from "@/store/useAristoStore";

// ─── Question data ────────────────────────────────────────────────────────────

type ProcessingVote = "active" | "reflective";
type UnderstandingVote = "global" | "sequential";
type FlowVote = "interactive" | "structured";

interface Option {
  value: string;
  label: string;
  sublabel?: string;
}

type QuestionAxis =
  | { type: "processing"; a: ProcessingVote; b: ProcessingVote }
  | { type: "understanding"; a: UnderstandingVote; b: UnderstandingVote }
  | { type: "flow"; a: FlowVote; b: FlowVote };

interface Question {
  id: string;
  emoji: string;
  text: string;
  options: [Option, Option] | [Option, Option, Option, Option];
  axis: QuestionAxis;
}

/**
 * Questions adapted from the Index of Learning Styles (Felder & Soloman)
 * and rewritten for middle-school readability.
 * Each question maps cleanly to one FSLSM dimension.
 */
const QUESTIONS: Question[] = [
  // ── Processing: Active vs Reflective ──────────────────────────────────────

  {
    id: "p1",
    emoji: "🏃",
    text: "When you're learning something new, you understand it better if you…",
    axis: { type: "processing", a: "active", b: "reflective" },
    options: [
      {
        value: "a",
        label: "Try it out — work through examples and figure it out by doing",
        sublabel: "Learn by doing",
      },
      {
        value: "b",
        label: "Think it through first — understand the idea before you try anything",
        sublabel: "Think before doing",
      },
    ],
  },
  {
    id: "p2",
    emoji: "📝",
    text: "When you're studying something difficult, you prefer to…",
    axis: { type: "processing", a: "active", b: "reflective" },
    options: [
      {
        value: "a",
        label: "Talk it through with someone or jump straight into practice problems",
        sublabel: "Active engagement",
      },
      {
        value: "b",
        label: "Work through it quietly in your head — reading, thinking, processing",
        sublabel: "Quiet reflection",
      },
    ],
  },
  {
    id: "p3",
    emoji: "🧗",
    text: "When you get stuck on a tricky problem, you tend to…",
    axis: { type: "processing", a: "active", b: "reflective" },
    options: [
      {
        value: "a",
        label: "Try different approaches until something works — even if most fail",
        sublabel: "Try, try, try",
      },
      {
        value: "b",
        label: "Stop and think carefully through the logic before trying again",
        sublabel: "Think, then try",
      },
    ],
  },

  // ── Understanding: Global vs Sequential ──────────────────────────────────

  {
    id: "u1",
    emoji: "🗺",
    text: "When starting a new subject, you would rather your teacher…",
    axis: { type: "understanding", a: "global", b: "sequential" },
    options: [
      {
        value: "a",
        label: "Show you the big picture first — why it matters and how it all fits",
        sublabel: "Overview first",
      },
      {
        value: "b",
        label: "Start from the very basics and build it up carefully, one step at a time",
        sublabel: "Step by step",
      },
    ],
  },
  {
    id: "u2",
    emoji: "🌳",
    text: "When you think about how you learn, you would say you tend to…",
    axis: { type: "understanding", a: "global", b: "sequential" },
    options: [
      {
        value: "a",
        label: "Understand the overall big picture, but sometimes miss some of the details",
        sublabel: "Big picture person",
      },
      {
        value: "b",
        label: "Understand the details clearly, but sometimes miss how it all fits together",
        sublabel: "Detail-oriented person",
      },
    ],
  },
  {
    id: "u3",
    emoji: "🔭",
    text: "After learning something, you feel most confident when you can…",
    axis: { type: "understanding", a: "global", b: "sequential" },
    options: [
      {
        value: "a",
        label: "Explain how the topic connects to other things you know and why it matters",
        sublabel: "See the connections",
      },
      {
        value: "b",
        label: "Walk through every part of it clearly, from beginning to end",
        sublabel: "Explain every step",
      },
    ],
  },

  // ── Engagement: Interactive vs Structured ─────────────────────────────────

  {
    id: "f1",
    emoji: "🎯",
    text: "When Aristo starts teaching you a new topic, you'd prefer it to…",
    axis: { type: "flow", a: "interactive", b: "structured" },
    options: [
      {
        value: "a",
        label: "Ask what you already know and guide you to figure things out",
        sublabel: "Guided discovery",
      },
      {
        value: "b",
        label: "Give you a clear full explanation first, then let you ask questions",
        sublabel: "Explanation first",
      },
    ],
  },
  {
    id: "f2",
    emoji: "✋",
    text: "If Aristo asks you something you're not totally sure about, you…",
    axis: { type: "flow", a: "interactive", b: "structured" },
    options: [
      {
        value: "a",
        label: "Like having a go at guessing — even wrong answers help you learn",
        sublabel: "Embrace the guess",
      },
      {
        value: "b",
        label: "Would rather hear the full explanation before being put on the spot",
        sublabel: "Know before being asked",
      },
    ],
  },
  {
    id: "f3",
    emoji: "🎮",
    text: "Which style of lesson sounds more like you?",
    axis: { type: "flow", a: "interactive", b: "structured" },
    options: [
      {
        value: "a",
        label: '"Let\'s discover this together — I\'ll give you clues and you figure it out"',
        sublabel: "Collaborative discovery",
      },
      {
        value: "b",
        label: '"I\'ll explain everything clearly first, then you can ask anything you want"',
        sublabel: "Clear explanation, then Q&A",
      },
    ],
  },
  {
    id: "f4_demo",
    emoji: "⚡",
    text: "Here are two ways Aristo could start teaching you about gravity. Which one feels right for you?",
    axis: { type: "flow", a: "interactive", b: "structured" },
    options: [
      {
        value: "a",
        label:
          '"Quick question before we start — why do you think you don\'t float off into space right now? What do you think is keeping you on the ground?"',
        sublabel: "Interactive: discovery question first →",
      },
      {
        value: "b",
        label:
          '"Gravity is the force that pulls all objects with mass toward each other. The more mass an object has, the stronger its gravitational pull. For example, Earth pulls you..."',
        sublabel: "Structured: full explanation first →",
      },
    ],
  },
];

// ─── Scoring ──────────────────────────────────────────────────────────────────

function computeResults(answers: Record<string, string>): {
  style: LearningStyle;
  flow: TeachingFlow;
  processingScore: { active: number; reflective: number };
  understandingScore: { global: number; sequential: number };
} {
  let active = 0,
    reflective = 0,
    global = 0,
    sequential = 0,
    interactive = 0,
    structured = 0;

  for (const q of QUESTIONS) {
    const answer = answers[q.id]; // "a" or "b"
    if (!answer) continue;

    if (q.axis.type === "processing") {
      if (answer === "a") {
        if (q.axis.a === "active") active++;
        else reflective++;
      } else {
        if (q.axis.b === "active") active++;
        else reflective++;
      }
    } else if (q.axis.type === "understanding") {
      if (answer === "a") {
        if (q.axis.a === "global") global++;
        else sequential++;
      } else {
        if (q.axis.b === "global") global++;
        else sequential++;
      }
    } else {
      // flow
      if (answer === "a") {
        if (q.axis.a === "interactive") interactive++;
        else structured++;
      } else {
        if (q.axis.b === "interactive") interactive++;
        else structured++;
      }
    }
  }

  // Resolve ties with the more engaging default
  const isActive = active >= reflective;
  const isGlobal = global >= sequential;

  let style: LearningStyle;
  if (isActive && isGlobal) style = "explorer";
  else if (isActive && !isGlobal) style = "builder";
  else if (!isActive && isGlobal) style = "synthesizer";
  else style = "analyst";

  const flow: TeachingFlow = interactive >= structured ? "interactive" : "structured";

  return {
    style,
    flow,
    processingScore: { active, reflective },
    understandingScore: { global, sequential },
  };
}

// ─── Profile definitions ──────────────────────────────────────────────────────

const STYLE_PROFILES: Record<
  LearningStyle,
  {
    name: string;
    emoji: string;
    tagline: string;
    description: string;
    processingLabel: string;
    understandingLabel: string;
  }
> = {
  explorer: {
    name: "Explorer",
    emoji: "🌍",
    tagline: "Active · Big Picture",
    description:
      "You learn by diving in and seeing how everything connects. You need the 'why' before the 'what', and you love discovering unexpected links between ideas. Aristo will lead with the big story, spark your curiosity, and ask you questions that make you think beyond the obvious.",
    processingLabel: "Active learner",
    understandingLabel: "Big-picture thinker",
  },
  builder: {
    name: "Builder",
    emoji: "🧱",
    tagline: "Active · Step-by-Step",
    description:
      "You learn by doing, one solid piece at a time. Each concept needs to be concrete and grounded before the next. Aristo will build your knowledge like LEGO — one brick at a time, with hands-on examples and clear steps, never moving forward until the current piece clicks.",
    processingLabel: "Active learner",
    understandingLabel: "Step-by-step thinker",
  },
  synthesizer: {
    name: "Synthesizer",
    emoji: "🔮",
    tagline: "Reflective · Big Picture",
    description:
      "You learn by reflecting and connecting. Analogies, metaphors, and stories are your superpower — when a new idea links to something you already know, it sticks forever. Aristo will lead with vivid comparisons, give you space to think, and help you build a rich web of understanding.",
    processingLabel: "Reflective learner",
    understandingLabel: "Big-picture thinker",
  },
  analyst: {
    name: "Analyst",
    emoji: "🔬",
    tagline: "Reflective · Detail-Oriented",
    description:
      "You want the real explanation — no hand-waving, no oversimplification. Precise definitions, exact mechanisms, the genuine 'why behind the why'. Aristo will go deep, use proper terminology, walk through the logic rigorously, and not skip any steps.",
    processingLabel: "Reflective learner",
    understandingLabel: "Detail-oriented thinker",
  },
};

const FLOW_PROFILES: Record<
  TeachingFlow,
  { name: string; emoji: string; description: string }
> = {
  interactive: {
    name: "Interactive",
    emoji: "🧭",
    description:
      "Aristo will teach through guided conversation — asking you questions, letting you guess, and building understanding together. You're an active participant, not just a listener.",
  },
  structured: {
    name: "Structured",
    emoji: "📋",
    description:
      "Aristo will give you the full explanation first, clearly and completely — then you can ask anything you want. You process on your own terms, at your own pace.",
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface StyleAssessmentProps {
  userId: string;
  onComplete: (style: LearningStyle, flow: TeachingFlow) => void;
}

export function StyleAssessment({ userId, onComplete }: StyleAssessmentProps) {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [phase, setPhase] = useState<"questions" | "saving" | "results">("questions");
  const [results, setResults] = useState<ReturnType<typeof computeResults> | null>(null);
  const [saveError, setSaveError] = useState(false);

  const question = QUESTIONS[currentQ];
  const isLast = currentQ === QUESTIONS.length - 1;
  // Count answered questions for a smooth progress bar
  const answeredCount = Object.keys(answers).length + (selected ? 1 : 0);
  const progress = (answeredCount / QUESTIONS.length) * 100;

  const handleSelect = useCallback((value: string) => setSelected(value), []);

  const handleNext = useCallback(async () => {
    if (!selected || !question) return;

    const newAnswers = { ...answers, [question.id]: selected };
    setAnswers(newAnswers);
    setSelected(null);

    if (!isLast) {
      setCurrentQ((q) => q + 1);
      return;
    }

    // Last question — compute results, save, show results
    const computed = computeResults(newAnswers);
    setPhase("saving");

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      await supabase.from("style_assessments").insert({
        user_id: userId,
        explorer: computed.style === "explorer" ? 1 : 0,
        builder: computed.style === "builder" ? 1 : 0,
        synthesizer: computed.style === "synthesizer" ? 1 : 0,
        analyst: computed.style === "analyst" ? 1 : 0,
        result_style: computed.style,
        teaching_flow: computed.flow,
      });

      await supabase
        .from("profiles")
        .update({
          learning_style: computed.style,
          teaching_flow: computed.flow,
          style_locked: true,
        })
        .eq("id", userId);
    } catch (err) {
      console.error("Failed to save assessment:", err);
      setSaveError(true);
    }

    setResults(computed);
    setPhase("results");
  }, [selected, question, answers, isLast, userId]);

  const handleStartLearning = useCallback(() => {
    if (!results) return;
    onComplete(results.style, results.flow);
  }, [results, onComplete]);

  // ── Results screen ─────────────────────────────────────────────────────────

  if (phase === "results" && results) {
    const sp = STYLE_PROFILES[results.style];
    const fp = FLOW_PROFILES[results.flow];
    const { processingScore, understandingScore } = results;
    const totalP = processingScore.active + processingScore.reflective;
    const totalU = understandingScore.global + understandingScore.sequential;

    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-[#FFF5EC] via-[#FDF6EE] to-[#FFF0E4] px-5 overflow-y-auto">
        <div className="absolute top-16 right-12 w-72 h-72 rounded-full bg-[#F97B2F]/6 blur-3xl pointer-events-none" />
        <div className="absolute bottom-16 left-8 w-80 h-80 rounded-full bg-[#FBA962]/8 blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full max-w-md flex flex-col gap-5 py-10 animate-[fade-in_0.5s_ease-out]">
          {/* Header */}
          <div className="text-center">
            <p className="text-4xl mb-3">🎉</p>
            <h1 className="text-2xl font-bold text-[#3D2110] mb-1.5">
              Your learning profile
            </h1>
            <p className="text-[#8B6E5A] text-sm leading-relaxed">
              Aristo will teach you exactly this way — and adapt over time as it
              learns what works best for you.
            </p>
          </div>

          {/* Style profile card */}
          <div className="bg-white/80 backdrop-blur-sm border border-white/60 rounded-2xl p-5 shadow-sm">
            <div className="flex items-start gap-3 mb-3">
              <span className="text-3xl mt-0.5">{sp.emoji}</span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#F97B2F] mb-0.5">
                  Your learning style
                </p>
                <p className="text-xl font-bold text-[#3D2110]">{sp.name}</p>
                <p className="text-xs text-[#B8957A] font-medium">{sp.tagline}</p>
              </div>
            </div>
            <p className="text-sm text-[#5C3D1E] leading-relaxed mb-3">
              {sp.description}
            </p>

            {/* Score bars */}
            <div className="flex flex-col gap-2 mt-1">
              {/* Processing axis */}
              <div>
                <div className="flex justify-between text-[10px] font-semibold text-[#B8957A] mb-1">
                  <span>Active</span>
                  <span>Reflective</span>
                </div>
                <div className="h-1.5 bg-[#F4DFC0] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#F97B2F] rounded-full transition-all duration-700"
                    style={{ width: `${(processingScore.active / totalP) * 100}%` }}
                  />
                </div>
              </div>
              {/* Understanding axis */}
              <div>
                <div className="flex justify-between text-[10px] font-semibold text-[#B8957A] mb-1">
                  <span>Big Picture</span>
                  <span>Step-by-Step</span>
                </div>
                <div className="h-1.5 bg-[#F4DFC0] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#F97B2F] rounded-full transition-all duration-700"
                    style={{ width: `${(understandingScore.global / totalU) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Teaching flow card */}
          <div className="bg-white/80 backdrop-blur-sm border border-white/60 rounded-2xl p-5 shadow-sm">
            <div className="flex items-start gap-3 mb-2">
              <span className="text-2xl mt-0.5">{fp.emoji}</span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#F97B2F] mb-0.5">
                  Teaching mode
                </p>
                <p className="text-lg font-bold text-[#3D2110]">{fp.name}</p>
              </div>
            </div>
            <p className="text-sm text-[#5C3D1E] leading-relaxed">{fp.description}</p>
          </div>

          {saveError && (
            <p className="text-xs text-[#C45A10] text-center bg-[#FFF0E4] rounded-xl px-4 py-2">
              Couldn't save to your profile right now, but your preferences are
              set for this session.
            </p>
          )}

          {/* CTA */}
          <button
            onClick={handleStartLearning}
            className="w-full py-3.5 rounded-2xl bg-[#F97B2F] text-white font-semibold text-base shadow-[0_4px_20px_rgba(249,123,47,0.35)] hover:bg-[#E06A20] transition-all duration-200 active:scale-[0.98]"
          >
            Start learning →
          </button>
        </div>
      </div>
    );
  }

  // ── Saving screen ──────────────────────────────────────────────────────────

  if (phase === "saving") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-[#FFF5EC] via-[#FDF6EE] to-[#FFF0E4]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-[#F97B2F]/30 border-t-[#F97B2F] animate-spin" />
          <p className="text-[#8B6E5A] text-sm font-medium">Building your profile…</p>
        </div>
      </div>
    );
  }

  // ── Question screen ────────────────────────────────────────────────────────

  if (!question) return null;

  // Determine which section we're in for a contextual section label
  const sectionLabel =
    question.axis.type === "processing"
      ? "How you process"
      : question.axis.type === "understanding"
      ? "How you understand"
      : "How you like to be taught";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-[#FFF5EC] via-[#FDF6EE] to-[#FFF0E4]">
      <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-[#F97B2F]/6 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-[#FBA962]/8 blur-3xl pointer-events-none" />

      {/* Top bar */}
      <div className="relative z-10 px-6 pt-6 pb-3 flex flex-col gap-3 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-[#3D2110] text-lg tracking-tight">aristo</span>
          <span className="text-[#F97B2F] text-lg font-bold">✦</span>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#B8957A]">
              {sectionLabel}
            </span>
            <span className="text-[10px] font-medium text-[#B8957A]">
              {currentQ + 1} of {QUESTIONS.length}
            </span>
          </div>
          <div className="h-1.5 bg-[#F4DFC0] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#F97B2F] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Question + options */}
      <div className="relative z-10 flex-1 flex flex-col justify-center px-6 pb-6 gap-5 overflow-y-auto">
        <div className="text-center">
          <div className="text-4xl mb-3">{question.emoji}</div>
          <h2 className="text-[18px] font-bold text-[#3D2110] leading-snug max-w-sm mx-auto">
            {question.text}
          </h2>
        </div>

        <div className="flex flex-col gap-3 max-w-md mx-auto w-full">
          {question.options.map((opt) => {
            const isSelected = selected === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                className={`w-full text-left px-5 py-4 rounded-2xl border-2 transition-all duration-200 active:scale-[0.99] ${
                  isSelected
                    ? "bg-[#FFF0E4] border-[#F97B2F] shadow-[0_4px_20px_rgba(249,123,47,0.18)]"
                    : "bg-white/70 border-white/60 hover:border-[#F97B2F]/40 hover:bg-[#FFF8F2]"
                }`}
              >
                <p
                  className={`text-sm font-medium leading-snug ${
                    isSelected ? "text-[#3D2110]" : "text-[#5C3D1E]"
                  }`}
                >
                  {opt.label}
                </p>
                {opt.sublabel && (
                  <p
                    className={`text-[11px] mt-1 font-semibold uppercase tracking-wider ${
                      isSelected ? "text-[#F97B2F]" : "text-[#B8957A]"
                    }`}
                  >
                    {opt.sublabel}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        <div className="max-w-md mx-auto w-full">
          <button
            onClick={handleNext}
            disabled={!selected}
            className="w-full py-3.5 rounded-2xl bg-[#F97B2F] text-white font-semibold text-sm shadow-[0_4px_16px_rgba(249,123,47,0.3)] hover:bg-[#E06A20] transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none active:scale-[0.98]"
          >
            {isLast ? "See my profile →" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}
