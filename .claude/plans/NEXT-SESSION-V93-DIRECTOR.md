Start V9.3 of the teacher programme: the animation director. **Model: Opus 5** to design the
manifest, the director and its tests; **switch to Sonnet 5 in the same session** once the design
is settled and it's time to grind through the wiring and the bulk of the tests — the session
cannot switch its own model, so stop and say so in plain words when you reach that point (see
"Model discipline" in the plan doc below).

Read `CLAUDE.md`, then `.claude/docs/state.md` (top entry), then in
`.claude/plans/V9-teacher-avatar-and-animation-library.md`: "The scenario catalogue" (the 21-row
table), "Architecture", the "V9.3" phase entry, and "Model discipline". Skim
`.claude/plans/V9-REPORT.md`'s "V9.2" and "V9.2b" sections for what the clips and pools actually
are today, and `.claude/docs/decisions.md` for the scale numbers now in effect (teachers ship
taller than a "believable adult" by Hmz's own call — don't re-litigate that).

## Where things stand

- `src/components/three/Teacher.tsx` resolves `gesture`/`isLoading`/`isSpeaking` into a clip name
  through an ad-hoc chain of `useEffect`s (priority: gesture override → thinking → speaking →
  idle), with idle/talking/thinking variant cycling done inline. This is what V9.3 replaces.
- `CANINO_CLIPS` (same file) is the current pool config per teacher: `idle`, `thinking`,
  `talking`, `pointing`, `nodding`, `shaking`. Jake and MJ each carry 17 clips (base GLB: Idle,
  Talking, Thinking; lazy pack: the other 14), loaded via `clipPacks`.
- No manifest, no director, no layer system exist yet. Everything is full-body; there is no
  upper/base/face/look split, no priority/variety/cooldown logic beyond what's hand-rolled in
  `Teacher.tsx`, and no unit tests for any of it.
- V9.2's coverage table (in `V9-REPORT.md` "V9.2") lists which catalogue rows are short on
  variants today (e.g. row 8 "point at board" 2 short, row 14 "wrong, encouraging" 3 short — no
  clap, no real wrong-answer clip). V9.3 does not need to fill those gaps with new clips; it
  needs the director to work correctly with what exists, repeat-free, and degrade sanely where a
  row is short.
- `Idle3` (a restless fidget) and `Talking6`/`Talking6M` (a wave) ship in the pack but are
  unwired — they're V9.3's "long wait" (row 2) and "greeting" (row 3) rows. Hmz has seen `Idle3`
  in motion and called it fine.

## The task

1. **`src/lib/avatar/animationManifest.ts`** — every clip: id, source, licence, scenario tags,
   layer (`base | upper | face | look`), loop or once, duration, weight, cooldown, mirrorable.
   Data lives here, not in `Teacher.tsx`.
2. **`src/lib/avatar/director.ts`** — pure function(s), unit-tested with Vitest, no three.js
   import. Takes the current signals (gesture, isLoading, isSpeaking, lesson phase, awaitingAnswer,
   activeModelUrl, modelInteracting, activeQuiz, quizResult, isComplete — see the catalogue table
   for the exact signal each row reads) and returns what each layer should play: priority rules,
   no clip twice in a row, cooldowns, crossfade duration. Test it like `src/lib/bkt.ts` or the
   FSRS module: table-driven, pure logic.
3. **Layers in three.js.** Base clips stay on the mixer as today. Upper-body gestures need
   filtering to upper-body bone tracks (three has no bone masks — filter the tracks, see the
   plan doc's "Architecture" section for the approach and the `AnimationUtils.makeClipAdditive`
   note for gentle overlays). Look-at (camera/board/model/desk) is clamped head/eye rotation
   applied after the mixer each frame, not a clip.
4. **Wire `Teacher.tsx`** to consume the director's output instead of its current inline chain.
   Every one-shot/loop/fade behavior already fixed in V9.1e-V9.2b (the nod-falls-back-to-Idle
   clamp bug, the cycler skipping variants, the Talking→Pointing pop) must still hold — read
   those comments in `Teacher.tsx` before touching the state machine, they're there because each
   one was a real regression once.
5. **Custom teachers keep working.** `/create-teacher`'s Avaturn output and the
   `animations_Avaturn.glb` pack must still play through whatever the director becomes.

## Acceptance for this phase

- Every catalogue row plays at least its available variants (not the brief's original minimum if
  the clips aren't there — see "coverage" above), no clip repeats back to back.
- No crossfade pop; the specific bugs listed in step 4 don't come back.
- Director logic covered by unit tests, table-driven, no three.js.
- `/learn`, `/demo`, free mode, desk quiz, the 3D model display, the teacher picker and custom
  teachers all behave exactly as before from the user's side — this phase is an internal
  refactor plus new capability (long-wait, greeting rows), not a visible redesign.

## Ground rules

- Package manager: yarn.
- Gates: `yarn type-check`, `yarn lint` (22 pre-existing warnings), `yarn test`, `yarn build`.
- `typescript-reviewer` pass on any `Experience.tsx` or `Teacher.tsx` change.
- Small atomic commits, imperative mood, no AI attribution lines.
- At the end: add a V9.3 section to `.claude/plans/V9-REPORT.md`, tick V9.3 in the plan's
  checklist, update `.claude/docs/state.md`, push to `origin docs/v8-v9-programme` once gates
  pass.

## Parked (don't do)

- New clips (Mixamo is exhausted; Tier 2 hand-keying is the only source left — see
  `decisions.md` "Clip sources after V9.2"). Filling catalogue gaps is separate work.
- The Avaturn rig's own pack diet/mirrors (still open from V9.2).
- Female narration for MJ, MJ's hair/scalp seam.
