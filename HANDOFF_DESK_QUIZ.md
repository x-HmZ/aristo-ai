# Handoff — Desk-Quiz Positioning (2026-05-17)

## TL;DR

The user wants the in-scene quiz to appear **overlaid on the actual desk surface** in the classroom, not floating in mid-air. Three iterations got the camera tilting nicely and the quiz visible, but the paper still hovers between the chair and the floor instead of resting on the desk top.

**Resume here with a `/dev/desk-quiz` mocked route to iterate cost-free, then tune `DESK_POS` / `DESK_TARGET` / `PAPER_ANCHOR` until the paper visually sits on the desk surface.**

---

## What the user said (paraphrased + verbatim where it matters)

1. *"the tilt felt a little rough"* — fixed by switching from cubic-eased progress accumulator to critically-damped exponential lerp (`λ=3.2`). Tilt is now buttery.
2. *"the quiz isnt even visible to me at all after the tilt animation is done, it just looks like a blank white sheet"* — caused by `<Html transform occlude="blending">` masking the DOM via depth-test. Fixed by dropping `transform` and `occlude` entirely; quiz now renders as a screen-anchored HTML overlay.
3. *"this doesnt look like its on a desk right now"* (with screenshot showing quiz floating between chair and floor) — **still not fixed**. Camera now aims at the real desk world-position `[0.55, -1.3, -3.6]`, but the visual result hasn't been verified yet.
4. *"we should definitely be caching the 3d models why are we not caching them?"* — fixed. Both FLUX Schnell and TripoSR now have in-memory caches in `src/lib/imagegen/banana.ts`. `/api/generate-model/3d/route.ts` refactored to use the cached `generate3dModel()` helper.

---

## State of the world

### Files involved in the desk quiz

| File | Purpose | Status |
|------|---------|--------|
| `src/components/three/CameraController.tsx` | Critically-damped lerp between lesson framing and desk framing | ✅ smooth tilt, **DESK targets need verification on real screenshot** |
| `src/components/three/DeskQuiz.tsx` | Mounts `<QuizView/>` as screen-anchored `<Html>` at desk anchor | ✅ renders, **anchor placement needs verification** |
| `src/components/three/Experience.tsx` | Mounts `CameraController` + `DeskQuiz` | ✅ done |
| `src/components/three/Classroom.tsx` | Hides ambient `DeskPaper` while quiz active | ✅ done |
| `src/components/learn/AristoCanvas.tsx` | Disables `OrbitControls` while quiz active, `makeDefault` for controller access | ✅ done |
| `src/components/learn/LearnClient.tsx` | Pushes quiz to store; bottom bar collapses to "Quiz on your desk — look down" strip | ✅ done |
| `src/store/useAristoStore.ts` | `activeQuiz` + `quizResult` slices | ✅ done |

### Current tunables

```ts
// src/components/three/CameraController.tsx
const LESSON_POS    = new Vector3(0,    0,    0.9);
const LESSON_TARGET = new Vector3(0,    0,   -3);
const DESK_POS      = new Vector3(0.55, -0.3, -2.5);   // ← last guess, NOT verified
const DESK_TARGET   = new Vector3(0.55, -1.3, -3.6);   // ← matches PLACEMENT.default.desk
const LAMBDA        = 3.2;                              // tilt smoothness — looks great
```

```ts
// src/components/three/DeskQuiz.tsx
const PAPER_ANCHOR: [number, number, number] = [0.55, -1.25, -3.45];
// <Html> (no transform), center, zIndexRange [200, 0]
// Inline-styled "paper" wrapper: 520px max width, off-white gradient,
// 32px shadow, fade-in keyframe, .aristo-scroll on the inner container.
```

### Reference: classroom layout (from `src/components/three/Classroom.tsx`)

```
PLACEMENT.default:
  classroom  position: [0.2, -1.7, -2]   rotY: 0    scale: 1
  blackboard position: [0.45, 0.382, -6]
  desk       position: [0.55, -1.3, -3.6]    ← ambient DeskPaper anchor (verbatim from V1)
```

Teacher is at `[-1, -1.7, -3]`. Default camera (lesson view) at `[0, 0, 0.9]` looking at `[0, 0, -3]`.

---

## The actual problem (as of the last screenshot)

After `setActiveQuiz(...)` fires:
- The camera tilts smoothly down toward the desk anchor.
- The quiz appears centred on screen as a clean HTML "paper" card.
- **But** the paper visually floats in the lower-middle of the screen with the chair and floor in the background — it doesn't read as resting on the actual desk top in front of the chair.

The desk in the classroom GLB is BEHIND the chair (further from the camera). The screenshot shows the camera positioned somewhere that the chair occupies the foreground and the desk is mostly above the chair's silhouette. The quiz anchor projects to a screen position below the desk top.

Two things may be wrong:
1. **Camera framing** — `DESK_POS = [0.55, -0.3, -2.5]` puts the camera 1.1 m above and 1.1 m in front of the desk; the look angle is ~42° downward. But the chair might be obstructing the desk surface from this vantage. Need to either (a) raise the camera higher, (b) move it laterally so the chair isn't in the way, or (c) push it further back so the chair stays out of frame.
2. **Paper anchor screen-position** — even if the camera framed the desk perfectly, the `<Html center>` projects the world point to screen and centres the DOM there. If the world point is `[0.55, -1.25, -3.45]` and the camera looks AT `[0.55, -1.3, -3.6]`, the anchor projects to roughly screen-centre — but visually it falls below the desk top because the desk top has its own thickness/perspective.

---

## Resume plan

### Step 1 — Build the mocked dev route (cost-free iteration)

Create `pages/dev/desk-quiz.tsx` (must be Pages Router for R3F — same constraint as `/learn`):

```tsx
// pages/dev/desk-quiz.tsx
import dynamic from "next/dynamic";
const DeskQuizPreview = dynamic(
  () => import("@/components/dev/DeskQuizPreview"),
  { ssr: false }
);
export default function Page() { return <DeskQuizPreview />; }
```

Then create `src/components/dev/DeskQuizPreview.tsx`:
- Mounts `<AristoCanvas/>`
- On mount, sets `useAristoStore.getState().setActiveQuiz({ conceptId: "mock", questions: [...4 stub questions...] })`
- Stubs `userId` if needed (`setUserId("mock-user")`)
- Renders a "Tweak knobs" sidebar with sliders for `DESK_POS.{x,y,z}`, `DESK_TARGET.{x,y,z}`, `PAPER_ANCHOR.{x,y,z}` — wired to local state and passed to CameraController + DeskQuiz via props. (Refactor those components to accept optional override props for this; default to constants when undefined.)
- Save button writes the current values to a `localStorage` snapshot so the tuned numbers survive a refresh.

Hot-reload the page, drag sliders, watch in real-time. **Zero API calls per iteration.**

### Step 2 — Tune until the paper sits on the desk

Likely directions to try:
- Lower the camera (raise `DESK_POS.y` from -0.3 to ~0.2) — more top-down angle, less chair in foreground.
- Pull camera farther back (`DESK_POS.z` from -2.5 to -2.0) so the chair stays out of frame.
- Raise the paper anchor (`PAPER_ANCHOR.y` from -1.25 to -1.1) so it projects above the desk-edge line.
- Consider rotating the anchor approach: instead of `<Html center>` at a fixed world point, use **`<Html transform>` rotated to lie flat on the desk surface** at the desk's exact world transform. This was the original Attempt 1 — it failed because of `occlude="blending"`. Drop occlude this time; the DOM will visibly tilt with the desk geometry, which is the most "on the desk" effect. Tradeoff: requires careful FOV-aware sizing.

### Step 3 — Once positioning is dialled in

- Remove or keep the dev route (suggest gating with `process.env.NODE_ENV !== "production"` so it doesn't ship).
- Roll the tuned constants back into `CameraController.tsx` and `DeskQuiz.tsx`.
- Smoke test the real flow: load a course, finish a lesson, take the quiz, verify the camera tilt and paper placement match the dev-route preview.

---

## What's already in the store (so dev route can fake it)

```ts
useAristoStore.getState().setActiveQuiz({
  conceptId: "stub-concept",
  questions: [
    {
      id: "q1",
      concept_id: "stub-concept",
      question_type: "multiple_choice",
      bloom_level: "remember",
      difficulty: "easy",
      question: "What is 2 + 2?",
      options: ["3", "4", "5", "6"],
      correct_answer: "4",
      explanation_correct: "Basic arithmetic.",
      misconception_targeted: null,
    },
    // …3 more for the full quiz length
  ],
});
useAristoStore.getState().setUserId("mock-user");
```

(`QuizQuestion` shape lives in `src/lib/agents/assessment.ts` — check it for the exact required fields per question type.)

---

## Cost reminder

For real-flow iteration: lesson regeneration costs ~$0.10–0.20 per fetch (Anthropic prompt cache drops repeat fetches within 5 min to ~$0.02–0.04). Quiz generation ~$0.04. Segment visuals are SHA-cached for 12 h so repeat lessons cost zero on visuals. **Use the dev route to avoid any of this entirely.**

3D pipeline as of 2026-05-17 is now fully cached in-memory:
- Nano Banana Pro infographic — `_cache` in `banana.ts` (was already there)
- FLUX Schnell 3D source — `_cacheFlux` (added today)
- TripoSR `.glb` — `_cache3d` (added today, was the largest leak at $0.07/click)

Caches are per Vercel Fluid Compute instance, 256-entry LRU, 12 h TTL. Next-best upgrade: persist `_cache3d` to a Supabase Storage table keyed by `concept_id` so the *first* student to view a topic pays once and every subsequent student inherits the model.

---

## Files modified this session (2026-05-17)

| File | Change |
|------|--------|
| `src/components/learn/AristoCanvas.tsx` | Camera back to `[0, 0, 0.9]`, OrbitControls `makeDefault`, disabled while `activeQuiz` is set |
| `src/components/three/Experience.tsx` | Image plane anchor shifted, 3D model anchor preserved, added `<CameraController/>` + `<DeskQuiz/>`, `<YourTurnBubble/>` for awaiting-answer cue |
| `src/components/three/Classroom.tsx` | Hides ambient `DeskPaper` while quiz active |
| `src/components/three/Teacher.tsx` | `"explaining"` gesture added to state machine + frame cycling |
| `src/components/three/CameraController.tsx` | NEW — exponential lerp between lesson and desk framings |
| `src/components/three/DeskQuiz.tsx` | NEW — screen-anchored `<Html>` overlay (no transform, no occlude) |
| `src/components/learn/LessonView.tsx` | `aristo-scroll` class on main scroll container |
| `src/components/learn/MessagePanel.tsx` | Free-mode renders `FreeTopicCard` + `FreeUserBubble` |
| `src/components/learn/LessonPlayer.tsx` | Mounts `AnswerInputPanel` when `awaitingAnswer`; otherwise floating playback controls |
| `src/components/learn/LearnClient.tsx` | Quiz state moved to store; bottom bar collapses during quiz |
| `src/components/learn/AnswerInputPanel.tsx` | NEW — A+B+C blend (text + auto-mic + silence-submit) |
| `src/components/learn/FreeTopicCard.tsx` | NEW — 4-card stack matching course UI; auto-narrates |
| `src/store/useAristoStore.ts` | Added `awaitingAnswer`, `activeQuiz`, `quizResult` + setters |
| `src/hooks/useLessonPlayback.ts` | Sticky images, force-idle on loading, challenge pause-gate, `submitAnswer`, generate-model restored in adaptive mode |
| `src/hooks/useTTS.ts` | 4-slot LRU prefetch cache for next-segment audio (Phase C, earlier in session) |
| `src/lib/imagegen/banana.ts` | Added `_cacheFlux` + `_cache3d`, added `generate3dModel()` helper |
| `src/app/api/generate-model/3d/route.ts` | Refactored to use cached helper |
| `src/lib/speech.ts` | NEW — shared Web Speech API types |
| `src/app/globals.css` | `.aristo-scroll` class |

`tsc --noEmit` exits clean at session close.

---

## Verbatim user quotes for reference

> "i want this to be generated exactly on top of a desk, you can use the camera positions (for both initial teaching part) and then the quiz part from the original code, and that might give you an idea of where the template should be placed"

The original V1 quiz placement (from `git show e8931f0:src/components/Experience.jsx`):
```jsx
<Html
  distanceFactor={0.4}
  transform
  position={[0, -0.8, -0.52]}
  rotation-x={-1.4}
>
  <QuizBox />
</Html>
```

V1's camera at `[0, 0, 0.0001]` (origin). V1's quiz was a floating Html close to camera — no actual desk geometry involved. The "desk feel" came purely from the -1.4 rad (~-80°) X rotation. The user references this as "the paper in the correct place" — they may actually want the V2 implementation to mimic this floating-but-tilted approach rather than literally pinning to the classroom GLB's desk mesh.

**That's a viable plan B if the geometry-pinned approach proves too hard to tune**: revert to V1's recipe — `<Html transform position={[0, -0.8, -0.52]} rotation-x={-1.4} distanceFactor={0.4}>` (without `occlude`) — and let the camera tilt do the contextual work. The quiz won't pretend to be at any specific world location; it'll just be a tilted reading surface in front of the camera.

> "lets do the cheap fix but in the next iteration"

= build the dev route first; iterate against it; **don't burn API calls.**

---

## Quick sanity command

After resuming, run:

```bash
npx tsc --noEmit
```

If this exits 0, the session state is clean and you can start dev-route work immediately.
