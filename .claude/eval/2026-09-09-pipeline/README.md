# Generation pipeline eval — 2026-09-09

Real fal.ai output from the eval that set the current image + 3D pipeline. **$2.43 spent.**
Every asset here is a genuine production-shaped generation, not a mockup. Point a session at
this file to give it the evidence without re-running anything.

Conclusions drawn from these artifacts are written up in `.claude/docs/state.md`
(2026-09-09 entries) and `.claude/plans/T07-REPORT.md` (addendum). This file is the index.

## Demo-usable asset (lives outside this folder)

| path | size | what |
|---|---|---|
| `public/demo/heart/model.glb` | 1.88 MB | The good heart. Draco-compressed from 14.97 MB. |
| `public/demo/heart/source.jpg` | 16 KB | The FLUX Schnell image it was reconstructed from. |
| `public/demo/heart/teaching.jpg` | 97 KB | NB Pro teaching image of the same subject. |

Served at `/demo/heart/model.glb`. **There is no heart demo *lesson*** — this is an asset
only. Existing demo lessons are `src/data/demo/black-holes.ts` and `volcano-eruption.ts`,
each pointing at `/demo/<slug>/model.glb`; a heart lesson would follow that shape.

Draco decoding is already wired globally (`src/components/three/dracoDecoder.ts` calls
`useGLTF.setDecoderPath("/draco/")`), so this GLB loads through the normal `useGLTF` path
with no extra setup. All 501,222 triangles are preserved — compression is lossless geometry
encoding, not decimation.

## Models (reference / failure cases)

All Draco-compressed the same way. Originals were 8-15 MB each.

| file | size | what it shows |
|---|---|---|
| `models/heart-from-labelled-infographic.glb` | 1.37 MB | **Failure case.** Tripo3D fed the *labelled* NB Pro teaching image instead of a clean FLUX source. It extrudes label text and leader lines into the geometry. This is why the separate FLUX source step exists. |
| `models/heart-tweaked-prompt.glb` | 1.77 MB | Heart from the "solid opaque forms, no transparency" FLUX prompt. Mesh is fine; Tripo's own `rendered_image` preview came back blank for this one, which is why there is no `d3-` image. |
| `models/cell-current-prompt.glb` | 1.89 MB | Animal cell from the **unmodified** production FLUX prompt — a coherent solid disc. |
| `models/cell-tweaked-prompt.glb` | 2.12 MB | Same cell from the tweaked prompt — **fragmented into disconnected floating blobs.** The tweak backfired. |

## Images

Resized to max 1024px, JPEG q82 (7.86 MB of PNG -> 0.69 MB). Prefixes group the comparisons.

**A — segment visuals, NB Pro vs NB 2.** Prompts are verbatim from `cached_lessons`, all
text-heavy Python material. This is the comparison that moved segment visuals to NB2.

| file | model | verdict |
|---|---|---|
| `a1-code-compare--nb-pro.jpg` | Pro | code exact, clean and glanceable |
| `a1-code-compare--nb2.jpg` | NB2 | code exact, but adds RESULT paragraphs |
| `a2-terminal--nb-pro.jpg` | Pro | `python3 --version` exact, semantic callouts |
| `a2-terminal--nb2.jpg` | NB2 | text exact, more realistic terminal, some useless callouts ("Terminal Background (Dark)") |
| `a3-flow--nb-pro.jpg` | Pro | correct but **under-designed** — three boxes in a sea of white |
| `a3-flow--nb2.jpg` | NB2 | richer and better as a teaching visual, but adds a poster title and paragraphs |
| `a3-flow--nb2-with-restraint-suffix.jpg` | NB2 | **the shipped configuration.** Same prompt plus `RESTRAINT_SUFFIX` — clean numbered diagram, correct labels, no prose. |

Neither model garbled any text in 3/3. Text fidelity is a tie; the difference is design
restraint. Measured latency: Pro 27.6 s avg, NB2 12.9 s avg.

**B — teaching image.** `b1-teaching-image--nb-pro.jpg`, the tier that stays on Pro because
`visual_walkthrough` narration cites its labels by name.

**C/D — 3D source and result (heart).**

| file | what |
|---|---|
| `c1-flux-source--current-prompt.jpg` | FLUX source, production prompt |
| `c2-flux-source--tweaked-prompt.jpg` | FLUX source, tweaked prompt |
| `d1-heart-3d--from-flux-source.jpg` | Tripo3D result — volumetric, coronary vessels, clean PBR |
| `d2-heart-3d--from-labelled-infographic.jpg` | Tripo3D fed the labelled image — garbled 3D lettering and floating arrows |

**E — animal cell A/B**, the case T07 flagged as failing.

| file | what |
|---|---|
| `e1-cell-flux-source--current-prompt.jpg` | coherent cell |
| `e2-cell-flux-source--tweaked-prompt.jpg` | membrane became a glassy petri dish |
| `e3-cell-3d--current-prompt.jpg` | solid disc with organelle forms |
| `e4-cell-3d--tweaked-prompt.jpg` | disconnected floating blobs |

## Three things a future session should not re-litigate

1. **Do NOT apply T07 §7's FLUX prompt tweak** ("solid colorful model, thick forms, no
   transparency"). Tested on T07's own example and it made the result worse — see the E
   series. The current prompt in `generate3dSourceImage` stays.
2. **Do NOT feed the labelled teaching image to Tripo3D** as a way to skip the FLUX step.
   See `d2`. The clean, unlabelled, single-object source is load-bearing.
3. **NB2 is not worse than Pro at text.** The A series is the evidence. If a future change
   proposes moving segment visuals back to Pro, it needs a reason other than label fidelity.

## Reproducing / extending

The eval scripts were throwaway and are not committed. They called fal **directly** rather
than through `src/lib/imagegen/banana.ts`, deliberately, so eval traffic never lands in
production `usage_events` — keep that property if you re-run. Prices come from
`GET https://api.fal.ai/v1/models/pricing?endpoint_id=<slug>` with the `FAL_KEY`, which is
free to query and the only source that agreed with itself.

`summary.json` holds the raw per-call timings and response field names from run 1.

**One trap:** Tripo3D's `rendered_image` preview came back blank on 1 of 5 calls while the
mesh was fine (14.9 MB). Never use that preview as a health check.

## Sizes, if you add generated models to the demo

Tripo3D returns ~500k triangles, which is absurd for a classroom prop and is 7x the largest
existing demo model before compression. Two levers: Draco (what was done here — 8x, lossless
geometry) and Tripo3D's `face_limit` input, which would cut it at source. The existing demo
models for comparison: `black-holes/model.glb` 2.1 MB, `volcano-eruption/model.glb` 0.66 MB.

## viewer.html — inspecting these GLBs

`viewer.html` renders a Draco GLB through the same loader stack the app uses (GLTFLoader +
DRACOLoader pointed at `/draco/`), so if a model displays here it will display in the scene.
It prints the bounding box and which axis is tallest, which is how the Y-up orientation was
confirmed after the `-PI/2` rotation was removed from `GeneratedModel.tsx`.

It needs a static server rooted at `public/` (it resolves `/draco/` and `/demo/...`), and it
cannot be opened as a `file://` URL — ES modules and the WASM decoder both need http.

```bash
npx --yes serve public -l 4599
```

Then copy `viewer.html` next to `public/` or open it from any static host and pass a model
with `?m=`:

- `http://localhost:4599/heart-viewer.html` — defaults to `/demo/heart/model.glb`
- `...?m=/demo/black-holes/model.glb` — any other model

Two gotchas that cost time the first go: the jsDelivr `examples/jsm` builds import a bare
`three` specifier, so the page needs the `<script type="importmap">` block it already has;
and the renderer must be given an explicit `setSize(W,H,true)` — leaving it to `innerWidth`
produced a 0x0 canvas in an embedded browser pane, which renders a blank frame while
otherwise reporting success.
