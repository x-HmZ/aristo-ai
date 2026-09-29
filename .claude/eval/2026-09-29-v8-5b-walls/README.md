# V8.5b: day room walls that the teachers read against (2026-09-29)

Both teachers wear white. The day room's warm plaster (#E9DFD1) baked to almost the same brightness, so the shirt
and the wall ran together in the lesson framing (Hmz, after V8.4a). The Evening room already has ink walls and is
unchanged.

## Choosing the colour

`options-light.jpg` and `options-deep.jpg` are preview bakes (1024 atlas, 32 samples) of six wall colours, with
Jake and MJ on `/dev/free-model`. Contrast is measured from the captures: the 90th percentile luminance of the
teacher (the shirt) against the median of the wall beside him.

| Wall | Jake | MJ |
|---|---|---|
| Today, warm plaster #E9DFD1 | 1.11 | 1.08 |
| Sage #9FAE93 / blue-grey #8FA3B5 / clay #B8977E | 1.33 / 1.38 / 1.39 | 1.27 / 1.31 / 1.34 |
| Deep sage #7C9171 | 1.53 | 1.47 |
| **Deep blue-grey #6B8196 (Hmz's pick)** | **1.66** | **1.60** |
| Deep clay #9A765E | 1.66 | 1.59 |

The first full-quality bake painted every wall blue-grey. The side and back walls only get bounced light, so they
baked near-black, and the window wall at the turn limit was almost black. The shipped room keeps #6B8196 on the
front wall behind the teacher only. The other walls take #D6DDE3, which bakes to about the old plaster's
brightness. The split is per face, by normal and position, so each flat surface stays one colour.

## Shipped room (4096 atlas, 64 samples)

- **Contrast** in the lesson framing: Jake 1.12 → 1.57, MJ 1.07 → 1.51.
- **Anchors** (`verify-room.mjs probe`, all 12 probes): identical to the current room. The learner's desk is at
  y -0.888 (centre and corners), the second-row desk at y -0.888, the floor at y -1.694, and the display at
  z -5.574 with normal +z. The only differences are the animated teacher (`Mesh039_1`) and 1 mm on a click point,
  which vary run to run.
- **File:** 1,065,188 → 1,050,648 B (limit 2 MB). Same geometry, same 3 meshes and 1 texture, 32 frame draw calls.
- **fps**, uncapped, 12 runs of 8 s each, interleaved: median 158 before, 156 after (1.2%, noise on this laptop;
  only the atlas colours changed).
- **Shots:** `before_*` / `after_*` are `verify-room.mjs shots` at 1280x720, covering the lesson camera (empty,
  image, model), both turn limits, both tilt limits, and the desk quiz in both framings.

Rebuild: `scripts/room/README.md`. `--wall` and `--wall-side` try colours without editing the palette.
