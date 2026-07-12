# UX Polish Backlog (from code inventory, 2026-07-12)

Findings from a full read of every student-facing surface. None are product-transforming;
all are small, cheap fixes. **Model: haiku or sonnet — batch several per session.** Verify
each line number before editing (code moves).

## High-value small fixes

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
