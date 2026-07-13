# V4 — A Teacher Who Remembers You

**Model:** sonnet | **Tier:** VISION | **Depends on:** none
**Product thesis:** The data layer already knows the student intimately (mastery per concept,
misconceptions, session logs, Bloom strengths, streaks) but the TEACHER acts like it's meeting
them for the first time, every time. Making the avatar greet you by name, recall yesterday's
struggle, and celebrate comebacks converts stored analytics into a relationship — the thing
parents pay for and kids come back for. Cost: one Haiku call per session start.

## Design

1. **Session-open synthesis**: on entering /learn, a new `GET /api/learn/greeting` builds a
   compact context from EXISTING tables (no schema change needed for v1): last
   `session_logs` entry (when, what concepts), mastery deltas since last visit, top
   `user_misconceptions`, overdue review count, streak. One `MODELS.fast` (Haiku) tool_use
   call -> `{ greeting_speech, suggested_action: {type: 'resume_course'|'review'|'new_topic',
   label} }`. The avatar SPEAKS the greeting (existing TTS path) while the suggestion renders
   as a single tappable chip. 2-3 sentences max, warm, grade-appropriate, references at most
   ONE specific memory ("Last time, ratios gave you trouble — want a quick rematch?").
2. **In-lesson continuity**: the lesson generation user-message template
   (`src/lib/agents/teaching.ts`) already injects the DynamicProfile; extend it with a
   `learner_history` block: 2-3 bullet facts (recent misconception on a PREREQUISITE of this
   concept, mastery of prerequisites, last-seen date). The system prompt instructs: weave at
   most one natural back-reference into the Activate phase ("Remember when we covered X?").
   Token cost: tens of tokens; prompt-cache friendly (goes in the user message, not system).
3. **Misconception rematch**: the quiz generator (`assessment.ts`) already exists —
   pass the student's open misconceptions for the concept so ONE quiz question directly
   targets their recorded misconception; on correct answer, clear/decrement it (RPC exists:
   `increment_misconception` — add the decrement path or a `resolved_at` column via a small
   migration if needed) and have the teacher explicitly celebrate ("That's the one that
   tricked you last week — you've got it now."). Surface this: the audit found
   `misconception_detected` is returned but never shown in the UI — show it.
4. **Guardrails**: never reference raw scores or shame ("you failed X twice") — prompt rules:
   always frame as progress/challenge; if history is empty (new user), greeting falls back to
   a warm generic welcome + onboarding-goal reference. Greeting is skippable (student can tap
   through) and cached per day (don't regenerate on every /learn mount — sessionStorage flag).
5. **Signals**: log `greeting_action_taken` so we learn whether suggestions get used.

## Acceptance criteria

- Returning student with history hears a personal greeting referencing a real fact from their
  data, with a one-tap suggested action that works. New student gets the generic path.
- One lesson's Activate phase contains a natural back-reference when relevant history exists.
- A quiz targets a recorded misconception and resolves it on success, visibly celebrated.
- Greeting adds < 1 Haiku call/day/user (verify usage_events); no PII beyond first name in
  any prompt. `yarn type-check` + build pass.

## Do NOT

- No new heavyweight "memory system"/vector store — the existing tables ARE the memory.
- No shame framing; no more than one back-reference per lesson (it gets creepy fast).

## Status checklist

- [x] /api/learn/greeting + spoken greeting + action chip (2026-07-13, branch
      `dev/v4-teacher-memory`). `src/lib/agents/greeting.ts` (Haiku, tool_use,
      `additionalProperties:false`) + `src/app/api/learn/greeting/route.ts`
      (GET generates/falls back, POST logs `signal.greeting_action_taken` to
      `usage_events` with `provider:"internal"`, zero cost). Wired into
      `ModePicker.tsx` (header + suggested-action chip) and `LearnClient.tsx`
      (sessionStorage cache keyed per-day-per-user, avatar speaks via
      existing `useTTS`). `resume_course` reuses `/api/learn/next` +
      `/api/courses/:id` — no new endpoint needed.
- [x] learner_history block in lesson template. `teaching.ts` `buildUserMessage`
      gained a `learnerHistory: string[]` param + `<learner_history>` block;
      system prompt instructs at most one back-reference, no raw
      scores/shame. `/api/learn/lesson/[conceptId]/route.ts` computes up to 3
      facts (last-studied days, prerequisite misconception, mastered
      prerequisite) from prerequisite ids resolved via `concept_prerequisites`.
      IMPORTANT: personalized lessons (`learnerHistory.length > 0`) are
      **not written to `cached_lessons`** — that cache is keyed only by
      `(concept_id, profile_signature)` and is shared across every learner
      with that signature, so caching a lesson containing one student's
      specific misconception/date text would leak it to other students and
      go stale for this student's next visit. Found and fixed during
      implementation.
- [x] Misconception-targeted quiz question + resolution + celebration.
      `generateLessonQuiz` (assessment.ts) accepts `openMisconceptions:
      string[]`; prompted to copy one open misconception's text verbatim
      into `misconception_targeted` so it can be matched later.
      `/api/quiz/lesson/[conceptId]/route.ts` fetches up to 3 open
      (`resolved=false`) misconceptions and passes them through.
      `/api/quiz/submit/route.ts` resolves the row (`resolved=true,
      resolved_at=now()`) on a correct answer whose `misconceptionTargeted`
      matches an open row by exact text, and returns `misconception_resolved`
      + a `celebration` string. **No migration needed** — `resolved` /
      `resolved_at` already exist on `user_misconceptions` (migration 006);
      migration 009's unique constraint makes the exact-text match safe.
      `QuizView.tsx` renders the celebration banner and now calls
      `setGesture("nodding"/"shaking")` on every answer (previously did not
      set gesture at all).
- [x] Guardrails + empty-history fallback verified. Brand-new users (no
      `session_logs` and no `user_concept_mastery` rows) get a deterministic
      greeting with **no LLM call at all**. Returning-user greeting call
      smoke-tested against a real seeded user (see session notes) — cost
      ~$0.0018, latency ~1.8s, well under the $0.20 budget and the "< 1
      Haiku call/day/user" target (sessionStorage caches per calendar day).
      All prompts pass only first name — no other PII. `yarn type-check`,
      `yarn test` (47 passed), and `yarn build` all green.
