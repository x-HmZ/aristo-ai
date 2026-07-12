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

- [ ] /api/learn/greeting + spoken greeting + action chip
- [ ] learner_history block in lesson template
- [ ] Misconception-targeted quiz question + resolution + celebration
- [ ] Guardrails + empty-history fallback verified
