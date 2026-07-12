# T03 — /learn Loading Experience

**Model:** sonnet (load the `frontend-design` skill) | **Priority:** 4 | **Depends on:** T02 ideally

## Context

The 3D scene takes seconds even after T02's asset diet, and today the user stares at:

1. `pages/learn.tsx:11` — dynamic-import fallback is a bare `<div className="min-h-screen bg-[#fdf6ee]" />`.
2. Inside the Canvas, `AristoCanvas.tsx:39` — `<Suspense fallback={null}>` while GLBs stream in
   (there is an `AvatarLoadingPlaceholder` capsule for the teacher only).

No progress indication anywhere. First impression of the flagship page is a blank cream screen.

Design language (from CLAUDE.md): pastel orange #F97B2F + cream/beige, soft glassmorphism,
not childish, not corporate. Existing tokens/utilities in `src/app/globals.css`
(`.glass`, `shadow-aristo*`, `text-gradient`, `bg-aristo-gradient`).

## What to do

1. Build a full-screen loading overlay component for `/learn`:
   - Use drei's `useProgress` hook to get real GLB download progress (`{ progress, loaded, total }`).
   - Overlay lives OUTSIDE the Canvas (regular DOM, absolutely positioned over it) and fades out
     (200-300 ms, framer-motion is already a dependency) when `progress === 100` and the scene has
     rendered at least one frame.
   - Content: Aristo wordmark, a slim progress bar in brand orange, and a rotating line of
     friendly microcopy ("Setting up your classroom...", "Your teacher is on the way...").
     Keep it calm — no spinners on top of bars on top of text.
2. Replace the `dynamic()` fallback in `pages/learn.tsx` with a static version of the same overlay
   (0% state) so the transition JS-chunk-load -> GLB-load is seamless (same visual, no flash).
3. Keep the in-scene `AvatarLoadingPlaceholder` for later avatar *switches* (not first load).
4. Optional if time allows: prefetch the default GLBs from the dashboard/sign-in page with
   `<link rel="prefetch">` so returning users hit a warm cache.

## Acceptance criteria

- Cold load of `/learn` shows branded overlay with a moving progress bar tied to real asset bytes.
- No blank screen at any point between navigation and interactive scene.
- Overlay never gets stuck: if `useProgress` stalls (network error), show a retry hint after ~20 s.
- `yarn build` passes; Pages Router structure of `/learn` untouched.

## Do NOT

- Do not move `/learn` into App Router. Do not add webpack aliases. (See CLAUDE.md critical constraint.)
- Do not gate the overlay on TTS/LLM readiness — assets only.

## Status checklist

- [x] Overlay component built (real progress)
- [x] dynamic() fallback matched to overlay
- [x] Stall/retry state handled
- [ ] Verified cold + warm load in browser — needs a human eyeball pass (type-check/build clean; agent cannot drive a real browser network throttle in this environment)

## Implementation notes (2026-07-12)

- `src/components/learn/LoadingScreenVisual.tsx` — pure presentational piece (wordmark, slim progress
  bar, rotating microcopy, stall hint + reload button). No dependency on drei/three/the store, so it's
  safe in `pages/learn.tsx` (Pages Router) and even gets server-rendered as the first paint.
- `src/components/learn/SceneLoadingOverlay.tsx` — smart wrapper mounted in `LearnClient.tsx`, outside
  the Canvas. Sources progress from drei's `useProgress()` directly (confirmed via
  `node_modules/@react-three/drei/core/Progress.js`: it's a plain Zustand store bound to
  `THREE.DefaultLoadingManager`, not the R3F/Fiber context — no bridge needed for progress itself).
  Fades out (280ms) only once `progress >= 100` AND a `sceneReady` flag is true AND a 400ms minimum
  display timer has elapsed (anti-flash on fast loads). Stall hint after 20s with no progress change.
- `sceneReady` is a new (non-persisted) field on `useAristoStore` set by a tiny `SceneReadyReporter`
  bridge component added inside `AristoCanvas.tsx`'s existing Suspense boundary (`useFrame` fires once
  content mounts) — this IS the one place a bridge was needed, since "first frame painted" is a Fiber
  concern, unlike raw byte progress.
- `pages/learn.tsx`'s `dynamic()` `loading:` fallback now renders `<LoadingScreenVisual progress={0} />`
  instead of the old bare cream div.
- In-scene `AvatarLoadingPlaceholder` (Experience.tsx) untouched — still handles avatar switches.
- Optional prefetch step done: `src/app/sign-in/page.tsx` now renders `<link rel="prefetch">` for the
  three T02 eager assets (Teacher_Ryan.glb, animations_Ryan.glb, classroom_default.glb).
