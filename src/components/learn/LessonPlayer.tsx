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
import { useAristoStore, type LessonPayload } from "@/store/useAristoStore";
import { useLessonPlayback } from "@/hooks/useLessonPlayback";
import { LessonView } from "./LessonView";
import { AnswerInputPanel } from "./AnswerInputPanel";

// ─── Adaptive feature flag — single source of truth ──────────────────────────

export const ADAPTIVE_VISUALS_ENABLED =
  process.env.NEXT_PUBLIC_ADAPTIVE_VISUALS === "true";

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
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/80 backdrop-blur-sm border border-white/60 shadow-sm">
      <button
        onClick={onPrev}
        disabled={segmentIdx <= 0}
        className="text-xs px-2 py-1 rounded-lg text-[#8B6E5A] hover:text-[#3D2110] hover:bg-[#FFF5EC] disabled:opacity-30 font-medium transition-all"
        aria-label="Previous segment"
      >
        ⏮ Prev
      </button>
      {isPaused ? (
        <button
          onClick={onResume}
          className="text-xs px-3 py-1 rounded-lg bg-[#F97B2F] text-white font-semibold hover:bg-[#E06A20] transition-all"
        >
          ▶ Resume
        </button>
      ) : (
        <button
          onClick={onPause}
          className="text-xs px-3 py-1 rounded-lg bg-[#FFF5EC] text-[#C45A10] border border-[#F97B2F]/30 font-semibold hover:bg-[#FDE3CE] transition-all"
        >
          ⏸ Pause
        </button>
      )}
      <button
        onClick={onSkip}
        className="text-xs px-2 py-1 rounded-lg text-[#8B6E5A] hover:text-[#3D2110] hover:bg-[#FFF5EC] font-medium transition-all"
        aria-label="Skip segment"
      >
        Next ⏭
      </button>
      <span className="ml-auto text-[10px] tabular-nums text-[#8B6E5A]">
        seg {Math.min(segmentIdx + 1, segmentCount)} / {segmentCount}
      </span>
    </div>
  );
}

// ─── Visuals loading overlay ──────────────────────────────────────────────────

function PreparingVisualsOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#FDF0E4]/85 backdrop-blur-sm animate-[fade-in_0.3s_ease-out]">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-2 border-[#F97B2F]/25" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#F97B2F] animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-[#C45A10]">Preparing your visuals…</p>
        <p className="text-xs text-[#8B6E5A] mt-0.5">Aristo is sketching the diagrams for this lesson.</p>
      </div>
    </div>
  );
}

// ─── Player ───────────────────────────────────────────────────────────────────

export function LessonPlayer({ demoMode = false }: { demoMode?: boolean } = {}) {
  const activeLesson = useAristoStore((s) => s.activeLesson);
  const currentSegmentId = useAristoStore((s) => s.currentSegmentId);

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

  return (
    <div className="relative h-full">
      {playback.isLoading && <PreparingVisualsOverlay />}

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
