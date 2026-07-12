# T08 — Dynamic Classroom Pass (immersion without new assets)

**Model:** opus (or sonnet if opus unavailable) | **Priority:** 10 | **Depends on:** T02 (perf headroom first)

## Context

The classroom is a static GLB with a static camera seat. The scene already has: teacher with
gestures/lipsync, a floating teaching-image plane with callout chips, desk quiz, generated 3D
models. The goal is ambient life and lesson-reactive surfaces — NOT replacing the environment.

Key files: `src/components/three/Experience.tsx` (scene composition, lighting, image plane),
`Classroom.tsx` (classroom GLBs, Blackboard, DeskPaper — check how Blackboard is currently
rendered), `Teacher.tsx` (animation state machine, morph targets incl. `eyeBlinkLeft`),
`CameraController.tsx` (lerped framings), store `useAristoStore.ts` (currentSegmentId,
gesture, activeQuiz, awaitingAnswer).

Hard constraints: `/learn` stays in Pages Router; R3F v8 / drei v9 / three 0.161 (do NOT
upgrade these — react-reconciler pin); keep 60 fps on mid-range hardware — every addition
below must be toggleable and cheap.

## What to do (in order of value)

1. **Live blackboard** (highest value): render lesson state onto the blackboard via a
   CanvasTexture — lesson title, current phase name (Activate/Explain/...), and 2-3 key
   points or the current segment's callouts, drawn in a chalk-like style (off-white text,
   slight jitter, brand-consistent). Update on `currentSegmentId`/phase change with a short
   fade. Investigate first how Blackboard is built in Classroom.tsx and whether the GLB has
   a usable board surface/UV — if not, overlay a slightly-offset plane in front of it.
2. **Idle life for the teacher**: periodic eye blinks are presumed present via morphs —
   verify; add slow gaze drift toward the camera (subtle head/eye aim, lerped, max a few
   degrees) so the teacher "looks at" the student, and weight-shift by cycling the existing
   Idle variants instead of looping one clip.
3. **Ambient scene motion**: floating dust motes in the key-light shaft (instanced points,
   <500 particles, additive, very low opacity); a barely-perceptible breathing of the fill
   light intensity. Both behind a single `AMBIENT_FX` constant so they can be disabled.
4. **Camera micro-sway**: when idle (no quiz, no user drag), add a tiny slow sinusoidal
   drift (<0.01 rad) to simulate a seated human head. Must pause during OrbitControls
   interaction and desk-quiz framing, and must not fight CameraController's lerps —
   apply as a small additive offset, not a target change.
5. Performance gate: measure fps before/after (drei `<Stats>` in dev); every feature
   individually toggleable; total added draw calls < 10.

## Acceptance criteria

- Blackboard reflects the live lesson and is readable from the default seat framing.
- Teacher blinks and subtly tracks the camera; no uncanny snapping.
- Scene feels alive at idle; fps within 10% of baseline (record numbers).
- Desk quiz framing, image plane, callouts, and generated-model display all unaffected.
- `yarn build` passes.

## Do NOT

- No dependency upgrades (three/R3F/drei pinned). No new heavy assets. No postprocessing
  passes (bloom/DoF) — too costly for this budget.
- Do not touch probed anchors/camera constants for the desk quiz.

## Status checklist

- [ ] Blackboard live-render
- [ ] Gaze + blink polish
- [ ] Ambient FX (toggleable)
- [ ] Camera micro-sway
- [ ] FPS before ____ / after ____
