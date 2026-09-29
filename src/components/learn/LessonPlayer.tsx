"use client";

/**
 * LessonPlayer — wraps LessonView with the adaptive-visual playback engine.
 *
 * Owns the {@link useLessonPlayback} state machine for the active lesson,
 * forwards `currentSegmentId` and `controlledPhase` to LessonView so the
 * displayed phase + highlighted segment track the avatar's narration, and
 * routes phase-nav buttons through `jumpToPhase`.
 *
 * Also renders:
 *  • A "Preparing visuals…" overlay while the segment-visuals batch runs.
 *  • A small playback controls row (pause / resume / skip segment) at the
 *    bottom of the lesson scroll.
 *  • A lesson-complete celebration when the engine reports `isComplete`.
 *
 * The plain `LessonView` component is still used for legacy
 * (NEXT_PUBLIC_ADAPTIVE_VISUALS=false) lessons; LessonPlayer is opt-in via
 * the parent component (MessagePanel).
 */

import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useAristoStore, type LessonPayload } from "@/store/useAristoStore";
import { useLessonPlayback } from "@/hooks/useLessonPlayback";
import { Button } from "@/components/ui/button";
import { SHAPE } from "@/lib/design/shape";
import { cn } from "@/lib/utils";
import { LessonView, PHASE_META } from "./LessonView";
import { AnswerInputPanel } from "./AnswerInputPanel";

// ─── Adaptive feature flag — single source of truth ──────────────────────────

export const ADAPTIVE_VISUALS_ENABLED =
  process.env.NEXT_PUBLIC_ADAPTIVE_VISUALS === "true";

// Debug labels (the "seg N / M" counter) show on `yarn dev` only.
const SHOW_DEBUG = process.env.NODE_ENV === "development";

// ─── Caption band ─────────────────────────────────────────────────────────────
//
// V8.0 direction A: the sentence being spoken, large, in ink glass over the
// lower edge of the scene; the next one dimmed beneath it. Portalled to <body>
// because the panel's backdrop-blur would otherwise contain a fixed child.
//
// Geometry (checked against the /dev probes, V8.4a): it keeps to the left of
// the 400px panel (right-5 + 20px gap) and its top edge stays at or below 78%
// of the viewport height, under the image and model toolbars, whose lowest
// edge is 75.8% at any size (the projection scales with height). md and up
// only: below md the panel covers the screen and LessonView shows the caption.
// `.theme-ink` keeps it ink in both themes; the room never follows the theme.

function CaptionBand({
  phase,
  current,
  next,
}: {
  phase:   keyof LessonPayload["phases"];
  current: string;
  next:    string | null;
}) {
  const { n, name, icon: Icon } = PHASE_META[phase];
  return createPortal(
    <div
      data-caption-band
      className={cn(
        SHAPE.surface,
        "theme-ink pointer-events-none fixed bottom-4 left-5 right-[440px] z-10 hidden max-h-[calc(22vh-16px)] items-start gap-4 overflow-hidden",
        "border border-line bg-bg/[0.86] px-5 py-3 shadow-e2 backdrop-blur-md md:flex",
      )}
    >
      <div className="flex shrink-0 flex-col items-center gap-1 pt-0.5 text-accent-text">
        <Icon aria-hidden className="size-5" />
        <span className="text-xs font-semibold tabular-nums">
          <span className="sr-only">{name}, step </span>
          {n}
          <span aria-hidden>/5</span>
          <span className="sr-only"> of 5</span>
        </span>
      </div>
      <div className="min-w-0">
        <p key={current} className="line-clamp-3 text-lg font-medium leading-snug text-ink motion-safe:animate-[fade-in_0.3s_ease-out]">
          {current}
        </p>
        {next && (
          <p className="mt-1 line-clamp-1 text-sm text-body">{next}</p>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ─── Playback controls row ────────────────────────────────────────────────────

function PlaybackControls({
  isPaused, onPause, onResume, onSkip, onPrev, segmentIdx, segmentCount,
}: {
  isPaused:     boolean;
  onPause:      () => void;
  onResume:     () => void;
  onSkip:       () => void;
  onPrev:       () => void;
  segmentIdx:   number;
  segmentCount: number;
}) {
  return (
    <div className={cn(SHAPE.surface, "flex items-center gap-1 border border-line bg-surface/95 p-1.5 shadow-e1 backdrop-blur-md")}>
      <Button
        variant="ghost"
        size="icon"
        onClick={onPrev}
        disabled={segmentIdx <= 0}
        className="text-body"
        aria-label="Previous sentence"
        title="Previous sentence"
      >
        <SkipBack aria-hidden />
      </Button>
      {isPaused ? (
        <Button onClick={onResume} className="px-4">
          <Play aria-hidden />
          Resume
        </Button>
      ) : (
        <Button variant="secondary" onClick={onPause} className="px-4">
          <Pause aria-hidden />
          Pause
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={onSkip}
        className="text-body"
        aria-label="Next sentence"
        title="Next sentence"
      >
        <SkipForward aria-hidden />
      </Button>
      {SHOW_DEBUG && (
        <span className="ml-auto pr-2 font-mono text-[10px] tabular-nums text-muted">
          seg {Math.min(segmentIdx + 1, segmentCount)} / {segmentCount}
        </span>
      )}
    </div>
  );
}

// ─── Visuals loading overlay ──────────────────────────────────────────────────

function PreparingVisualsOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-bg/95 backdrop-blur-sm motion-safe:animate-[fade-in_0.3s_ease-out]">
      <div className="relative size-12">
        <div className="absolute inset-0 rounded-full border-2 border-accent/25" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent motion-safe:animate-spin" />
      </div>
      <div className="px-6 text-center" role="status">
        <p className="text-sm font-semibold text-ink">Preparing the diagrams…</p>
        <p className="mt-0.5 text-xs text-muted">Your teacher is drawing the diagrams for this lesson.</p>
      </div>
    </div>
  );
}

// ─── Player ───────────────────────────────────────────────────────────────────

export function LessonPlayer({ demoMode = false }: { demoMode?: boolean } = {}) {
  const activeLesson = useAristoStore((s) => s.activeLesson);
  const currentSegmentId = useAristoStore((s) => s.currentSegmentId);
  // Read only, to hide the caption band while the quiz is on the desk.
  const activeQuiz = useAristoStore((s) => s.activeQuiz);

  const playback = useLessonPlayback(activeLesson, { demoMode });

  // Telemetry — once per concept, record that the adaptive pipeline was used.
  useEffect(() => {
    if (!activeLesson?.concept_id) return;
    if (typeof window === "undefined") return;
    // Lightweight, no auth needed; non-blocking. Skipped on dev.
    if (process.env.NODE_ENV !== "production") return;
    // Reserved for a future /api/learn/telemetry endpoint.
  }, [activeLesson?.concept_id]);

  // Derive the displayed phase from the active segment.
  const controlledPhase = useMemo<keyof LessonPayload["phases"] | undefined>(() => {
    if (!playback.segments.length) return undefined;
    const idx = Math.min(playback.segmentIdx, playback.segments.length - 1);
    const seg = playback.segments[Math.max(0, idx)];
    return seg?.phase;
  }, [playback.segmentIdx, playback.segments]);

  // The sentence being spoken and the next one, for the caption band.
  const captionSeg = playback.segments[playback.segmentIdx];
  const captionNext = playback.segments[playback.segmentIdx + 1];
  const showCaption =
    !!captionSeg && !playback.isComplete && !playback.isLoading && !activeQuiz;

  return (
    <div className="relative h-full">
      {playback.isLoading && <PreparingVisualsOverlay />}

      {showCaption && (
        <CaptionBand
          phase={captionSeg.phase}
          current={captionSeg.text}
          next={captionNext?.text ?? null}
        />
      )}

      <LessonView
        playbackMode
        currentSegmentId={currentSegmentId}
        controlledPhase={controlledPhase}
        onJumpToPhase={playback.jumpToPhase}
      />

      {/* Challenge gate — full-width answer panel pinned to the bottom of the
          lesson scroll, replacing the playback controls while the avatar is
          waiting on a response.  Mounted only when awaitingAnswer flips true
          so the textarea auto-focus / mic auto-open fire on a fresh instance. */}
      {playback.awaitingAnswer && playback.pendingChallengeSegment ? (
        <div className="absolute left-0 right-0 bottom-0">
          <AnswerInputPanel
            segment={playback.pendingChallengeSegment}
            onSubmit={playback.submitAnswer}
            onSkip={playback.next}
          />
        </div>
      ) : (
        // Floating controls — anchored above the input box
        playback.segments.length > 0 && !playback.isComplete && (
          <div className="absolute left-4 right-4 bottom-3 pointer-events-none">
            <div className="pointer-events-auto">
              <PlaybackControls
                isPaused={playback.isPaused}
                onPause={playback.pause}
                onResume={playback.resume}
                onSkip={playback.next}
                onPrev={playback.prev}
                segmentIdx={playback.segmentIdx}
                segmentCount={playback.segments.length}
              />
            </div>
          </div>
        )
      )}
    </div>
  );
}
