# Third-party assets and licences

Every asset that ships in `public/` (and so is fetchable by anyone) is listed here with its author,
licence, source and whether Aristo changed it. Checked 2026-09-23. **Verified** means the licence was
read from the source today (Sketchfab's public API) or is written into the file itself. **Unverified**
means it comes from the project's own history or a vendor's terms that could not be read; those rows
say what is missing and are collected under "Open items" at the end. Nothing here is guessed: where the
source is unknown, it says so.

The two shipped teachers carry their credit in the app as well, next to the avatar on `/learn` and
`/demo` (`AvatarCredit`, driven by `AVATAR_ASSETS[*].credit` in `src/components/three/Teacher.tsx`),
and inside each GLB as `asset.copyright`.

## Shipped teachers (CC BY 4.0, attribution required)

| File | Work | Author | Licence | Source | Modified |
|---|---|---|---|---|---|
| `public/models/Teacher_Jake.glb`, `Teacher_Jake_clips.glb` | "Free Cartoon Game Man Character (Rigged)" | Canino3d (https://sketchfab.com/Canino3d) | CC BY 4.0, verified against Sketchfab's API | https://sketchfab.com/3d-models/free-cartoon-game-man-character-rigged-a69c8962f4a14ea89bf623d716a81411 | Yes: retargeted animation, 14 baked visemes (the m/b/p shape softened to 60%, V9.6), materials rebuilt (shirt recoloured at runtime, V8.3c), hidden skin masked, knee smoothing, finger relax, 17 hand-keyed gestures (see "Authored animation clips"); V8.3d: the shirt loosened (cut above the waist and regrown untucked, eased, sleeves 3 cm shorter, its painted-fold colour map replaced by a fold normal map baked in-house) and the forearm skin under the old cuffs put back from the source mesh |
| `public/models/Teacher_MJ.glb`, `Teacher_MJ_clips.glb` | "Free Stylized Cartoon Girl Rigged Character" | Canino3d (https://sketchfab.com/Canino3d) | CC BY 4.0, verified against Sketchfab's API | https://sketchfab.com/3d-models/free-stylized-cartoon-girl-rigged-character-dcaa822909ae4e04ad7eb85bc371a8c4 | Yes: as Jake, plus a new skirt and a re-grown tee built in-house, and the base file's collar and sleeves fixed (V9.7, arm and head skin pushed clear of the cloth); V8.3d: the tee loosened and regrown over the skirt, its normal map replaced by a fold map baked in-house |

Licence text: https://creativecommons.org/licenses/by/4.0/

- **Textures** (21 per teacher: skin, eyes, teeth, hair, clothing) are the source model's own, re-encoded
  to WebP at 1024 px. MJ's eyelash texture is Jake's (same CC base UVs, same author). No texture from any
  other source is in these files. The exception since V8.3d: each shirt's normal map (`Jake_shirt_normal`,
  `MJ_shirt_normal`) is Aristo's own bake of authored folds (`v9_fabric.py`), and Jake's shirt has no colour map.
- **Skirt and re-grown tee (MJ)** are Aristo's own geometry (`.claude/eval/2026-09-18-v9-bakeoff/scripts/v9_skirt.py`,
  `v9_tee.py`), and so is the viseme shape work, and so are both shirts' loosened, regrown lower parts and
  Jake's re-placed buttons (V8.3d, `v9_loose.py`). They sit inside the CC BY work and are shared under the
  same licence.
- Jake and MJ were built from the CC4-rig conversions Sketchfab serves; the CC BY grant covers derivatives,
  which is why `modified` is true and printed.

## Animation clips (Mixamo)

| Files | Author | Licence | Source | Modified |
|---|---|---|---|---|
| The 17 Mixamo clips inside `Teacher_Jake.glb` / `Teacher_Jake_clips.glb` and `Teacher_MJ.glb` / `Teacher_MJ_clips.glb` (the packs also carry 17 authored clips, the sections below); all 16 in `public/models/animations_Avaturn.glb` | Adobe Mixamo (Y Bot motions; clip names are in `scripts/build_avaturn_animations.py`) | Mixamo terms: free for personal and commercial projects, not for resale of the motions themselves. **Unverified today**: Adobe's FAQ returned 403 to the fetch tool; the wording is as recorded in the V9 plan's sources | https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html | Yes: retargeted to the CC4 and Avaturn rigs, root motion removed, resampled to 30 fps, left-right mirrors (`...M`), finger relax, compressed |

A note on redistribution: the clips are served as ordinary GLBs, so they are fetchable. They are bound
to a character skeleton and shipped as part of the app rather than as a downloadable library, which is
the use Mixamo's terms describe, but nobody has confirmed that reading with Adobe.

## Authored animation clips (Aristo's own, V9.6)

| Clips | Author | Licence | Source | Modified |
|---|---|---|---|---|
| `PresentModel`, `Almost`, `Exactly`, `WellDone`, `Encourage`, `ThatsIt`, `GlanceBoard` inside `Teacher_Jake_clips.glb` and `Teacher_MJ_clips.glb` | Aristo (Hmz, keyed in Blender with Claude's help) | Aristo's own work; no third-party source. **Not Mixamo-derived**: the keys are written by hand from poses (`.claude/eval/2026-09-18-v9-bakeoff/scripts/v9_gesture.py`), not retargeted from any captured or purchased motion | Authored 2026-09-24 | Not applicable. They play on the CC BY 4.0 characters above and are packed inside the same GLB files, so the file as a whole stays under the attribution requirement of its character |

The two clips tried and rejected in the same session (`LookAgain`, `LookAgainHand`) were never shipped.

## Authored animation clips (Aristo's own, V9.7)

| Clips | Author | Licence | Source | Modified |
|---|---|---|---|---|
| `Imagine`, `HoldIdea`, `StepBeat`, `MoveOn`, `YourTurn`, `BringTogether` inside `Teacher_Jake_clips.glb` and `Teacher_MJ_clips.glb` | Aristo (Hmz, keyed in Blender with Claude's help) | Aristo's own work; no third-party source, same tool and process as the V9.6 clips above | Authored 2026-09-27 | Not applicable, as the V9.6 row above. `Imagine`, `MoveOn` and `YourTurn` each replace a rejected alternate concept, kept as `V97_NOT_SHIPPED` specs, never exported |

The six V9.6 hand-keyed clips above were also re-exported this session with the same finger life (cascade, stagger,
drift, wrist lag) the six V9.7 clips use, replacing their previously flatter hands; Hmz approved both sets in motion.
That is a re-bake of existing clips, not a new authored work, so it does not add a row.

## Authored animation clips (Aristo's own, V9.8)

| Clips | Author | Licence | Source | Modified |
|---|---|---|---|---|
| `OneMoment`, `PointNear`, `PatientTilt`, `BackToBoard` inside `Teacher_Jake_clips.glb` and `Teacher_MJ_clips.glb` | Aristo (Hmz, keyed in Blender with Claude's help) | Aristo's own work; no third-party source, same tool and process as the V9.6/V9.7 clips above | Authored 2026-09-27 | Not applicable, as the rows above. `OverToYou` (row 18 of the catalogue) was rejected after three rounds and dropped; its two rejected concepts are kept as `OVER_TO_YOU_R2` and `OVER_TO_YOU` in `V98_NOT_SHIPPED`, never exported |

Also this session: `Pointing`'s hand fixed in the base GLBs (the other fingers folded, index straightened; it had been
bent back 9deg and splayed 12.5deg) -- a fix to an existing Mixamo-derived clip's keys, not a new authored work, so it
does not add a row. `scripts/v9_gesture.py` gained `digits`, `on`/`passes`, `fit`, `panel_hit`, `hand_frame` and
`tuck_point`, used to author the four rows above and to fix Pointing.

## Legacy and archived teachers (not offered in the picker; still in `public/models`)

| File | What it is | Author and licence | Status |
|---|---|---|---|
| `Teacher_Marcus.glb`, `Teacher_Priya.glb` | Avatars generated with Avaturn's editor | Avaturn's terms of service; the page at avaturn.me/terms returned 404, so the wording is **unverified** | Archived. Marcus is the source of the shared Avaturn rig and of custom teachers |
| `animations_Avaturn.glb` | Mixamo clips retargeted to the Avaturn rig | See "Animation clips" | Used by custom teachers |
| `Teacher_Ryan.glb`, `animations_Ryan.glb`, `Teacher_Sonia.glb`, `animations_Sonia.glb` | V1 (2024) characters | Open-source models from a YouTuber's tutorial (Hmz, 2026-09-23; the V1 app followed the Wawa Sensei "AI teacher" tutorial). **Not recorded:** the creator's name, the exact licence and a source URL | Archived. Fill in the licence and URL when known |
| `dev_placeholder.glb` | Stand-in model for `/dev/free-model` | It renders as the yellow duck on `/dev/free-model` (seen on screen), and its generator (COLLADA2GLTF) matches the Khronos glTF sample "Duck", which is under the **SCEA Shared Source License 1.0** (Sony Computer Entertainment, 2006, per the Khronos repository). A byte-for-byte match was not checked | Dev only. The page 404s in production, but the file is still copied into `public/` and so is served. See Open items |

## Classroom

| File | Source | Licence |
|---|---|---|
| `public/models/classroom_default.glb`, `classroom_alternative.glb` | Open-source model from a YouTuber's tutorial (Hmz, 2026-09-23), added in the "AI Module" commit of 2024-05-04. Compressed by Aristo (Draco, WebP) in 2026. **Not recorded:** creator, exact licence, source URL | Open source per Hmz; the exact licence is **unrecorded** |
| `public/models/classroom_default.glb` since V8.5 (2026-09-27) | **Modified by Aristo** (`scripts/room/build_studio_room.py`). The geometry is the original's, with the lockers, wall clock, cork boards and chalk tray deleted. The materials, palette and baked lighting are Aristo's own. **No third-party assets were added** (no Poly Haven, Sketchfab or generated geometry) | The original's licence still governs the geometry, and it is **unrecorded**. It now also has to allow modification (an "ND" licence would not). See Open items |
| `public/models/classroom_alternative.glb` since V8.5 (2026-09-28), the "Evening" room | **Rebuilt by Aristo** from the same original classroom's shell (`build_studio_room.py --variant evening`). The previous alternative room (an anime-style classroom from the same V1 tutorial source) is **no longer shipped**. The room shell is the original's, with every desk but the learner's removed and a new flat floor, a rug and pendant cords (Aristo's own, scripted). It also contains the four Poly Haven models below, all baked into one texture | The original classroom's licence for the shell (**unrecorded**, as above). The Poly Haven models are CC0 |

### Poly Haven models in the "Evening" room (CC0)

Fetched by `scripts/room/fetch-props.mjs` (1k glTF), placed and baked by `build_studio_room.py`. CC0 needs no
credit; the authors are listed as a courtesy.

| Model | Author (per api.polyhaven.com/info) | Source | Licence |
|---|---|---|---|
| Mid Century Lounge Chair (`mid_century_lounge_chair`) | Kuutti Siitonen | polyhaven.com/a/mid_century_lounge_chair | CC0 |
| Side Table 01 (`side_table_01`) | James Ray Cock | polyhaven.com/a/side_table_01 | CC0 |
| Potted Plant 04 (`potted_plant_04`), used twice | James Ray Cock | polyhaven.com/a/potted_plant_04 | CC0 |
| Modern Ceiling Lamp 01 (`modern_ceiling_lamp_01`), used three times | James Ray Cock | polyhaven.com/a/modern_ceiling_lamp_01 | CC0 |

## Demo lessons (`public/demo/`)

| Files | Made with | Licence |
|---|---|---|
| `<slug>/model.glb` (heart; the volcano's was removed in V8.3c) | Generated by Tripo3D v2.5 through fal.ai from a FLUX Schnell image, Draco-compressed by Aristo | Output terms of Tripo3D and fal.ai. **Unverified**: which plan, and what the terms grant, was not recorded |
| `heart/source.jpg` | FLUX Schnell through fal.ai (`.claude/eval/2026-09-09-pipeline/README.md`) | **Unverified**: fal's output terms were not recorded |
| `heart/teaching.jpg` | Nano Banana Pro (per the same README) | **Unverified** |
| `volcano-eruption/seg_*.png` | The app's own image generator, run by `scripts/generate-demo-content.ts` | **Unverified**: which model and terms were not recorded |
| `<slug>/seg_*.mp3`, `*.align.json`, `audio.json` | ElevenLabs text-to-speech (model `eleven_turbo_v2_5`, voice "Antoni"), with character timings | ElevenLabs terms depend on the plan that rendered them (commercial use needs a paid plan). **Unverified** for volcano and heart; `brain/` was rendered on the **free** plan on 2026-10-04 (attribution required, not for commercial use: re-render on a paid plan before launch) |
| `brain/model.glb`, `public/landing/brain.glb` (V8.3c) | Tripo3D v2.5 through fal.ai from a FLUX Schnell image, run by the V8.3c eval (`.claude/eval/2026-10-03-v8-3c-landing/scripts/volcano-model.ts`, ledger there); resized, simplified (landing copy), WebP textures and Draco by Aristo | Output terms of Tripo3D and fal.ai. **Unverified**, as above |
| `brain/seg_004.png`, `public/landing/brain-picture.webp` (V8.3c) | Nano Banana Pro through the app's own generator, run by `scripts/generate-demo-brain.ts` | **Unverified**: fal's output terms were not recorded |
| `public/landing/voice/<teacher>/line_*.mp3`, `*.align.json` (V8.3c) | ElevenLabs text-to-speech (`eleven_turbo_v2_5`; Jake "Antoni", MJ "Jessica") with timestamps, by `scripts/landing-voice.mjs` | Rendered on the **free** ElevenLabs plan, whose terms require attribution and do not allow commercial use: re-render on a paid plan before any commercial launch |

## The wordmark and OG image (Archivo outlines, SIL OFL 1.1)

| Files | Work | Author | Licence | Source | Modified |
|---|---|---|---|---|---|
| `public/brand/aristo-wordmark-*.svg`, `src/components/brand/markPaths.ts`, `ogPaths.ts` | Letter shapes A, R, S, T, O and the OG image's words, as vector outlines | Omnibus-Type, "Archivo" (https://fonts.google.com/specimen/Archivo) | SIL Open Font License 1.1, which allows use and modification, including embedding outlines, with the name "Archivo" not used for a modified font | The same Archivo file next/font already serves on the landing page | Yes: instanced at wdth 112 / wght 600 (wordmark) and wdth 125 / wght 800 (OG headline), kerned, joined with the Aristo column, and converted to paths by `scripts/brand/build-mark.mjs` |

The column itself is Aristo's own drawing. No font file is embedded in the mark or the OG image.

## Other files in `public/`

| Files | Source | Licence |
|---|---|---|
| `public/draco/*` | Google's Draco decoder, copied from three.js (`three/examples/jsm/libs/draco/gltf`) | Apache 2.0 (Draco); verified from the upstream project, not re-read from the copy |
| `public/images/landing/*.webp` | Aristo's own screenshots of the product (with the Marcus teacher) | Aristo's own. They show an Avaturn avatar, see the Marcus row |
| `public/next.svg`, `public/vercel.svg` | Next.js starter template | Vercel's starter, MIT-licensed project; unused |

## Open items

1. **Ryan, Sonia and the classroom GLBs**: open source from a YouTuber, per Hmz. Add the creator's name, the
   exact licence and the URL to the rows above. The classroom is on screen in every lesson, so it matters most. Since
   V8.5 the default room is a modified version, so also confirm that the licence allows derivatives.
3. **`dev_placeholder.glb`**: the Khronos/Sony Duck, under a licence that is not a plain open licence.
   It is dev-only; the cleanest fix is to drop it from `public/` or swap it for a CC0 model.
4. **Mixamo, Avaturn, ElevenLabs, Tripo3D and fal.ai terms**: Hmz has read them (2026-09-23), but the fetch
   tool could not, so the wording is not pasted here. Note the plan and date of the ElevenLabs render.
