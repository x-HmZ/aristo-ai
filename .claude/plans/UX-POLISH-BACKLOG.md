# UX Polish Backlog (from code inventory, 2026-07-12)

Findings from a full read of every student-facing surface. None are product-transforming;
all are small, cheap fixes. **Model: haiku or sonnet — batch several per session.** Verify
each line number before editing (code moves).

## High-value small fixes

0a. ~~**A free-topic answer is narrated twice.**~~ **DONE 2026-09-08** — `speak()` removed
   from `InputBox`, `FreeTopicCard` owns it, and `useTTS` now shares one in-flight request
   per (voice, text). Measured 3 calls -> 1, 4.2s -> 1.69s, 3 aborts -> 0. Original writeup: `InputBox.tsx:91` speaks
   `definition + explanation` as soon as `/api/teach` returns, and `FreeTopicCard.tsx:122`
   speaks the same content again from its mount effect. `reactStrictMode: true` double-invokes
   the card's effect, so dev fires three overlapping calls and production two. Since
   2026-09-08 `useTTS` arbitrates so they no longer abort each other, but the redundant
   ElevenLabs generations are still paid for and discarded, and running them together slowed
   each from ~1.3s to ~4.2s — which is what "the audio is lagging" was.
   Fix: delete the `speak()` from `InputBox` and let `FreeTopicCard` own it — the card is
   what renders the text, it speaks the parsed text that matches what is on screen, and it
   already sets `gesture` to "explaining"/"idle" and stops narration on unmount, none of
   which InputBox does. Both a latency fix and a ~2x saving against the 10,000 char/month
   tier.
0b. **Avatar T-pose + idle drift — FIXED 2026-09-09** (see `.claude/docs/state.md`). The
   cached GLTF scene was mounted and mutated without cloning, so all rigs shared bones.
   Fixed by cloning per mount and keying `<Teacher>` by avatar. Verified running 2026-09-09:
   all four avatars animate, none T-pose, and Marcus no longer drifts when left idle.
0. `Teacher.tsx` AVATAR_ASSETS — **sonia declares a morph she does not have.** Her config
   sets `morphs.mouthSmile: "mouthSmile"`, but `Teacher_Sonia.glb` contains no `mouthSmile`
   target (24 morphs, none mouth- or jaw-related). `lerpMorphTarget` looks it up, finds
   nothing and returns silently, so sonia's mouth never moves at all — on `/learn` too, not
   just during narration. Either drop the claim from her config so the code is honest, or
   re-export the asset with mouth morphs. Ryan is a milder case of the same thing: he has
   `mouthSmile` but no visemes, so he can smile but never lipsync (see V7). Verified by
   parsing the GLB JSON chunks on 2026-09-08.
1. `OnboardingView.tsx:33-35` — only 2 hardcoded domains (python_programming,
   middle_school_science). Load domains from the DB/courses instead. (Also see T11.)
2. `QuizView.tsx` — `misconception_detected` is returned by the API but never displayed.
   Show it as a gentle "watch out for this" note in feedback. (V4 builds on this.)
3. `CourseMapView.tsx:194` — renders "~nullh" when estimated_hours is null. Guard it.
4. `InputBox.tsx:162-187` — unsupported-browser mic falls back silently (and uses alert()).
   Show an inline "mic not supported in this browser" state instead.
5. `LessonView.tsx:107-143` — "Explain more" failures are swallowed; show a retry affordance.
6. `LessonView.tsx:439-443` — Challenge "I don't know" reveals the answer without logging a
   signal; log it (profiler input) like other signals.
7. `QuizView.tsx:268-274` — quiz "I don't know" (`__skipped__`) isn't tracked distinctly in
   analytics; record skips.
8. `DashboardView.tsx:94-100` — analytics fetch failure has no retry button.
9. `/pending` page is a dead end — no ETA, nothing to do (V2 adds the demo offer there; until
   then at least set expectations).
10. Free mode has no server-side rate limiting on `/api/teach` — add a simple per-user cap.
11. `FreeTopicCard.tsx:75-92` — brittle `**Field:**` markdown parsing; if `/api/teach` output
    shifts, the card falls to raw text. Consider returning structured fields from the route
    (it already uses tool_use) instead of parsing markdown client-side.
12. `MessagePanel` / mode switching — no way back to the mode picker except the unlabeled
    "Clear" in TeacherControls; add an explicit "Switch mode" affordance.
13. Loading states: ModePicker course list and CourseMapView show bare bouncing dots with no
    label; add text. CourseLoadingBar has no failure state — add one with retry.
14. `sign-up` — no password strength hint beyond minLength.

## Notes

- No TODO/FIXME markers exist in src/ — rough edges are silent-fallback patterns, not
  known-open work.
- Dev-only surfaces (`/dev/*`, FreeModelPreview, DeskQuizPreview) are properly gated to
  non-production; leave them.
