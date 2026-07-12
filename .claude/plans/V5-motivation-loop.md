# V5 — Motivation Loop (XP, levels, in-scene celebration)

**Model:** sonnet | **Tier:** VISION | **Depends on:** none
**Product thesis:** Middle schoolers do not sustain effort for a mastery bar. The app tracks
streaks and mastery but offers zero moment-to-moment reward: no XP, no levels, no celebration
when you nail a quiz — the audit found even quiz completion is a plain text banner. Duolingo's
retention is the loop, not the content. Aristo has a unique asset for this: a 3D teacher who
can physically celebrate WITH you (clapping gesture already exists).

## Design

1. **XP economy (server-authoritative)**: migration adds `user_xp` (user_id, xp, level,
   updated_at) + an `xp_events` log (source: lesson_complete, quiz_question_correct,
   review_done, streak_day, misconception_resolved, comeback bonus). Award XP ONLY in
   existing server routes where the events already happen (`/api/quiz/submit`,
   `/api/learn/complete`, `/api/quiz/complete`, review flow) — never from the client.
   Simple curve: level N needs ~100*N XP. Zod-validate everything; RLS: user reads own rows.
2. **In-scene celebration moments** (the differentiator — use the classroom, not toasts):
   - Quiz passed: teacher walks through existing Clapping gesture + a short spoken praise
     line (rotate ~10 canned lines by score band — no LLM call needed) + a 2-second confetti
     burst in 3D (instanced particles, cheap, despawn fully).
   - Level-up: bigger moment — teacher announces it by name ("Level 7, {name}!"),
     level badge chip animates in the HUD.
   - Streak milestone (3/7/14/30 days): spoken mention at greeting time (hooks into V4's
     greeting if present, otherwise a simple HUD moment).
3. **HUD**: persistent, small XP bar + level chip in the /learn nav (fills on award with a
   satisfying ease; count-up animation). Dashboard gains an XP/level card + xp_events history.
4. **Anti-grind guards**: XP for a given concept's quiz caps after 2 attempts/day; review XP
   caps daily; free-mode questions give tiny XP with a daily cap. Keep numbers in one
   constants file so tuning is trivial.
5. **Tone guard**: celebration is warm, never infantile (matches "not childish, not
   corporate"). No coins/gems/shop — XP + levels + streaks only for v1. Badges: DEFER.

## Acceptance criteria

- Correct answers/lesson completion visibly award XP (HUD animates); quiz pass triggers the
  in-scene clap + praise + confetti; level-up moment works end-to-end.
- XP cannot be earned by client calls alone (server-side only, verified); caps enforced.
- fps unaffected outside the 2-second celebration; all new inputs Zod-validated; migration +
  RLS clean; `yarn type-check` + build pass.

## Do NOT

- No client-trusted XP writes. No shop/currency/leaderboards in v1 (leaderboards need
  privacy thought for minors — defer deliberately).
- No emoji spam in the 3D scene; celebration is physical (gesture/particles/voice), not sticker-bomb.

## Status checklist

- [ ] Migration (user_xp + xp_events) + server-side awards
- [ ] HUD XP bar + level chip + dashboard card
- [ ] In-scene celebrations (clap + praise + confetti + level-up)
- [ ] Caps verified by test
