"use client";

/**
 * LessonView — renders a 5-phase lesson inline in the message panel.
 *
 * Two modes:
 *
 *  • Legacy mode (default — playbackMode=false): the view owns its TTS,
 *    image generation, and phase navigation.  Each phase narrates as it
 *    becomes active; DemonstrateCard fires /api/generate-model for the
 *    topic image; ChallengeCard handles its own submit flow.
 *
 *  • Playback mode (playbackMode=true): the parent <LessonPlayer/> owns
 *    narration via the {@link useLessonPlayback} state machine — segment
 *    text, gestures, per-segment images, and segment-aware highlighting
 *    are all driven from above.  In this mode the view skips its own
 *    TTS effects and generate-model fetch, and the displayed phase is
 *    synced to the playback engine's current segment.  Navigation
 *    buttons call back into the parent's onJumpToPhase so the playback
 *    engine fast-forwards / rewinds to match the user's intent.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  ChevronDown,
  CircleCheck,
  History,
  Lightbulb,
  Presentation,
  ScrollText,
  Target,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { useAristoStore, type LessonPayload } from "@/store/useAristoStore";
import { useTTS } from "@/hooks/useTTS";
import { Button } from "@/components/ui/button";
import { FOCUS, SHAPE } from "@/lib/design/shape";
import { cn } from "@/lib/utils";

// ─── The five phases (brand-system.md: no colours) ───────────────────────────
//
// A phase is told apart by its number, its icon and its place in the rail,
// all in the one accent. Exported for the caption band in LessonPlayer.

type Phase = keyof LessonPayload["phases"];

export const PHASE_META: Record<Phase, { n: number; name: string; icon: LucideIcon }> = {
  activate:    { n: 1, name: "Activate",    icon: History },
  explain:     { n: 2, name: "Explain",     icon: AudioLines },
  demonstrate: { n: 3, name: "Demonstrate", icon: Presentation },
  challenge:   { n: 4, name: "Challenge",   icon: Target },
  connect:     { n: 5, name: "Connect",     icon: Waypoints },
};

/** The system's phase label (the landing hero chip): icon, name, step N of 5. */
export function PhaseLabel({ phase, className }: { phase: Phase; className?: string }) {
  const { n, name, icon: Icon } = PHASE_META[phase];
  return (
    <span className={cn("inline-flex items-center gap-2 text-xs font-semibold text-ink", className)}>
      <Icon aria-hidden className="size-[18px] shrink-0 text-accent-text" />
      {name}, step {n} of 5
    </span>
  );
}

// ─── Shared card shell ────────────────────────────────────────────────────────

function PhaseCard({
  phase,
  children,
}: {
  phase:    Phase;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        SHAPE.surface,
        "shrink-0 overflow-hidden border border-line bg-surface motion-safe:animate-[fade-in_0.4s_ease-out]",
      )}
    >
      <div className="px-4 pt-3.5 pb-1">
        <PhaseLabel phase={phase} />
      </div>
      <div className="px-4 pt-2 pb-4">{children}</div>
    </section>
  );
}

// ─── Phase rail ───────────────────────────────────────────────────────────────
//
// The five phases as one brand element: number and icon for each, the current
// one lit in the accent with its name. Not interactive; Back / Next move.

function PhaseRail({ current }: { current: number }) {
  return (
    <ol aria-label="Lesson phases" className="flex items-center">
      {PHASES.map((p, i) => {
        const { n, name, icon: Icon } = PHASE_META[p];
        const isCurrent = i === current;
        const isDone    = i < current;
        return (
          <li
            key={p}
            aria-current={isCurrent ? "step" : undefined}
            className={cn("flex items-center", i < PHASES.length - 1 && "flex-1")}
          >
            <span
              className={cn(
                SHAPE.pill,
                "flex h-8 shrink-0 items-center gap-1.5 text-xs font-semibold tabular-nums transition-colors duration-base ease-out-soft",
                isCurrent ? "bg-accent px-3 text-accent-ink" : "px-1",
                isDone && "text-accent-text",
                !isCurrent && !isDone && "text-muted",
              )}
            >
              <span>{n}</span>
              <Icon aria-hidden className="size-4 shrink-0" />
              <span className={isCurrent ? undefined : "sr-only"}>
                {name}
                {isDone && <span className="sr-only">, done</span>}
              </span>
            </span>
            {i < PHASES.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "mx-1.5 h-px flex-1 transition-colors duration-base",
                  i < current ? "bg-accent" : "bg-line",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ─── Caption (playback mode) ──────────────────────────────────────────────────
//
// The sentence being spoken and the one after it. The band over the scene
// (LessonPlayer, md and up) and the in-panel caption below md both show it.

export function captionAt(
  segments: Array<{ id: string; text: string }> | undefined,
  currentSegmentId: string | null,
): { current: string | null; next: string | null } {
  if (!segments || !currentSegmentId) return { current: null, next: null };
  const i = segments.findIndex((s) => s.id === currentSegmentId);
  if (i < 0) return { current: null, next: null };
  return { current: segments[i].text, next: segments[i + 1]?.text ?? null };
}

// ─── Segment script (the transcript drawer) ──────────────────────────────────
//
// Renders the segment texts that belong to a phase, with the currently-narrating
// segment highlighted so the student can follow which sentence the avatar is on.

function SegmentScript({
  segments,
  currentSegmentId,
}: {
  segments:         Array<{ id: string; text: string }>;
  currentSegmentId: string | null;
}) {
  if (segments.length === 0) return null;
  return (
    <div className="space-y-1">
      {segments.map((s) => {
        const active = s.id === currentSegmentId;
        return (
          <p
            key={s.id}
            aria-current={active ? "true" : undefined}
            className={cn(
              SHAPE.control,
              "border-l-[3px] px-3 py-1.5 text-sm leading-relaxed transition-colors duration-base",
              active
                ? "border-accent bg-tint font-semibold text-ink"
                : "border-transparent text-body",
            )}
          >
            {s.text}
          </p>
        );
      })}
    </div>
  );
}

// ─── ExplainMore button ───────────────────────────────────────────────────────

function ExplainMoreBtn({
  phase,
  phaseContent,
  conceptName,
}: {
  phase:        keyof LessonPayload["phases"];
  phaseContent: string;
  conceptName:  string;
}) {
  const [loading,  setLoading]  = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const incrementSignal = useAristoStore((s) => s.incrementSignal);

  const handleClick = useCallback(async () => {
    if (expanded || loading) return;
    incrementSignal("clicked_explain_more");
    setLoading(true);
    try {
      const res = await fetch("/api/learn/explain-more", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ phase, phaseContent, conceptName }),
      });
      const data = await res.json();
      setExpanded(data.explanation);
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
  }, [phase, phaseContent, conceptName, expanded, loading, incrementSignal]);

  return (
    <div className="mt-2">
      {!expanded ? (
        <Button
          variant="ghost"
          onClick={handleClick}
          disabled={loading}
          className="-ml-3 px-3 text-accent-text hover:bg-tint"
        >
          {loading ? "Loading…" : "Explain more"}
          {!loading && <ChevronDown aria-hidden />}
        </Button>
      ) : (
        <div
          className={cn(
            SHAPE.control,
            "mt-2 border border-tint-line bg-tint px-3 py-2 text-sm leading-relaxed text-body motion-safe:animate-[fade-in_0.3s_ease-out]",
          )}
        >
          {expanded}
        </div>
      )}
    </div>
  );
}

// ─── Per-phase card props ────────────────────────────────────────────────────

interface PhaseCardCommon {
  conceptName:          string;
  /** Playback mode: the narration lives in the caption and the transcript drawer,
   *  and the view skips its own TTS. */
  playbackMode?:        boolean;
}

// ─── Phase 1: Activate ────────────────────────────────────────────────────────

function ActivateCard({
  phase, conceptName, playbackMode,
}: PhaseCardCommon & { phase: LessonPayload["phases"]["activate"] }) {
  return (
    <PhaseCard phase="activate">
      {!playbackMode && (
        <p className="text-sm leading-relaxed text-ink">{phase.content}</p>
      )}
      {phase.prerequisites_referenced && phase.prerequisites_referenced.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {phase.prerequisites_referenced.map((p) => (
            <span
              key={p}
              className={cn(SHAPE.pill, "border border-line bg-sunk px-2.5 py-1 text-xs font-medium text-body")}
            >
              {p}
            </span>
          ))}
        </div>
      )}
      <ExplainMoreBtn phase="activate" phaseContent={phase.content} conceptName={conceptName} />
    </PhaseCard>
  );
}

// ─── Phase 2: Explain ─────────────────────────────────────────────────────────

function ExplainCard({
  phase, conceptName, playbackMode,
}: PhaseCardCommon & { phase: LessonPayload["phases"]["explain"] }) {
  return (
    <PhaseCard phase="explain">
      {/* Analogy */}
      <div className={cn(SHAPE.control, "mb-3 border border-tint-line bg-tint px-3 py-2.5")}>
        <p className="mb-1 text-xs font-semibold text-accent-text">Analogy</p>
        <p className="text-sm italic leading-relaxed text-body">{phase.analogy}</p>
      </div>
      {!playbackMode && (
        <p className="mb-2 text-sm leading-relaxed text-ink">{phase.formal_explanation}</p>
      )}
      {/* Key insight */}
      <div className={cn(SHAPE.control, "flex gap-2 border border-warning/25 bg-warning/10 px-3 py-2.5")}>
        <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
        <p className="text-sm leading-relaxed text-warning">
          <span className="sr-only">Key insight: </span>
          {phase.key_insight}
        </p>
      </div>
      <ExplainMoreBtn phase="explain" phaseContent={phase.formal_explanation} conceptName={conceptName} />
    </PhaseCard>
  );
}

// ─── Phase 3: Demonstrate ─────────────────────────────────────────────────────

function DemonstrateCard({
  phase,
  conceptName,
  shouldGenerateModel,
  playbackMode,
}: PhaseCardCommon & {
  phase:               LessonPayload["phases"]["demonstrate"];
  shouldGenerateModel: boolean;
}) {
  const isGeneratingModel     = useAristoStore((s) => s.isGeneratingModel);
  const activeModelUrl        = useAristoStore((s) => s.activeModelUrl);
  const activePreviewImageUrl = useAristoStore((s) => s.activePreviewImageUrl);
  const pending3dImageUrl     = useAristoStore((s) => s.pending3dImageUrl);
  const viewMode3d            = useAristoStore((s) => s.viewMode3d);
  const setIsSpeaking         = useAristoStore((s) => s.setIsSpeaking);
  const setGesture            = useAristoStore((s) => s.setGesture);
  const { speak }             = useTTS();

  // Stage 0 — speak pre-visual narration on mount (image still generating, or none).
  // Stage 1 — when the educational image lands, switch to visual_walkthrough.
  // Stage 2 — when 3D model becomes active, narrate model_callouts.
  // Skipped entirely in playbackMode: the LessonPlayer owns narration.
  const lastSpokenStage = useRef<"pre" | "walkthrough" | "callouts" | null>(null);
  const ttsControllerRef = useRef<ReturnType<typeof speak> | null>(null);

  useEffect(() => {
    if (playbackMode) return; // LessonPlayer is in charge
    if (activeModelUrl && viewMode3d) {
      lastSpokenStage.current = "callouts";
      return;
    }
    if (activePreviewImageUrl && phase.visual_walkthrough) {
      setIsSpeaking(true);
      setGesture("pointing");
      ttsControllerRef.current = speak(phase.visual_walkthrough, {
        onEnd: () => { setIsSpeaking(false); setGesture("idle"); },
      });
      lastSpokenStage.current = "walkthrough";
      return;
    }
    setIsSpeaking(true);
    ttsControllerRef.current = speak(phase.narration_pre_visual ?? phase.example_description, {
      onEnd: () => setIsSpeaking(false),
    });
    lastSpokenStage.current = "pre";

    return () => { ttsControllerRef.current?.stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch to visual_walkthrough the instant the educational image lands.
  useEffect(() => {
    if (playbackMode) return;
    if (!activePreviewImageUrl) return;
    if (lastSpokenStage.current === "walkthrough" || lastSpokenStage.current === "callouts") return;
    if (!phase.visual_walkthrough) return;
    ttsControllerRef.current?.stop();
    setIsSpeaking(true);
    setGesture("pointing");
    ttsControllerRef.current = speak(phase.visual_walkthrough, {
      onEnd: () => { setIsSpeaking(false); setGesture("idle"); },
    });
    lastSpokenStage.current = "walkthrough";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePreviewImageUrl, playbackMode]);

  return (
    <PhaseCard phase="demonstrate">
      {!playbackMode && (
        <p className="mb-2 text-sm text-ink">{phase.example_description}</p>
      )}

      {/* Code block */}
      {phase.code && (
        <pre className={cn(SHAPE.control, "mb-3 overflow-x-auto border border-line bg-sunk px-3 py-2.5 font-mono text-xs leading-relaxed text-ink")}>
          {phase.code}
        </pre>
      )}

      {/* Step by step */}
      {phase.step_by_step.length > 0 && (
        <ol className="mb-2 space-y-1.5">
          {phase.step_by_step.map((step, i) => (
            <li key={i} className="flex gap-2 text-sm text-ink">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-tint-line bg-tint text-[11px] font-bold text-accent-text">
                {i + 1}
              </span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      )}

      {/* Output */}
      {phase.output && (
        <div className={cn(SHAPE.control, "border border-success/25 bg-success/10 px-3 py-2")}>
          <p className="mb-1 text-xs font-semibold text-success">Output</p>
          <pre className="font-mono text-xs text-ink">{phase.output}</pre>
        </div>
      )}

      {/* Visual state badge (legacy mode only — adaptive shows the live image in-scene) */}
      {!playbackMode && shouldGenerateModel && (
        <div className="mt-2 flex items-center gap-1.5">
          {isGeneratingModel && !activePreviewImageUrl ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-accent-text motion-safe:animate-pulse">
              <span className="size-1.5 rounded-full bg-accent motion-safe:animate-ping" />
              Drawing the image…
            </span>
          ) : isGeneratingModel && activePreviewImageUrl ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-accent-text motion-safe:animate-pulse">
              <span className="size-1.5 rounded-full bg-accent motion-safe:animate-ping" />
              Building 3D model…
            </span>
          ) : activeModelUrl && viewMode3d ? (
            <span className={cn(SHAPE.pill, "flex items-center gap-1.5 border border-success/25 bg-success/10 px-3 py-1 text-xs font-semibold text-success")}>
              <span className="size-1.5 rounded-full bg-success" />
              3D model in the room
            </span>
          ) : activePreviewImageUrl && pending3dImageUrl && !activeModelUrl ? (
            <span className={cn(SHAPE.pill, "flex items-center gap-1.5 border border-tint-line bg-tint px-3 py-1 text-xs font-semibold text-accent-text")}>
              <span className="size-1.5 rounded-full bg-accent" />
              The image is on the board. Tap View in 3D to turn it over.
            </span>
          ) : activePreviewImageUrl ? (
            <span className={cn(SHAPE.pill, "flex items-center gap-1.5 border border-success/25 bg-success/10 px-3 py-1 text-xs font-semibold text-success")}>
              <span className="size-1.5 rounded-full bg-success" />
              Image on the board
            </span>
          ) : null}
        </div>
      )}

      <ExplainMoreBtn phase="demonstrate" phaseContent={phase.example_description} conceptName={conceptName} />
    </PhaseCard>
  );
}

// ─── Phase 4: Challenge ───────────────────────────────────────────────────────

function ChallengeCard({
  phase, conceptName,
}: PhaseCardCommon & { phase: LessonPayload["phases"]["challenge"] }) {
  const [answer,      setAnswer]      = useState("");
  const [showHint,    setShowHint]    = useState(false);
  const [showAnswer,  setShowAnswer]  = useState(false);
  const [feedback,    setFeedback]    = useState<string | null>(null);
  const [isEvaluating, setEvaluating] = useState(false);
  const setGesture = useAristoStore((s) => s.setGesture);

  const handleSubmit = useCallback(async () => {
    if (!answer.trim() || isEvaluating) return;
    setEvaluating(true);
    try {
      const res = await fetch("/api/learn/challenge", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          question:      phase.question,
          correctAnswer: phase.answer,
          userAnswer:    answer,
          conceptName,
        }),
      });
      const data = await res.json();
      setFeedback(data.feedback ?? (data.is_correct ? "That's it." : "Not quite. Here is what to consider:"));
      setShowAnswer(true);
      // Gesture feedback — Teacher reverts it when the nod / shake clip ends
      setGesture(data.is_correct ? "nodding" : "shaking");
    } catch {
      setShowAnswer(true);
    } finally {
      setEvaluating(false);
    }
  }, [answer, isEvaluating, phase, conceptName, setGesture]);

  return (
    <PhaseCard phase="challenge">
      <p className="mb-3 text-sm font-medium leading-relaxed text-ink">{phase.question}</p>

      {!showAnswer && (
        <>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer…"
            aria-label="Your answer"
            rows={3}
            className={cn(
              SHAPE.control,
              "mb-2 w-full resize-none border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted hover:border-muted/50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
            )}
          />
          <div className="flex flex-wrap items-center gap-1">
            <Button onClick={handleSubmit} disabled={!answer.trim() || isEvaluating}>
              {isEvaluating ? "Checking…" : "Submit answer"}
            </Button>
            <Button variant="ghost" onClick={() => setShowHint(true)} className="text-body">
              Show hint
            </Button>
            <Button variant="ghost" onClick={() => setShowAnswer(true)} className="text-body">
              {"I don't know"}
            </Button>
          </div>

          {showHint && (
            <div className={cn(SHAPE.control, "mt-3 border border-tint-line bg-tint px-3 py-2 text-sm text-ink motion-safe:animate-[fade-in_0.3s_ease-out]")}>
              <span className="font-semibold">Hint: </span>{phase.hint}
            </div>
          )}
        </>
      )}

      {showAnswer && (
        <div className="space-y-2 motion-safe:animate-[fade-in_0.3s_ease-out]">
          {feedback && (
            <p className="text-sm font-medium text-ink">{feedback}</p>
          )}
          <div className={cn(SHAPE.control, "border border-line bg-sunk px-3 py-2.5")}>
            <p className="mb-1 text-xs font-semibold text-muted">Full answer</p>
            <p className="text-sm leading-relaxed text-ink">{phase.answer}</p>
          </div>
        </div>
      )}
    </PhaseCard>
  );
}

// ─── Phase 5: Connect ─────────────────────────────────────────────────────────

function ConnectCard({
  phase, playbackMode,
}: Omit<PhaseCardCommon, "conceptName"> & { phase: LessonPayload["phases"]["connect"] }) {
  return (
    <PhaseCard phase="connect">
      {!playbackMode && (
        <p className="text-sm leading-relaxed text-ink">{phase.content}</p>
      )}
      {phase.next_concept && (
        <div className={cn("flex flex-wrap items-center gap-2 text-xs", !playbackMode && "mt-3")}>
          <span className="font-semibold text-muted">Up next</span>
          <span className={cn(SHAPE.pill, "border border-tint-line bg-tint px-2.5 py-1 font-semibold text-accent-text")}>
            {phase.next_concept}
          </span>
        </div>
      )}
    </PhaseCard>
  );
}

// ─── Phase navigator ──────────────────────────────────────────────────────────

const PHASES: Array<keyof LessonPayload["phases"]> = [
  "activate", "explain", "demonstrate", "challenge", "connect",
];

function phaseSpeakText(lesson: LessonPayload, phase: keyof LessonPayload["phases"]): string {
  const p = lesson.phases;
  switch (phase) {
    case "activate":    return p.activate.content;
    case "explain":     return `${p.explain.analogy} ${p.explain.key_insight}`;
    case "demonstrate": return p.demonstrate.example_description;
    case "challenge":   return p.challenge.question;
    case "connect":     return p.connect.content;
  }
}

// ─── LessonView props ─────────────────────────────────────────────────────────

export interface LessonViewProps {
  /**
   * When true, the parent owns narration + per-segment visuals via
   * useLessonPlayback.  The view gates its own TTS / generate-model
   * effects, syncs the displayed phase to the active segment, and routes
   * phase-nav buttons through onJumpToPhase.
   */
  playbackMode?:   boolean;
  /** Forwarded to phase cards for segment highlighting (playbackMode only). */
  currentSegmentId?: string | null;
  /** Jump to a specific phase (playbackMode only). */
  onJumpToPhase?:  (phase: keyof LessonPayload["phases"]) => void;
  /** Replaces the legacy phaseIdx state when present. */
  controlledPhase?: keyof LessonPayload["phases"];
}

// ─── Main LessonView ─────────────────────────────────────────────────────────

export function LessonView({
  playbackMode    = false,
  currentSegmentId = null,
  onJumpToPhase,
  controlledPhase,
}: LessonViewProps = {}) {
  const lesson          = useAristoStore((s) => s.activeLesson);
  const setIsSpeaking   = useAristoStore((s) => s.setIsSpeaking);
  const setGesture      = useAristoStore((s) => s.setGesture);
  const incrementSignal = useAristoStore((s) => s.incrementSignal);
  const { speak }       = useTTS();

  const setActiveModelUrl        = useAristoStore((s) => s.setActiveModelUrl);
  const setActivePreviewImageUrl = useAristoStore((s) => s.setActivePreviewImageUrl);
  const setPending3dImageUrl     = useAristoStore((s) => s.setPending3dImageUrl);
  const setViewMode3d            = useAristoStore((s) => s.setViewMode3d);
  const setIsGeneratingModel     = useAristoStore((s) => s.setIsGeneratingModel);
  const activeModelUrl           = useAristoStore((s) => s.activeModelUrl);

  const [internalPhaseIdx, setInternalPhaseIdx] = useState(0);
  // Presentation only: whether the transcript drawer is open.
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  // When controlledPhase is provided (playback mode), derive phaseIdx from it.
  const phaseIdx = controlledPhase
    ? Math.max(0, PHASES.indexOf(controlledPhase))
    : internalPhaseIdx;

  // Reset to phase 1 whenever a new lesson loads (legacy mode only — the
  // playback engine resets its own segmentIdx).
  useEffect(() => {
    if (playbackMode) return;
    setInternalPhaseIdx(0);
  }, [lesson?.concept_id, playbackMode]);

  // Lift visual kickoff to lesson mount so generation overlaps Activate + Explain.
  // Image only — 3D conversion is deferred until the user clicks "View in 3D".
  // Skipped in playbackMode — the segment-visuals batch handles all imagery.
  useEffect(() => {
    if (playbackMode) return;
    if (!lesson) return;

    setActiveModelUrl(null);
    setActivePreviewImageUrl(null);
    setPending3dImageUrl(null);
    setViewMode3d(false);

    const { should_generate_model, model_image_prompt, model_3d_prompt } = lesson.metadata;
    if (!should_generate_model || !model_image_prompt) return;

    setIsGeneratingModel(true);
    fetch("/api/generate-model", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        imagePrompt:   model_image_prompt,
        model3dPrompt: model_3d_prompt,
        topic:         lesson.concept_name,
        conceptId:     lesson.concept_id,
      }),
    })
      .then((r) => r.json())
      .then(({ imageUrl, model3dImageUrl }) => {
        if (!imageUrl) return;
        setActivePreviewImageUrl(imageUrl);
        setPending3dImageUrl(model3dImageUrl ?? imageUrl);
      })
      .catch(() => {/* non-critical — narration falls back to pre_visual */})
      .finally(() => setIsGeneratingModel(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.concept_id, playbackMode]);

  // Speak model_callouts the moment a 3D model becomes active (any phase).
  // Skipped in playbackMode.
  useEffect(() => {
    if (playbackMode) return;
    if (!lesson || !activeModelUrl) return;
    const callouts = lesson.metadata.model_callouts;
    if (!callouts || callouts.length === 0) return;
    setIsSpeaking(true);
    setGesture("pointing");
    speak(callouts.join(" "), {
      onEnd: () => { setIsSpeaking(false); setGesture("idle"); },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModelUrl, playbackMode]);

  // Track time spent on each phase to accumulate behavioral signals
  const phaseEntryTimeRef = useRef<number>(Date.now());
  useEffect(() => {
    const prevPhase = PHASES[phaseIdx > 0 ? phaseIdx - 1 : 0];
    const elapsed   = Math.round((Date.now() - phaseEntryTimeRef.current) / 1000);
    phaseEntryTimeRef.current = Date.now();

    // Attribute elapsed time to the signal bucket of the phase we just left
    if (phaseIdx > 0 && elapsed > 1 && elapsed < 600) {
      if (prevPhase === "explain") {
        incrementSignal("time_on_explanations_seconds", elapsed);
      } else if (prevPhase === "demonstrate") {
        incrementSignal("time_on_examples_seconds", elapsed);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseIdx]);

  // Narrate the current phase when it activates (legacy mode only).
  useEffect(() => {
    if (playbackMode) return;
    if (!lesson) return;
    const phase = PHASES[phaseIdx];
    if (phase === "demonstrate") return; // DemonstrateCard owns its narration in legacy mode
    setIsSpeaking(true);
    const ctrl = speak(phaseSpeakText(lesson, phase), {
      onEnd: () => setIsSpeaking(false),
    });
    return () => ctrl.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseIdx, lesson, playbackMode]);

  // Fire lesson-complete when all phases viewed (legacy mode — playback engine
  // fires its own /api/learn/complete on segment overflow).
  useEffect(() => {
    if (playbackMode) return;
    if (!lesson || phaseIdx < PHASES.length - 1) return;
    fetch("/api/learn/complete", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ conceptId: lesson.concept_id }),
    }).catch(() => {});
  }, [phaseIdx, lesson, playbackMode]);

  // Precompute segments-per-phase so the cards stay pure.
  const segmentsByPhase = useMemo(() => {
    const map: Record<keyof LessonPayload["phases"], Array<{ id: string; text: string }>> = {
      activate:    [],
      explain:     [],
      demonstrate: [],
      challenge:   [],
      connect:     [],
    };
    if (!playbackMode || !lesson?.segments) return map;
    for (const s of lesson.segments) {
      map[s.phase].push({ id: s.id, text: s.text });
    }
    return map;
  }, [playbackMode, lesson]);

  if (!lesson) return null;

  const phase      = PHASES[phaseIdx];
  const isFirst    = phaseIdx === 0;
  const isLast     = phaseIdx === PHASES.length - 1;
  const caption       = captionAt(lesson.segments, currentSegmentId);
  const hasTranscript = PHASES.some((p) => segmentsByPhase[p].length > 0);

  const goNext = () => {
    const nextPhase = PHASES[phaseIdx + 1];
    if (!nextPhase) return;
    if (playbackMode && onJumpToPhase) {
      onJumpToPhase(nextPhase);
    } else {
      setInternalPhaseIdx((i) => i + 1);
    }
  };
  const goPrev = () => {
    const prevPhase = PHASES[phaseIdx - 1];
    if (!prevPhase) return;
    if (playbackMode && onJumpToPhase) {
      onJumpToPhase(prevPhase);
    } else {
      setInternalPhaseIdx((i) => i - 1);
    }
  };

  return (
    <>
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* The panel ground: the system's page colour at 95% over the scene, so
          every text pair below has a known background (brand-system.md). */}
      <div
        className={cn(
          "aristo-scroll flex h-full flex-col gap-3 overflow-y-auto bg-bg/95 px-4 pt-4",
          playbackMode ? "pb-24" : "pb-4",
        )}
      >

        {/* Lesson header: title and the phase rail */}
        <header className="flex shrink-0 flex-col gap-2.5">
          <h2 className="truncate text-sm font-bold text-ink">{lesson.concept_name}</h2>
          <PhaseRail current={phaseIdx} />
        </header>

        {/* In-panel caption below md, where the band over the scene is hidden */}
        {playbackMode && caption.current && (
          <div className={cn(SHAPE.surface, "shrink-0 border border-line bg-surface px-4 py-3 md:hidden")}>
            <p className="type-h4 font-semibold text-ink">{caption.current}</p>
            {caption.next && (
              <p className="mt-1.5 line-clamp-2 text-sm text-muted">{caption.next}</p>
            )}
          </div>
        )}

        {/* Active phase card */}
        {phase === "activate" && (
          <ActivateCard
            phase={lesson.phases.activate}
            conceptName={lesson.concept_name}
            playbackMode={playbackMode}
          />
        )}
        {phase === "explain" && (
          <ExplainCard
            phase={lesson.phases.explain}
            conceptName={lesson.concept_name}
            playbackMode={playbackMode}
          />
        )}
        {phase === "demonstrate" && (
          <DemonstrateCard
            key={lesson.concept_id}
            phase={lesson.phases.demonstrate}
            conceptName={lesson.concept_name}
            shouldGenerateModel={lesson.metadata.should_generate_model}
            playbackMode={playbackMode}
          />
        )}
        {phase === "challenge" && (
          <ChallengeCard
            phase={lesson.phases.challenge}
            conceptName={lesson.concept_name}
            playbackMode={playbackMode}
          />
        )}
        {phase === "connect" && (
          <ConnectCard
            phase={lesson.phases.connect}
            playbackMode={playbackMode}
          />
        )}

        {/* Transcript drawer: the whole lesson, the spoken sentence marked */}
        {playbackMode && hasTranscript && (
          <section className={cn(SHAPE.surface, "shrink-0 border border-line bg-surface")}>
            <button
              type="button"
              aria-expanded={transcriptOpen}
              aria-controls="lesson-transcript"
              onClick={() => setTranscriptOpen((o) => !o)}
              className={cn(
                SHAPE.surface,
                FOCUS,
                "flex h-11 w-full items-center justify-between px-4 text-sm font-semibold text-ink transition-colors duration-fast hover:bg-sunk",
              )}
            >
              <span className="inline-flex items-center gap-2">
                <ScrollText aria-hidden className="size-4 text-muted" />
                Transcript
              </span>
              <ChevronDown
                aria-hidden
                className={cn("size-4 text-muted transition-transform duration-base", transcriptOpen && "rotate-180")}
              />
            </button>
            {transcriptOpen && (
              <div id="lesson-transcript" className="space-y-3 px-2 pb-3">
                {PHASES.map((p) =>
                  segmentsByPhase[p].length > 0 ? (
                    <div key={p} className="space-y-1">
                      <PhaseLabel phase={p} className="px-2 py-1" />
                      <SegmentScript segments={segmentsByPhase[p]} currentSegmentId={currentSegmentId} />
                    </div>
                  ) : null,
                )}
              </div>
            )}
          </section>
        )}

        {/* Navigation */}
        <div className="mt-1 flex shrink-0 items-center justify-between">
          <Button variant="ghost" onClick={goPrev} disabled={isFirst} className="-ml-3 text-body">
            <ArrowLeft aria-hidden />
            Back
          </Button>
          {!isLast && (
            <Button onClick={goNext}>
              Next
              <ArrowRight aria-hidden />
            </Button>
          )}
          {isLast && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-success">
              <CircleCheck aria-hidden className="size-4" />
              Lesson complete
            </span>
          )}
        </div>
      </div>
    </>
  );
}
