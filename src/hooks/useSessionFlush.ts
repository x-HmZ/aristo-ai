/**
 * useSessionFlush — Phase 7 Behavioral Profiling
 *
 * Manages the session signal lifecycle:
 *  - Tracks session start time on mount
 *  - Tracks which concepts were viewed (call addConceptViewed when a lesson loads)
 *  - Exposes flushSession() for explicit flushes (sign-out, quiz-complete)
 *  - Registers a beforeunload listener for best-effort flush on tab close
 *    (uses fetch keepalive so it survives navigation)
 *
 * Callers: LearnClient.tsx
 */

"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAristoStore }                 from "@/store/useAristoStore";

export function useSessionFlush() {
  const signals     = useAristoStore((s) => s.behavioralSignals);
  const resetSignals = useAristoStore((s) => s.resetSignals);

  // Use refs so callbacks always have fresh values without re-registering listeners
  const signalsRef        = useRef(signals);
  const sessionStartRef   = useRef(new Date().toISOString());
  const conceptsViewedRef = useRef<string[]>([]);
  const flushedRef        = useRef(false);   // prevent double-flush per session

  // Keep signalsRef in sync
  useEffect(() => {
    signalsRef.current = signals;
  }, [signals]);

  // ── Core flush function ───────────────────────────────────────────────────
  const flushSession = useCallback(
    async (keepAlive = false) => {
      if (flushedRef.current) return;

      const s = signalsRef.current;

      // Skip if the session had no real activity
      const hasActivity =
        s.questions_attempted > 0 ||
        s.clicked_explain_more > 0 ||
        s.clicked_show_example > 0 ||
        s.time_on_explanations_seconds > 5;

      if (!hasActivity) return;

      flushedRef.current = true;

      const payload = JSON.stringify({
        signals:        s,
        sessionStart:   sessionStartRef.current,
        conceptsViewed: conceptsViewedRef.current,
      });

      try {
        await fetch("/api/profile/session", {
          method:    "POST",
          headers:   { "Content-Type": "application/json" },
          body:      payload,
          keepalive: keepAlive,
        });
      } catch {
        // Non-critical — profile update can wait for next session
      } finally {
        resetSignals();
        // Reset for the next sub-session (e.g. after quiz → back to lesson)
        flushedRef.current    = false;
        sessionStartRef.current = new Date().toISOString();
        conceptsViewedRef.current = [];
      }
    },
    [resetSignals]
  );

  // ── beforeunload — best-effort flush on tab close / navigation ────────────
  useEffect(() => {
    const onUnload = () => flushSession(true);
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [flushSession]);

  // ── Track a concept as viewed (call when a lesson activates) ─────────────
  const addConceptViewed = useCallback((conceptId: string) => {
    if (!conceptsViewedRef.current.includes(conceptId)) {
      conceptsViewedRef.current = [...conceptsViewedRef.current, conceptId];
    }
  }, []);

  return { flushSession, addConceptViewed };
}
