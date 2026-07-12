# V1 — Raise-Hand: the Interruptible, Conversational Teacher

**Model:** opus | **Tier:** VISION (flagship) | **Depends on:** nothing hard; T05 nice-first
**Product thesis:** Today Aristo is a narrated slideshow — the student passively watches a
lesson play. Real teachers get interrupted. Letting the student raise a hand at ANY moment,
ask anything, get a contextual answer, and have the lesson resume is the single feature that
moves this from "AI video player" to "AI tutor". Nothing else on the roadmap changes the
category of the product like this does.

## Design decision already made (do not relitigate)

**Push-to-talk, not always-on mic.** A readiness audit (2026-07-12) confirmed the Web Speech
mic and ElevenLabs TTS have zero coordination today and no echo cancellation is exposed —
an always-on mic would transcribe the teacher's own voice. Push-to-talk (a "Raise hand"
button + hold-Space hotkey) stops TTS BEFORE the mic opens, eliminating echo entirely and
cutting the effort from L+ to M. "Resume" = replay the current segment from its start
(the playback hook already works this way); do NOT attempt mid-sentence resume.

## Integration points (from the readiness audit — verify line numbers, code moves)

1. `src/hooks/useTTS.ts` — `stop()` is hard stop+rewind and does NOT fire `onEnd`. Add a
   distinguishable interrupt path (e.g. `onInterrupt` callback or a return flag) so
   `useLessonPlayback` knows narration was cut, not completed. (S-M)
2. `src/hooks/useLessonPlayback.ts` — the gating effect (~line 328) already gates on
   `isPaused`/`awaitingAnswer`. Add `isInterrupted` state + `interrupt()` /
   `resumeFromInterrupt()` controls modeled on the existing `pause()`/`resume()` pair
   (~line 435). Resume re-triggers the segment effect = segment replays. Only `segmentIdx`
   needs capturing — visuals/gesture are recomputed deterministically. (M)
3. **Mic capture**: reuse the `AnswerInputPanel.tsx` pattern (continuous recognition,
   interim results, 1.5 s silence auto-submit, text fallback for unsupported browsers) in a
   new `QuestionCapture` component that mounts only while `isInterrupted`. (S — pattern exists)
4. **New route `POST /api/learn/ask`** — the existing routes don't fit (`/api/teach` returns a
   rigid card with no lesson context; `/api/learn/challenge` grades against a known answer).
   Input (Zod-validated): `conceptId`, current segment text + phase, the student question,
   short rolling Q&A history (role+content turns, max ~6), and the DynamicProfile. Model:
   `MODELS.fast` (Haiku — latency matters more than depth here; escalate to teaching model
   only if quality proves insufficient). Output: free-form answer text sized for TTS
   (2-4 sentences, grade 6-8 language) + optional `follow_up_hint`. Keep tool_use with a
   simple `{answer, follow_up_hint?}` schema — still no regex parsing. (M)
5. `src/store/useAristoStore.ts` + `src/components/three/Teacher.tsx` — add `listening`
   state; gesture resolution gains a "listening" posture (use an Idle variant + head tilt /
   the Thinking clip) with priority above isSpeaking. `YourTurnBubble` pattern in
   `Experience.tsx` shows how to float a 3D indicator; add a "hand raised / listening"
   indicator the same way. (S)

## UX flow (build exactly this)

1. During any narration, a persistent, gently pulsing **"Raise hand (hold Space)"** button
   sits near the playback controls; also triggered by holding Space (ignore when a
   text field is focused).
2. On press: TTS stops instantly, gesture -> listening, mic opens with live interim
   transcript shown in a small bubble, advance timers cancelled.
3. On silence-submit (1.5 s) or Enter: question goes to `/api/learn/ask`; teacher gesture ->
   thinking; answer comes back, teacher speaks it (same `speak()` path, lipsync free).
4. After the answer: small chip with two options — **"Ask another"** / **"Continue lesson"**
   (auto-continue after 6 s of silence). Continue = replay current segment.
5. Q&A exchanges append to the MessagePanel history so they're re-readable, and log a
   `question_asked` behavioral signal (the profiler already consumes signals — curiosity is
   a profiling input).
6. Rate limit: max ~8 questions per lesson server-side (protect cost); after that the
   teacher kindly defers ("let's finish the lesson and come back to that").

## Acceptance criteria

- Raise hand mid-narration -> teacher stops within ~200 ms, listens, answers in context
  (answer references the concept correctly), lesson resumes cleanly. Works via voice AND
  via typed fallback in unsupported browsers.
- Skip/spam-safe: hammering raise-hand/continue never wedges the state machine.
- Answer latency target < 4 s from silence-submit to first spoken word (Haiku + short output).
- Q&A logged to `usage_events` (cost) and message history; signal recorded.
- Legacy flag-off path and challenge/desk-quiz flows unaffected. `yarn type-check` + build pass.

## Do NOT

- No always-on mic. No mid-sentence resume. No WebRTC/realtime-audio dependencies.
- Do not touch the R3F/three version pins or Pages Router structure.

## Status checklist

- [ ] TTS interrupt path
- [ ] Playback interrupt/resume states
- [ ] QuestionCapture component
- [ ] /api/learn/ask route (Zod + tool_use + rate limit)
- [ ] Listening posture + 3D indicator
- [ ] E2E verified by voice and text (latency: ____ s)
