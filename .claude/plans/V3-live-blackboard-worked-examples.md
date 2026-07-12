# V3 — Live Blackboard: Worked Examples Written Step-by-Step

**Model:** opus (design-sensitive R3F + schema work) | **Tier:** VISION | **Depends on:** none (supersedes the blackboard item in T08)
**Product thesis:** For math and procedural science, static AI-generated infographics are the
wrong medium — students need to watch a problem get WORKED: one step appearing at a time, in
sync with the teacher's voice, like chalk on a board. This makes the 3D classroom
pedagogically real instead of decorative, and it's *cheaper* than the current image pipeline
(client-rendered text/math instead of $0.04 NB Pro calls per visual).

## Design

1. **Schema**: extend the adaptive lesson segment schema (`src/lib/agents/teaching.ts`) with an
   optional `board` payload alongside the existing `visual`:
   `board: { steps: [{ text: string, math?: string (LaTeX), emphasis?: boolean }], title?: string }`
   — a segment may carry board steps instead of (or as well as) an image prompt. Teach the
   system prompt to prefer `board` for worked examples/derivations/procedures and `visual`
   for things that need imagery. Dual-emit stays; legacy path untouched.
2. **Narration sync**: each board step maps to a narration sentence. Simplest robust design:
   segments that carry a board get their steps revealed one per `segment` — i.e. instruct the
   model to emit one short segment per step (the playback machine already advances per
   segment). Avoid intra-segment timing sync (fragile).
3. **Rendering**: a `BoardSurface` component in the 3D scene — CanvasTexture drawn with a
   chalk-style font (off-white on the board), steps appearing with a short hand-drawn-style
   reveal. Math: render LaTeX offscreen (KaTeX to HTML -> html2canvas is heavy; prefer
   KaTeX-to-SVG or MathJax SVG output drawn onto the canvas — investigate and pick the
   lightest that works; it must render offline/client-side). Investigate `Classroom.tsx`'s
   Blackboard first: if the GLB board surface/UVs are unusable, mount a plane slightly in
   front of it (the existing TeachingImage plane shows the pattern).
4. **Camera assist**: when a board segment starts, CameraController (existing lerp
   infrastructure) eases toward a framing where board + teacher are both visible; eases back
   after. Reuse the desk-quiz framing pattern — do not invent a new camera system.
5. **Teacher behavior**: pointing gesture toward the board during board segments (gesture
   machine exists); the existing image plane hides while a board is active to avoid two
   competing visuals.
6. **Cost note**: board segments should SKIP NB Pro generation (they need no image) — wire the
   segment-visuals batch to ignore segments with `board`. Net effect: math lessons get better
   AND cheaper.
7. **Content trigger**: math-y domains ("Fractions & Ratios" from T11) are the proving ground;
   verify with 2-3 generated lessons that the model reliably chooses board vs visual sensibly.

## Acceptance criteria

- A fractions lesson shows a worked problem appearing step-by-step on the board in sync with
  narration, readable from the default seat, with correct LaTeX rendering.
- Segments with boards fire zero fal.ai calls (check usage_events).
- Legacy + image-visual segments unchanged; desk quiz unaffected; fps within 10% of baseline.
- `yarn type-check` + `yarn build` pass.

## Do NOT

- No intra-segment timed reveals synced to audio milliseconds — one step per segment.
- No new heavy deps without checking bundle impact (KaTeX is acceptable; full MathJax likely not).
- Do not break the `NEXT_PUBLIC_ADAPTIVE_VISUALS`-off path.

## Status checklist

- [ ] Segment schema + prompt updated (board vs visual selection verified on 3 lessons)
- [ ] BoardSurface CanvasTexture + LaTeX pipeline
- [ ] Camera assist + pointing + image-plane coordination
- [ ] Cost skip verified (fps before ____ / after ____)
