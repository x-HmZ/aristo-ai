# Jake's sleeves: from sweater to shirt (2026-10-14)

Hmz: Jake's shirt from the elbows down reads as a sweater, to fix before any footage is captured. Hmz picked
**tailored** from two rendered options (relaxed, tailored); rolled sleeves were offered and not built. 0 API calls.

## What made it a sweater (`sheets/before-all.jpg`, `close-r4.jpg` first column, `measure-*.json`)

- **A wide tube.** V8.3d eased the sleeve 12-14 mm all the way down: over the forearm it stood 58-61 mm off the
  arm line, as wide as at the elbow, wider than over the upper arm, about 1.7x the forearm's own radius.
- **Bunched rings.** V8.3d shortened the sleeve 3 cm by sliding only the forearm part (smoothstep 0.55-0.9), about
  10 cm of cloth into 7: the source's folds stacked into rings above the cuff.
- **A ribbed cuff.** The sleeve pinched in above a deep, rounded cuff whose lower half curled in to the wrist, and
  the cuff hung ~60% on the hand bone, so it bent with the wrist and wrapped it.
- **Not the cloth.** Normal map off, sheen off, roughness 0.6: almost no change (`sheets/diag-material.jpg`).

## The fix (`../2026-09-18-v9-bakeoff/scripts/v9_sleeve.py`, `tailor("tailored")`)

Vertices and weights only, on the shipped shirt, in the rest pose: the shortening spread over the whole sleeve; on a
grid round each forearm bone, the outer envelope lofted from the elbow (6 mm in) to a straight cuff 13 mm off the
wrist skin, its last 3 mm turned in (a hard edge), the rim squared to the arm (up to 8 mm); the forearm's ridges
flattened 64%; no cloth within 4 mm of the skin; the cuff's hand weight moved to ForearmTwist02 (which follows the
wrist's roll at 60%), so the hand bends inside the cuff. Hmz saw an 11 mm cuff gap; 13 mm is what clears every frame
(below).

## Shipping without re-exporting the clips

The working scene's export samples one still pose per clip in Blender 5.1 (2 keys; the shipped clips have 95-201),
so the teacher was not re-exported. `scripts/splice.mjs` puts the new shirt (position, normal, skin weights, joints
remapped by name) into the shipped `Teacher_Jake.glb` and leaves the rest. `scripts/verify_rest.mjs`: the other 21
primitives (the 17 viseme morph targets included), the 3 base clips, 21 textures, 111 nodes and the skins are
identical to the shipped file. `Teacher_Jake_clips.glb` is untouched.

| | Before | After |
|---|---|---|
| `Teacher_Jake.glb` | 2,363,200 B | 2,362,404 B |
| Shirt vertices | 12,128 | 12,120 (Draco merged 8 exact duplicates) |

## Checks (`qa/`, `scripts/qa_sleeves.py`, every frame of all 34 clips, per side)

| Check | Tailored as Hmz saw it (11 mm) | Shipped |
|---|---|---|
| `find_pokes` (body vs shirt, trousers, shoes) | 0 / 0 | 0 / 0 (sample) |
| Camera-ray (skin seen with sleeve within 6 mm behind it; lesson camera and +-0.5 rad) | L 0, R 1-111 in 20 clips (wrist through the lower cuff, up to 5.9 mm) | 0-1 (sample of 4 clips) |
| **Final (13 mm)** | **0 / 0 both checks, every frame** | |

The camera test fired on a self-test (forearm sleeves pulled 15 mm in: 210-525 hits per clip); `find_pokes` hardly
did (it only tests skin covered at rest), which is why both run. Mirror: after the rim fix both sides measure rim
215-221 mm, elbow 53.9 / 54.0 mm, cuff 48.1 / 47.1 mm, largest move 13.1 / 12.9 mm. The left cuff's per-angle rim
read a 15-31 mm notch over five angles (sparse cells), handled by a periodic median.

## In the room

`room/before`, `room/after`, `sheets/room-before-after.jpg`: `/demo` at 1920x1080 headless on the GPU
(`scripts/room.cjs`, the V8.4a capture copied), 0 paid requests. `sheets/options-r4.jpg` and `close-r4.jpg` are the
option sheets Hmz picked from (three.js, the room's lights, the sage shirt; `/dev/avatar-lab?shot`, `forearms.cjs`).

## Files

- `scripts/forearms.cjs` (crops via `/dev/avatar-lab?shot&file=`), `sheet.cjs`, `room.cjs`, `room_sheet.cjs`
- `scripts/measure.py`, `probe_cuff.py`, `probe_weights.py` (diagnosis), `build_option.py` (tailor + raw export)
- `scripts/splice.mjs`, `verify_rest.mjs`, `inspect.mjs`, `parts.cjs` (bytes per part of a GLB)
- The scene before this session: `../2026-09-18-v9-bakeoff/bakeoff_scene_pre_sleeves1014.blend`

## Follow-up (same day): the export, and the landing posters

- **The export works again** (in Hmz's live Blender through the MCP). Blender 5.1's glTF exporter, with its default
  `export_optimize_animation_size`, cut every NLA track to 2 keys (first and last frame: a slide between two poses).
  `v9_export.export` now passes False; a full 34-clip export through `v9_ship`'s steps verifies at worst 0.0156 deg /
  0.118 mm (`v9_verify_anim.mjs`, V9.8's figure), its other 21 primitives identical to the shipped file. Its base comes
  out 51 KB larger (animation 196 KB against 144 KB, same channels and keys: packing, not motion), so the spliced
  file stays shipped. Run the export in the GUI Blender: headless (`blender -b`), `normalise` measured Jake at 33.9 m
  and shrank the shirt 20x, the "uniform scale" `splice.mjs` undoes.
- **Landing posters recaptured** for Jake (`2026-10-03-v8-3c-landing/scripts`: `stills.cjs` first for hero, idea,
  moves, remember, close; end and start for picture, model; `room-stills.cjs`; `faces.cjs`), 0 API calls; MJ's face
  byte-identical. Old ones in `landing/before/`, `sheets/landing-before-after.jpg`.
- **Handover** (`scripts/handover.cjs`, V8.3c's with `?nointro`; `landing/handover/`): poster against the first live
  frame within 2 px at every spot but picture, whose live frame carries the board picture the poster does not
  (mean diff 13.8; 9.5 to 14.9 in every run since V8.3b).
