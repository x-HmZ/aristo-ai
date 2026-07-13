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
import { useAristoStore, type LessonPayload } from "@/store/useAristoStore";
import { useTTS } from "@/hooks/useTTS";

// ─── Shared card shell ────────────────────────────────────────────────────────

function PhaseCard({
  label,
  accent,
  children,
}: {
  label:    string;
  accent:   string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur-sm border border-white/60 shadow-sm overflow-hidden animate-[fade-in_0.4s_ease-out]">
      <div
        className="px-4 py-2 flex items-center gap-2"
        style={{ backgroundColor: `${accent}18`, borderBottom: `1px solid ${accent}30` }}
      >
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>
          {label}
        </span>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

// ─── Segment script (playback mode only) ──────────────────────────────────────
//
// Renders the segment texts that belong to a phase, with the currently-narrating
// segment highlighted via a soft accent border + background tint so the student
// can follow exactly which sentence the avatar is on.

function SegmentScript({
  segments,
  currentSegmentId,
  accent,
}: {
  segments:         Array<{ id: string; text: string }>;
  currentSegmentId: string | null;
  accent:           string;
}) {
  if (segments.length === 0) return null;
  return (
    <div className="mb-3 space-y-1.5">
      {segments.map((s) => {
        const active = s.id === currentSegmentId;
        return (
          <div
            key={s.id}
            className="rounded-lg px-3 py-1.5 text-sm leading-relaxed transition-all duration-200"
            style={{
              borderLeft:      `3px solid ${active ? accent : "transparent"}`,
              background:      active ? `${accent}12` : "transparent",
              color:           active ? "#3D2110" : "#5C3D1E",
              fontWeight:      active ? 600 : 400,
            }}
          >
            {s.text}
          </div>
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
        <button
          onClick={handleClick}
          disabled={loading}
          className="text-[11px] font-semibold text-[#F97B2F] hover:text-[#E06A20] flex items-center gap-1 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Explain more ↓"}
        </button>
      ) : (
        <div className="mt-2 px-3 py-2 rounded-xl bg-[#FFF5EC] border border-[#F97B2F]/20 text-sm text-[#5C3D1E] leading-relaxed animate-[fade-in_0.3s_ease-out]">
          {expanded}
        </div>
      )}
    </div>
  );
}

// ─── Per-phase card props ────────────────────────────────────────────────────

interface PhaseCardCommon {
  conceptName:          string;
  /** Playback mode props — when present, render the segment script + skip own TTS */
  playbackMode?:        boolean;
  segmentsForPhase?:    Array<{ id: string; text: string }>;
  currentSegmentId?:    string | null;
}

// ─── Phase 1: Activate ────────────────────────────────────────────────────────

function ActivateCard({
  phase, conceptName, playbackMode, segmentsForPhase, currentSegmentId,
}: PhaseCardCommon & { phase: LessonPayload["phases"]["activate"] }) {
  return (
    <PhaseCard label="1 · Activate prior knowledge" accent="#8B5CF6">
      {playbackMode && segmentsForPhase && (
        <SegmentScript
          segments={segmentsForPhase}
          currentSegmentId={currentSegmentId ?? null}
          accent="#8B5CF6"
        />
      )}
      {!playbackMode && (
        <p className="text-sm text-[#3D2110] leading-relaxed">{phase.content}</p>
      )}
      {phase.prerequisites_referenced && phase.prerequisites_referenced.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {phase.prerequisites_referenced.map((p) => (
            <span key={p} className="text-[10px] px-2 py-0.5 rounded-full bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/20 font-medium">
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
  phase, conceptName, playbackMode, segmentsForPhase, currentSegmentId,
}: PhaseCardCommon & { phase: LessonPayload["phases"]["explain"] }) {
  return (
    <PhaseCard label="2 · Explain" accent="#F97B2F">
      {playbackMode && segmentsForPhase && (
        <SegmentScript
          segments={segmentsForPhase}
          currentSegmentId={currentSegmentId ?? null}
          accent="#F97B2F"
        />
      )}
      {/* Analogy */}
      <div className="mb-3 px-3 py-2.5 rounded-xl bg-[#FFF5EC] border border-[#F97B2F]/20">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#C45A10] mb-1">Analogy</p>
        <p className="text-sm text-[#5C3D1E] leading-relaxed italic">{phase.analogy}</p>
      </div>
      {!playbackMode && (
        <p className="text-sm text-[#3D2110] leading-relaxed mb-2">{phase.formal_explanation}</p>
      )}
      {/* Key insight */}
      <div className="flex gap-2 px-3 py-2 rounded-xl bg-[#FFFBEB] border border-[#FCD34D]/40">
        <span className="text-base shrink-0">💡</span>
        <p className="text-sm text-[#92400E] leading-relaxed">{phase.key_insight}</p>
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
  segmentsForPhase,
  currentSegmentId,
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
    <PhaseCard label="3 · Demonstrate" accent="#10B981">
      {playbackMode && segmentsForPhase && (
        <SegmentScript
          segments={segmentsForPhase}
          currentSegmentId={currentSegmentId ?? null}
          accent="#10B981"
        />
      )}
      {!playbackMode && (
        <p className="text-sm text-[#3D2110] mb-2">{phase.example_description}</p>
      )}

      {/* Code block */}
      {phase.code && (
        <pre className="mb-3 px-3 py-2.5 rounded-xl bg-[#1E1E2E] text-[#CDD6F4] text-xs leading-relaxed overflow-x-auto font-mono">
          {phase.code}
        </pre>
      )}

      {/* Step by step */}
      {phase.step_by_step.length > 0 && (
        <ol className="space-y-1.5 mb-2">
          {phase.step_by_step.map((step, i) => (
            <li key={i} className="flex gap-2 text-sm text-[#3D2110]">
              <span className="shrink-0 w-5 h-5 rounded-full bg-[#10B981]/15 text-[#10B981] text-[10px] font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      )}

      {/* Output */}
      {phase.output && (
        <div className="px-3 py-2 rounded-xl bg-[#F0FDF4] border border-[#86EFAC]/40">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#16A34A] mb-1">Output</p>
          <pre className="text-xs text-[#15803D] font-mono">{phase.output}</pre>
        </div>
      )}

      {/* Visual state badge (legacy mode only — adaptive shows the live image in-scene) */}
      {!playbackMode && shouldGenerateModel && (
        <div className="mt-2 flex items-center gap-1.5">
          {isGeneratingModel && !activePreviewImageUrl ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-[#F97B2F] animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F97B2F] animate-ping" />
              Generating image…
            </span>
          ) : isGeneratingModel && activePreviewImageUrl ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-[#F97B2F] animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F97B2F] animate-ping" />
              Building 3D model…
            </span>
          ) : activeModelUrl && viewMode3d ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-[#10B981] bg-[#F0FDF4] border border-[#10B981]/25 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
              3D model in scene
            </span>
          ) : activePreviewImageUrl && pending3dImageUrl && !activeModelUrl ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-[#F97B2F] bg-[#FFF5EC] border border-[#F97B2F]/25 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F97B2F]" />
              Image ready · tap “View in 3D” in the scene
            </span>
          ) : activePreviewImageUrl ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-[#10B981] bg-[#F0FDF4] border border-[#10B981]/25 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
              Image in scene
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
  phase, conceptName, playbackMode, segmentsForPhase, currentSegmentId,
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
      setFeedback(data.feedback ?? (data.is_correct ? "Great thinking! ✓" : "Not quite — here's what to consider:"));
      setShowAnswer(true);
      // Gesture feedback — store auto-reverts after 2s (nod) / 1.5s (shake)
      setGesture(data.is_correct ? "nodding" : "shaking");
    } catch {
      setShowAnswer(true);
    } finally {
      setEvaluating(false);
    }
  }, [answer, isEvaluating, phase, conceptName, setGesture]);

  return (
    <PhaseCard label="4 · Challenge" accent="#F59E0B">
      {playbackMode && segmentsForPhase && (
        <SegmentScript
          segments={segmentsForPhase}
          currentSegmentId={currentSegmentId ?? null}
          accent="#F59E0B"
        />
      )}
      <p className="text-sm font-medium text-[#3D2110] leading-relaxed mb-3">{phase.question}</p>

      {!showAnswer && (
        <>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer…"
            rows={3}
            className="w-full px-3 py-2 rounded-xl bg-white border border-white/60 text-sm text-[#3D2110] placeholder:text-[#B8957A] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30 resize-none mb-2"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleSubmit}
              disabled={!answer.trim() || isEvaluating}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#F59E0B] text-white hover:bg-[#D97706] disabled:opacity-40 transition-all"
            >
              {isEvaluating ? "Evaluating…" : "Submit answer"}
            </button>
            <button
              onClick={() => setShowHint(true)}
              className="text-xs text-[#8B6E5A] hover:text-[#3D2110] underline underline-offset-2"
            >
              Show hint
            </button>
            <button
              onClick={() => setShowAnswer(true)}
              className="text-xs text-[#8B6E5A] hover:text-[#3D2110] underline underline-offset-2"
            >
              {"I don't know"}
            </button>
          </div>

          {showHint && (
            <div className="mt-3 px-3 py-2 rounded-xl bg-[#FFFBEB] border border-[#FCD34D]/40 text-sm text-[#92400E] animate-[fade-in_0.3s_ease-out]">
              <span className="font-semibold">Hint: </span>{phase.hint}
            </div>
          )}
        </>
      )}

      {showAnswer && (
        <div className="space-y-2 animate-[fade-in_0.3s_ease-out]">
          {feedback && (
            <p className="text-sm font-medium text-[#F59E0B]">{feedback}</p>
          )}
          <div className="px-3 py-2.5 rounded-xl bg-[#FFFBEB] border border-[#FCD34D]/40">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#B45309] mb-1">Full answer</p>
            <p className="text-sm text-[#92400E] leading-relaxed">{phase.answer}</p>
          </div>
        </div>
      )}
    </PhaseCard>
  );
}

// ─── Phase 5: Connect ─────────────────────────────────────────────────────────

function ConnectCard({
  phase, playbackMode, segmentsForPhase, currentSegmentId,
}: Omit<PhaseCardCommon, "conceptName"> & { phase: LessonPayload["phases"]["connect"] }) {
  return (
    <PhaseCard label="5 · Connect" accent="#3B82F6">
      {playbackMode && segmentsForPhase && (
        <SegmentScript
          segments={segmentsForPhase}
          currentSegmentId={currentSegmentId ?? null}
          accent="#3B82F6"
        />
      )}
      {!playbackMode && (
        <p className="text-sm text-[#3D2110] leading-relaxed">{phase.content}</p>
      )}
      {phase.next_concept && (
        <div className="mt-2 flex items-center gap-2 text-xs text-[#3B82F6] font-semibold">
          <span>→ Up next:</span>
          <span className="px-2 py-0.5 rounded-full bg-[#3B82F6]/10 border border-[#3B82F6]/20">
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

      <div className="aristo-scroll flex flex-col gap-3 px-4 py-4 overflow-y-auto h-full">

        {/* Lesson header */}
        <div className="flex items-center gap-2">
          <span className="text-[#F97B2F] font-bold">✦</span>
          <h2 className="text-sm font-bold text-[#3D2110] truncate">{lesson.concept_name}</h2>
          <span className="ml-auto text-[10px] text-[#8B6E5A] tabular-nums shrink-0">
            {phaseIdx + 1} / {PHASES.length}
          </span>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5">
          {PHASES.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i <= phaseIdx ? "bg-[#F97B2F]" : "bg-white/40"
              }`}
            />
          ))}
        </div>

        {/* Active phase card */}
        {phase === "activate" && (
          <ActivateCard
            phase={lesson.phases.activate}
            conceptName={lesson.concept_name}
            playbackMode={playbackMode}
            segmentsForPhase={segmentsByPhase.activate}
            currentSegmentId={currentSegmentId}
          />
        )}
        {phase === "explain" && (
          <ExplainCard
            phase={lesson.phases.explain}
            conceptName={lesson.concept_name}
            playbackMode={playbackMode}
            segmentsForPhase={segmentsByPhase.explain}
            currentSegmentId={currentSegmentId}
          />
        )}
        {phase === "demonstrate" && (
          <DemonstrateCard
            key={lesson.concept_id}
            phase={lesson.phases.demonstrate}
            conceptName={lesson.concept_name}
            shouldGenerateModel={lesson.metadata.should_generate_model}
            playbackMode={playbackMode}
            segmentsForPhase={segmentsByPhase.demonstrate}
            currentSegmentId={currentSegmentId}
          />
        )}
        {phase === "challenge" && (
          <ChallengeCard
            phase={lesson.phases.challenge}
            conceptName={lesson.concept_name}
            playbackMode={playbackMode}
            segmentsForPhase={segmentsByPhase.challenge}
            currentSegmentId={currentSegmentId}
          />
        )}
        {phase === "connect" && (
          <ConnectCard
            phase={lesson.phases.connect}
            playbackMode={playbackMode}
            segmentsForPhase={segmentsByPhase.connect}
            currentSegmentId={currentSegmentId}
          />
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-1">
          <button
            onClick={goPrev}
            disabled={isFirst}
            className="text-xs text-[#8B6E5A] hover:text-[#3D2110] disabled:opacity-30 font-medium px-2 py-1"
          >
            ← Back
          </button>
          {!isLast && (
            <button
              onClick={goNext}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#F97B2F] text-white hover:bg-[#E06A20] shadow-sm transition-all"
            >
              Next →
            </button>
          )}
          {isLast && (
            <span className="text-xs text-[#10B981] font-semibold">Lesson complete ✓</span>
          )}
        </div>
      </div>
    </>
  );
}
