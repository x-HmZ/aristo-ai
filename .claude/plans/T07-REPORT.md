# T07 Report — Image-to-3D Model Evaluation (replace TripoSR?)

**Date:** 2026-07-13 | **Status:** complete (eval truncated by exhausted fal balance — see Caveats)
**Verdict: replace `fal-ai/triposr` with `tripo3d/tripo/v2.5/image-to-3d` (standard texture + PBR, $0.30/gen).**

## 1. Candidate landscape (fal.ai, July 2026)

Pricing/latency from the fal model pages on 2026-07-13; latency is the observed end-to-end
`fal.subscribe` wall time (queue + inference) in this eval, not the marketing number.

| Model (fal slug) | Price/gen | Output | Observed E2E latency | Notes |
|---|---|---|---|---|
| `fal-ai/triposr` (incumbent) | $0.07 | GLB, baked texture | 99–103 s (queue-bound; inference itself sub-second) | 2024-era single-view; Z-up (needs -90° X fix) |
| `tripo3d/tripo/v2.5/image-to-3d` | $0.20 base / **$0.30 standard tex** / $0.40 HD (+$0.05 quad or style) | GLB, PBR materials default | 78 s | Output fields: `model_mesh`, `base_model`, `pbr_model`, `rendered_image` |
| `fal-ai/trellis-2` | $0.25 (512p) / **$0.30 (1024p)** / $0.35 (1536p) | GLB (`model_glb.url`) | 238 s | Native 3D generative model; heavy param surface |
| `fal-ai/hunyuan3d/v2` | $0.16 white / **$0.48 textured** (3x) | GLB (`model_mesh.url`) | 40 s | `textured_mesh: true` for textures |
| `fal-ai/hunyuan3d-v3/image-to-3d`, `fal-ai/hunyuan-3d/v3.1/pro/image-to-3d` | v3.1 pro: $0.375 (+$0.15 PBR, +$0.15 multi-view, +$0.15 face count) | GLB/OBJ + thumbnail | not tested | Newer Hunyuan tier — not tested (budget); candidate for a future re-eval |
| `fal-ai/trellis` (v1) | $0.02 | GLB | not tested | Cheapest option on the gallery; v2 tested instead as the quality play |

Bake-off ran the incumbent + top 3 (Tripo3D v2.5, Trellis 2 @1024p, Hunyuan3D v2 textured).

## 2. Method

- `scripts/eval-3d-models.ts` (committed, throwaway): FLUX Schnell source image per prompt
  (exact production prompt template from `generate3dSourceImage` in `src/lib/imagegen/banana.ts`),
  fed unchanged to all four models. Budget guard at $5, per-call cost log.
- fal calls are made directly rather than through `banana.ts`, because the production helpers
  fire `logFalGeneration()` → production Supabase `usage_events`; eval traffic must not pollute
  the cost dashboard. Inputs are copied verbatim so results are representative.
- GLBs downloaded to scratchpad and rendered in a fixed-camera three.js viewer (three@0.161.0,
  same as repo), screenshotted headless via puppeteer at controlled rotations, including with and
  without the `GeneratedModel.tsx` TripoSR rotation (`scene.rotation.x = -PI/2`).
- Evidence saved to session scratchpad: `t07-3d-eval/` (7 GLBs, 2 FLUX sources, 9 render
  screenshots in `shots/`, `summary.json`). Scratchpad is session-temp — screenshots described
  inline below since the folder does not persist with the repo.

**Planned 5 prompts were cut to 3 (animal cell, volcano cross-section, human heart) upfront for
budget, and the run then truncated further** — see Caveats. Completed matrix: animal cell across
all 4 models; volcano on TripoSR only.

## 3. Results — quality scores (1–5)

Animal cell ("animal cell with visible organelles" — FLUX source was a translucent membrane disc
with colorful organelles in a ring):

| Model | Recognizable? | Texture fidelity | Geometry | Overall | What it produced |
|---|---|---|---|---|---|
| TripoSR | 2 | 1.5 | 1 | **1.5** | Flat "coin" relief of the image; front face passable, back a muddy brown smear |
| **Tripo3D v2.5** | 3 | 5 | 4.5 | **4** | True volumetric organelles, vivid PBR color matching the source; lost the translucent membrane (source-image issue as much as model) |
| Trellis 2 (1024p) | 1 | 3 | 3.5 | **1** | Total hallucination — invented a pendant-lamp/jar object with gummy blobs; clean mesh, wrong object |
| Hunyuan3D v2 (textured) | 2 | 2 | 1.5 | **1.5** | Paper-thin vertical ring with a few dark blobs; captured the membrane outline, missed the volume |

Volcano cross-section (only TripoSR completed before balance lock):

| Model | Recognizable? | Texture | Geometry | Overall | Notes |
|---|---|---|---|---|---|
| TripoSR | 3 | 1 | 2.5 | **2** | Upright cone (confirms Z-up + the -90° X fix), but near-black texture, no crater/lava detail |

Reading the one full row honestly: Tripo3D v2.5 is the only model that turned a flat-ish
educational diagram into bright, solid, classroom-usable 3D geometry. Trellis 2's hallucination
on a diagram-style source is disqualifying for this pipeline (our FLUX sources are always
isolated-object-on-white, often diagram-like). Hunyuan3D v2 collapsed to a 2D sheet on the same
input. Both failures are consistent with these models being tuned for photographic/asset-style
inputs, while Tripo's line has always been strong on stylized single-view.

## 4. Latency and axis findings

- **TripoSR is Z-up** — the existing `scene.rotation.x = -Math.PI / 2` in `GeneratedModel.tsx`
  is correct for it (volcano cone rendered upright under the fix, lying flat without).
- **Tripo3D v2.5 output rendered sensibly with NO rotation** (glTF-spec Y-up). The animal-cell
  blob cluster cannot 100% settle orientation — verify once with an asymmetric prompt (volcano)
  after the balance top-up, before shipping. Tripo3D also has an `orientation: "align_image"`
  input option that can standardize orientation at the source.
- Observed E2E latencies (queue included): Tripo3D 78 s, Hunyuan 40 s, Trellis 2 238 s,
  TripoSR ~100 s (fal queue congestion — nominal inference is sub-second).
- Trellis 2's 238 s is uncomfortably close to the 300 s Vercel cap — another disqualifier.
- One Tripo3D call (volcano) hung in the fal queue for >20 min with no error before the run was
  killed. The production `fal.subscribe` path in `banana.ts` has no client-side timeout — the
  swap should add one (Promise.race ~240 s) so a stuck queue degrades gracefully.

## 5. Recommendation

**Adopt `tripo3d/tripo/v2.5/image-to-3d`, `texture: "standard"`, `pbr: true` — $0.30/gen.**

Rationale: only candidate with a step-change in visual quality on our actual input distribution;
4.3x TripoSR's price but T06's persistent per-concept cache makes it a one-time cost per concept;
latency (78 s) fits the existing 300 s route budget; HD texture (+$0.10) not warranted at the
in-scene display size — revisit if models get a zoom UI.

### Concrete swap plan (follow-up task, NOT done in T07)

1. **`src/lib/imagegen/banana.ts` — `generate3dModel()`**
   - slug: `"fal-ai/triposr"` → `"tripo3d/tripo/v2.5/image-to-3d"`
   - input: `{ image_url, texture: "standard", pbr: true }` (drop `do_remove_background`,
     `foreground_ratio`, `mc_resolution`, `output_format` — TripoSR-only params)
   - response shape: `TripoSRResult` (`data.model_mesh.url`) → prefer
     `data.pbr_model?.url ?? data.model_mesh?.url`
   - cache key prefix `triposr|` → `tripo25|` (busts warm cache correctly)
   - `logFalGeneration({ model: "tripo3d/tripo/v2.5/image-to-3d", ... })`
   - add a ~240 s Promise.race timeout around `fal.subscribe` (hang observed in eval)
2. **`src/lib/llm/pricing.ts`** — add `"tripo3d/tripo/v2.5/image-to-3d": 0.30` to `FAL_PRICING`
   (keep `"fal-ai/triposr": 0.07` for historical rows; legacy `"tripo3d": 0.50` alias already exists)
3. **`src/components/three/GeneratedModel.tsx`** — remove the unconditional
   `scene.rotation.x = -Math.PI / 2` (Tripo3D is Y-up). Verify orientation on one asymmetric
   object first; alternatively pass `orientation: "align_image"` in the fal input.
4. **`src/app/api/generate-model/3d/route.ts`** — `maxDuration = 300` already set; fine at 78 s
   observed. Update the stale TripoSR references in route comments.
5. **Cost in the T06 persistent-cache world** — per concept, first student ever pays
   $0.003 (FLUX) + $0.30 (Tripo3D) ≈ **$0.303 once**; all later students $0. A 1,000-concept
   curriculum costs ≈ $303 total, vs $73 with TripoSR — $230 for the quality jump, one-time.
   Without T06 the old per-warm-instance cache would make $0.30 recur per instance recycle,
   so **land T06 before or with the swap**.

## 6. Spend

| Item | Cost |
|---|---|
| FLUX Schnell source images x2 | $0.006 |
| TripoSR x2 (cell, volcano) | $0.14 |
| Tripo3D v2.5 x2 charged (cell OK; volcano hung, possibly not billed) | $0.60 |
| Trellis 2 x1 | $0.30 |
| Hunyuan3D v2 textured x1 | $0.48 |
| **Total tracked** | **$1.526** (upper bound; $1.226 if the hung call wasn't billed) |

Under the $5 budget — but the **fal account balance ran out mid-run** ("User is locked. Reason:
Exhausted balance"), which is what actually stopped the eval.

## 7. Caveats / follow-ups

- Evidence is one full 4-way prompt + one baseline prompt, not 3x4. The animal-cell result is
  decisive (4 vs 1.5/1/1.5) and matches the models' documented input-domain strengths, so the
  recommendation stands, but after topping up fal credits it is cheap (~$0.91) to confirm with
  volcano + human heart on Tripo3D v2.5 only — do this as step 0 of the swap task.
- Tripo3D orientation should be confirmed on an asymmetric object (see §4).
- The FLUX source for "animal cell" (translucent membrane) is itself a weak 3D-reconstruction
  input; a prompt tweak ("solid colorful model, thick forms, no transparency") in
  `generate3dSourceImage` would likely raise every model's floor. Worth a small A/B during the swap.
- Untested newer tier: Hunyuan 3D v3.1 pro ($0.375 + $0.15 PBR ≈ $0.53). Only revisit if
  Tripo3D v2.5 disappoints in production.


---

## Addendum 2026-09-09 — swap shipped, and one recommendation refuted by test

- **Swap implemented** on `dev/t06-persistent-cache`. Tripo3D v2.5 verified against fal:
  heart from a FLUX source is volumetric with clean PBR, 63-82 s, response fields as
  documented. The verdict above holds.
- **§7's FLUX prompt suggestion is WRONG — do not apply it.** "solid colorful model, thick
  forms, no transparency" was tested on the animal cell (§7's own example) and made the result
  *worse*: FLUX turned the membrane into a glass dish and Tripo3D returned disconnected
  floating blobs instead of a coherent cell. The unmodified production prompt wins. The
  translucent-membrane problem is real but this is not the fix.
- **Feeding the labelled NB Pro teaching image to Tripo3D instead of a FLUX source does not
  work** — it extrudes label text and leader lines into the mesh. The separate clean-source
  step is load-bearing.
- **§1's price table understated Nano Banana Pro** at $0.04 (that is the non-Pro rate); fal
  charges $0.15, verified against `api.fal.ai/v1/models/pricing`. Every per-concept cost
  figure derived here was low on the image side.
