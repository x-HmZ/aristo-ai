"use client";

/**
 * useLessonPlayback — adaptive-visual lesson playback state machine.
 *
 * Drives sequential narration of a `LessonPayload.segments` array:
 *
 *   1. On lesson load, fires `/api/learn/segment-visuals` for every segment
 *      that has a `visual` field, in a single parallel batch.
 *   2. Once visuals are ready (or for lessons with no visuals at all), starts
 *      playback at segment 0.
 *   3. Per-segment effect: resolves the active image (this segment's visual,
 *      or the previous segment's persisted visual, or blank), sets the
 *      avatar gesture, marks the current segment id (for UI highlighting),
 *      and asks `useTTS().speak()` to narrate.  On `onEnd` it auto-advances
 *      after the segment's `pause_after` dwell.
 *   4. Prefetches the next segment's TTS audio while the current segment
 *      narrates, hiding the ~0.5–1.5s ElevenLabs gap between segments.
 *   5. When `segmentIdx` overflows `segments.length`, fires `/api/learn/complete`
 *      and clears the active segment id / gesture.
 *
 * Public surface (state + controls) — see {@link LessonPlaybackState} and
 * {@link LessonPlaybackControls}.  Mounted by `LessonPlayer.tsx`.
 *
 * Compatibility shim: when `lesson.segments` is missing (legacy lesson or
 * adaptive-flag-off), the hook synthesizes a thin segment list from the
 * old phase blocks — one segment per phase, no visuals.  This keeps anyone
 * with a cached old-shape lesson from breaking.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAristoStore, type LessonPayload } from "@/store/useAristoStore";
import { useTTS, type SpeakController } from "@/hooks/useTTS";
import type { LessonPhase, NarrationSegment } from "@/lib/agents/teaching";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface VisualResult {
  imageUrl?: string;
  error?:    string;
  cached?:   boolean;
}

export interface LessonPlaybackState {
  segmentIdx:     number;
  isPaused:       boolean;
  isLoading:      boolean;
  isComplete:     boolean;
  awaitingAnswer: boolean;
  /** The challenge segment we're waiting on, if any (drives AnswerInputPanel). */
  pendingChallengeSegment: NarrationSegment | null;
  visualsByID:    Record<string, VisualResult>;
  segments:       NarrationSegment[];
}

export interface LessonPlaybackControls {
  start:        () => void;
  pause:        () => void;
  resume:       () => void;
  next:         () => void;
  prev:         () => void;
  jumpToPhase:  (phase: LessonPhase) => void;
  /** Called from AnswerInputPanel — releases the challenge gate and advances. */
  submitAnswer: (answer: string) => Promise<void>;
}

// ─── Compatibility shim ───────────────────────────────────────────────────────

/**
 * Synthesise a minimal segment list from old phase blocks when the lesson
 * has no `segments` array (legacy lesson or adaptive flag off).  Visuals
 * are omitted — the old DemonstrateCard image effect handles topic visuals
 * separately for these lessons.
 */
function synthesiseSegments(lesson: LessonPayload): NarrationSegment[] {
  const p   = lesson.phases;
  const out: NarrationSegment[] = [];
  let n = 1;
  const push = (
    phase: LessonPhase,
    role: NarrationSegment["role"],
    text: string,
  ): void => {
    const trimmed = text?.trim();
    if (!trimmed) return;
    out.push({
      id:    `legacy_${String(n++).padStart(3, "0")}`,
      phase, role, text: trimmed,
    });
  };

  push("activate",    "hook",             p.activate?.content ?? "");
  push("explain",     "narrate",          p.explain?.analogy ?? "");
  push("explain",     "narrate",          p.explain?.formal_explanation ?? "");
  push("explain",     "narrate",          p.explain?.key_insight ?? "");
  push("demonstrate", "narrate",          p.demonstrate?.narration_pre_visual ?? p.demonstrate?.example_description ?? "");
  if (p.demonstrate?.visual_walkthrough) {
    push("demonstrate", "demo_step",      p.demonstrate.visual_walkthrough);
  }
  push("challenge",   "challenge_setup",  p.challenge?.question ?? "");
  push("connect",     "narrate",          p.connect?.content ?? "");
  return out;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSegmentVisualUrl(
  seg: NarrationSegment | undefined,
  visualsByID: Record<string, VisualResult>,
): string | undefined {
  if (!seg?.visual) return undefined;
  return visualsByID[seg.id]?.imageUrl;
}

function lastVisibleImage(
  segments: NarrationSegment[],
  idx: number,
  visualsByID: Record<string, VisualResult>,
): string | null {
  // Always keep the most recent successful image on screen until a new one
  // arrives.  The student should never see the diagram disappear mid-lesson
  // while the avatar is still pointing at it — sub-section changes that
  // happen to lack their own visual just inherit the previous one.
  //
  // (The segment's visual.persists_to_next hint is kept in the type for
  // callout / styling purposes but no longer gates persistence.)
  let i = idx - 1;
  while (i >= 0) {
    const prev = segments[i];
    const url = prev ? visualsByID[prev.id]?.imageUrl : undefined;
    if (url) return url;
    i--;
  }
  return null;
}

// Challenge gating — true for segments that pose a question and should pause
// playback until the student responds.  We treat both the role hint and the
// phase as signals so a hand-shaped legacy lesson still gates correctly.
function isChallengeSegment(seg: NarrationSegment | undefined): boolean {
  if (!seg) return false;
  if (seg.role === "challenge_setup") return true;
  // Only the first challenge-phase segment gates (subsequent ones reveal/explain
  // the answer, which the avatar narrates after the student replies).
  return seg.phase === "challenge" && seg.role !== "challenge_reveal";
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLessonPlayback(
  lesson: LessonPayload | null,
): LessonPlaybackState & LessonPlaybackControls {
  const { speak, stop, prefetch }     = useTTS();
  const setIsSpeaking                 = useAristoStore((s) => s.setIsSpeaking);
  const setGesture                    = useAristoStore((s) => s.setGesture);
  const setActivePreviewImageUrl      = useAristoStore((s) => s.setActivePreviewImageUrl);
  const setCurrentSegmentId           = useAristoStore((s) => s.setCurrentSegmentId);
  const setAwaitingAnswer             = useAristoStore((s) => s.setAwaitingAnswer);
  const setActiveModelUrl             = useAristoStore((s) => s.setActiveModelUrl);
  const setPending3dImageUrl          = useAristoStore((s) => s.setPending3dImageUrl);
  const setViewMode3d                 = useAristoStore((s) => s.setViewMode3d);
  const setIsGeneratingModel          = useAristoStore((s) => s.setIsGeneratingModel);

  const [segmentIdx,    setSegmentIdx]    = useState(0);
  const [isPaused,      setIsPaused]      = useState(false);
  const [isLoading,     setIsLoading]     = useState(false);
  const [isComplete,    setIsComplete]    = useState(false);
  const [awaitingAnswer, setAwaitingLocal] = useState(false);
  const [visualsByID,   setVisualsByID]   = useState<Record<string, VisualResult>>({});

  // Mirror the awaitingAnswer flag to the store so the 3D speech-bubble can
  // read it without prop-drilling through Canvas → Experience.
  useEffect(() => {
    setAwaitingAnswer(awaitingAnswer);
  }, [awaitingAnswer, setAwaitingAnswer]);

  // Resolved segment list — real or shimmed.
  const segments: NarrationSegment[] = useMemo(() => {
    if (!lesson) return [];
    if (lesson.segments && lesson.segments.length > 0) return lesson.segments;
    return synthesiseSegments(lesson);
  }, [lesson]);

  // Per-segment runtime refs — survive across renders but never trigger one.
  const ttsControllerRef = useRef<SpeakController | null>(null);
  const advanceTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lessonIdRef      = useRef<string | null>(null);

  // Cleanup helper (used by pause / unmount / lesson swap).
  const cleanupPlayback = useCallback(() => {
    if (ttsControllerRef.current) {
      ttsControllerRef.current.stop();
      ttsControllerRef.current = null;
    }
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  // ─── Reset on lesson swap ───────────────────────────────────────────────────
  useEffect(() => {
    if (!lesson) return;
    if (lessonIdRef.current === lesson.concept_id) return;
    lessonIdRef.current = lesson.concept_id;

    cleanupPlayback();
    setSegmentIdx(0);
    setIsPaused(false);
    setIsComplete(false);
    setAwaitingLocal(false);
    setVisualsByID({});
    setActivePreviewImageUrl(null);
    setCurrentSegmentId(null);
    setGesture("idle");
    setActiveModelUrl(null);
    setPending3dImageUrl(null);
    setViewMode3d(false);
  }, [
    lesson, cleanupPlayback,
    setActivePreviewImageUrl, setCurrentSegmentId, setGesture,
    setActiveModelUrl, setPending3dImageUrl, setViewMode3d,
  ]);

  // ─── Restore topic-level 3D pipeline in adaptive mode ──────────────────────
  // Legacy LessonView fires generate-model on lesson mount.  In adaptive mode
  // the legacy code path is gated off, so without this effect the "View in 3D"
  // button would never appear for tangible topics.  Fire-and-forget; parallel
  // to the segment-visuals batch.
  useEffect(() => {
    if (!lesson) return;
    const { should_generate_model, model_image_prompt, model_3d_prompt } = lesson.metadata;
    if (!should_generate_model || !model_image_prompt) return;

    let cancelled = false;
    setIsGeneratingModel(true);
    fetch("/api/generate-model", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        imagePrompt:   model_image_prompt,
        model3dPrompt: model_3d_prompt,
        topic:         lesson.concept_name,
      }),
    })
      .then((r) => r.json())
      .then(({ imageUrl, model3dImageUrl }) => {
        if (cancelled) return;
        if (!imageUrl) return;
        // We don't override activePreviewImageUrl here — that belongs to the
        // per-segment image flow.  We only stash the 3D source so the
        // "View in 3D" button can appear on the in-scene toolbar.
        setPending3dImageUrl(model3dImageUrl ?? imageUrl);
      })
      .catch(() => {/* non-critical — image-less topics still work */})
      .finally(() => { if (!cancelled) setIsGeneratingModel(false); });

    return () => { cancelled = true; };
  }, [lesson, setIsGeneratingModel, setPending3dImageUrl]);

  // ─── Batch-fetch visuals on lesson load ─────────────────────────────────────
  useEffect(() => {
    if (!lesson || segments.length === 0) return;

    // Only true segments (not legacy shim) need network visuals.  The shim's
    // segments have no .visual fields by construction.
    const withVisuals = segments
      .filter((s) => !!s.visual?.prompt)
      .slice(0, 8); // hard cap matches route-side guard

    if (withVisuals.length === 0) {
      setVisualsByID({});
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    fetch("/api/learn/segment-visuals", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        segments: withVisuals.map((s) => ({
          id:     s.id,
          prompt: s.visual!.prompt,
          style:  s.visual!.style,
        })),
      }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`segment-visuals ${r.status}`);
        return r.json();
      })
      .then((data: { results: Array<{ id: string; imageUrl?: string; error?: string; cached?: boolean }> }) => {
        if (cancelled) return;
        const map: Record<string, VisualResult> = {};
        for (const row of data.results ?? []) {
          map[row.id] = { imageUrl: row.imageUrl, error: row.error, cached: row.cached };
        }
        setVisualsByID(map);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[useLessonPlayback] visuals fetch failed", err);
        setVisualsByID({}); // graceful degradation — no visuals, playback still proceeds
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [lesson, segments]);

  // ─── Force-idle while preparing visuals ────────────────────────────────────
  // Without this, the avatar inherits a stale gesture from a prior segment
  // (or the default talking-pool cycle) and visibly "teaches" before any
  // narration has begun.  Keeping it idle until the first segment fires
  // makes the preparing-visuals overlay feel intentional.
  useEffect(() => {
    if (isLoading) {
      setIsSpeaking(false);
      setGesture("idle");
    }
  }, [isLoading, setIsSpeaking, setGesture]);

  // ─── Per-segment playback effect ───────────────────────────────────────────
  useEffect(() => {
    if (!lesson || segments.length === 0)         return;
    if (isLoading)                                return; // wait for visuals batch
    if (isPaused)                                 return;
    if (awaitingAnswer)                           return; // waiting for student
    if (segmentIdx < 0)                           return;

    // Lesson complete — fire telemetry once, then bail.
    if (segmentIdx >= segments.length) {
      if (!isComplete) {
        setIsComplete(true);
        setCurrentSegmentId(null);
        setGesture("idle");
        setActivePreviewImageUrl(null);
        // Mark concept viewed.  Non-critical — swallow errors.
        fetch("/api/learn/complete", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ conceptId: lesson.concept_id }),
        }).catch(() => {});
      }
      return;
    }

    const segment = segments[segmentIdx];
    if (!segment) return;

    // 1) Resolve active visual.  Sticky semantics: keep the most recent image
    //    visible until this segment supplies its own, so the avatar never
    //    ends up pointing at empty air mid-section.
    const ownVisualUrl = getSegmentVisualUrl(segment, visualsByID);
    if (ownVisualUrl) {
      setActivePreviewImageUrl(ownVisualUrl);
    } else {
      const sticky = lastVisibleImage(segments, segmentIdx, visualsByID);
      // Only clear the panel when nothing has ever been shown — otherwise hold.
      setActivePreviewImageUrl(sticky); // null only when no visual yet in the lesson
    }

    // 2) Resolve gesture.
    // Segment gesture vocabulary is a superset of AvatarGesture — "thinking"
    // is allowed on a segment (the LLM may emit it for a contemplative moment)
    // but the avatar's thinking pose is reserved for `isLoading`, so we map
    // it back to "idle" here and let the talking-pool resolution take over.
    const rawGesture = segment.gesture
      ?? (segment.visual && ownVisualUrl ? "pointing" : "idle");
    const resolvedGesture = rawGesture === "thinking" ? "idle" : rawGesture;
    setGesture(resolvedGesture);

    // 3) Mark active segment for UI highlight
    setCurrentSegmentId(segment.id);

    // 4) Warm-up the next segment's TTS while this one narrates
    const upcoming = segments[segmentIdx + 1];
    if (upcoming?.text) prefetch(upcoming.text);

    // 5) Narrate.  Challenge segments pose a question — when narration ends
    //    we set awaitingAnswer instead of advancing, freezing playback until
    //    the student replies (via submitAnswer).
    const isQuestion = isChallengeSegment(segment);
    setIsSpeaking(true);
    const controller = speak(segment.text, {
      onEnd: () => {
        ttsControllerRef.current = null;
        if (isQuestion) {
          setIsSpeaking(false);
          setGesture("idle");
          setAwaitingLocal(true);   // ← AnswerInputPanel + 3D bubble appear
          return;
        }
        const dwellMs = Math.max(0, (segment.pause_after ?? 0) * 1000);
        advanceTimerRef.current = setTimeout(() => {
          advanceTimerRef.current = null;
          setSegmentIdx((i) => i + 1);
        }, dwellMs);
      },
    });
    ttsControllerRef.current = controller;

    return () => {
      cleanupPlayback();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segmentIdx, isPaused, isLoading, awaitingAnswer, segments, visualsByID]);

  // ─── Unmount cleanup ───────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cleanupPlayback();
      setIsSpeaking(false);
      setGesture("idle");
      setCurrentSegmentId(null);
      setAwaitingAnswer(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Controls ──────────────────────────────────────────────────────────────

  const start = useCallback(() => {
    cleanupPlayback();
    setIsComplete(false);
    setIsPaused(false);
    setAwaitingLocal(false);
    setSegmentIdx(0);
  }, [cleanupPlayback]);

  const pause = useCallback(() => {
    cleanupPlayback();
    setIsSpeaking(false);
    setGesture("idle");
    setIsPaused(true);
  }, [cleanupPlayback, setIsSpeaking, setGesture]);

  const resume = useCallback(() => {
    setIsPaused(false);
  }, []);

  const next = useCallback(() => {
    cleanupPlayback();
    setAwaitingLocal(false); // skip past a pending challenge
    setSegmentIdx((i) => Math.min(segments.length, i + 1));
  }, [cleanupPlayback, segments.length]);

  const prev = useCallback(() => {
    cleanupPlayback();
    setIsComplete(false);
    setAwaitingLocal(false);
    setSegmentIdx((i) => Math.max(0, i - 1));
  }, [cleanupPlayback]);

  // Challenge gate — called from AnswerInputPanel when the student submits.
  // We fire-and-forget /api/learn/challenge for misconception telemetry, set
  // a quick nod/shake gesture on the avatar, then release the gate so the
  // next segment (usually a challenge_reveal explaining the answer) plays.
  const submitAnswer = useCallback(async (answer: string): Promise<void> => {
    const trimmed = answer.trim();
    if (!trimmed || !lesson) {
      setAwaitingLocal(false);
      setSegmentIdx((i) => i + 1);
      return;
    }
    const challengePhase = lesson.phases?.challenge;
    try {
      if (challengePhase?.question && challengePhase.answer) {
        const res = await fetch("/api/learn/challenge", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            question:      challengePhase.question,
            correctAnswer: challengePhase.answer,
            userAnswer:    trimmed,
            conceptName:   lesson.concept_name,
          }),
        });
        const data = await res.json().catch(() => ({}));
        setGesture(data.is_correct ? "nodding" : "shaking");
      }
    } catch {
      /* non-critical — feedback is best-effort, never blocks playback */
    } finally {
      setAwaitingLocal(false);
      setSegmentIdx((i) => i + 1);
    }
  }, [lesson, setGesture]);

  // Compute the pending challenge segment for consumers (AnswerInputPanel).
  const pendingChallengeSegment = useMemo<NarrationSegment | null>(() => {
    if (!awaitingAnswer) return null;
    const seg = segments[segmentIdx];
    return seg ?? null;
  }, [awaitingAnswer, segments, segmentIdx]);

  const jumpToPhase = useCallback(
    (phase: LessonPhase) => {
      if (!lesson) return;
      const ids = lesson.phases?.[phase]?.segment_ids;
      let target = -1;
      if (ids && ids.length > 0) {
        target = segments.findIndex((s) => s.id === ids[0]);
      }
      if (target < 0) {
        // No segment_ids (legacy shim or missing) — find first segment in phase.
        target = segments.findIndex((s) => s.phase === phase);
      }
      if (target < 0) return;
      cleanupPlayback();
      setIsComplete(false);
      setIsPaused(false);
      setSegmentIdx(target);
    },
    [lesson, segments, cleanupPlayback],
  );

  // Stop TTS too if the host page unmounts / lesson is cleared.
  useEffect(() => {
    if (!lesson) {
      cleanupPlayback();
      setIsSpeaking(false);
      stop();
    }
  }, [lesson, cleanupPlayback, setIsSpeaking, stop]);

  return {
    segmentIdx,
    isPaused,
    isLoading,
    isComplete,
    awaitingAnswer,
    pendingChallengeSegment,
    visualsByID,
    segments,
    start,
    pause,
    resume,
    next,
    prev,
    jumpToPhase,
    submitAnswer,
  };
}
