# T07 — Image-to-3D Model Evaluation (replace TripoSR?)

**Model:** sonnet | **Priority:** 8 | **Depends on:** T06 (persistence makes a pricier model affordable)
**Output:** a report + recommendation, NOT a code change. The swap itself is a follow-up decision.

## Context

The current image->3D step is `fal-ai/triposr` ($0.07/gen, sub-second) called from
`src/lib/imagegen/banana.ts` (`generate3dModel`). TripoSR is a 2024-era single-view
reconstructor — output meshes are blobby, low-texture-fidelity, and often unrecognizable for
exactly the objects a tutor needs (cells, engines, pyramids, molecules). This is the weakest
visual-quality link in the product. With T06's per-concept persistence, a model costing 5-10x
more is still cheap because each concept generates once ever.

Pipeline context: FLUX Schnell produces the clean source image; the GLB lands in
`GeneratedModel.tsx` (note: it applies a Z-up -> Y-up rotation specific to TripoSR output —
a replacement model may not need it).

## What to do

1. Enumerate current image->3D options on fal.ai (use the fal docs/model gallery):
   expected candidates as of mid-2026 include Tripo3D v2.5, Hunyuan3D 2.x, Trellis,
   and whatever newer entries exist. Record per-model: price/gen, latency, output format
   (GLB? textured?), and axis convention.
2. Pick 5 representative middle-school test prompts, e.g.:
   - "animal cell with visible organelles"
   - "volcano cross-section"
   - "human heart"
   - "simple electric circuit with battery and bulb"
   - "Egyptian pyramid with cutaway"
   For each: generate the FLUX source image once, then run it through TripoSR + the top 2-3
   candidates. Reuse the existing `generateFluxSource` helper via a throwaway script
   (`scripts/eval-3d-models.ts`, run with a real `FAL_KEY`) so caching and cost logging apply.
   Budget guard: keep total spend under ~$5; log costs.
3. Save all output GLBs to the scratch folder + screenshots (load each in the `/dev/free-model`
   dev harness which already exists, or a three.js viewer) for side-by-side comparison.
4. Write the report to `.claude/plans/T07-REPORT.md`: comparison table (quality 1-5 per prompt,
   cost, latency, integration notes like axis/scale differences), and a single recommendation
   with the code changes the swap would need (model slug, response shape, pricing.ts row,
   GeneratedModel.tsx rotation, maxDuration).

## Acceptance criteria

- Report exists with real generated evidence (not just doc claims), a clear recommendation,
  and total eval spend recorded.
- No production code changed.

## Status checklist

- [x] Candidate list with pricing/latency
- [x] Eval run — reduced to 3 prompts for budget, then truncated by exhausted fal balance;
      full 4-model matrix on animal-cell + TripoSR baseline on volcano (spend: $1.53 tracked)
- [x] Side-by-side screenshots captured (fixed-camera three.js viewer; saved to session scratchpad)
- [x] T07-REPORT.md written with recommendation (Tripo3D v2.5, $0.30/gen)
