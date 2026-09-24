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
| `public/models/Teacher_Jake.glb`, `Teacher_Jake_clips.glb` | "Free Cartoon Game Man Character (Rigged)" | Canino3d (https://sketchfab.com/Canino3d) | CC BY 4.0, verified against Sketchfab's API | https://sketchfab.com/3d-models/free-cartoon-game-man-character-rigged-a69c8962f4a14ea89bf623d716a81411 | Yes: retargeted animation, 14 baked visemes (the m/b/p shape softened to 60%, V9.6), materials rebuilt, hidden skin masked, knee smoothing, finger relax, 7 hand-keyed gestures (see "Authored animation clips") |
| `public/models/Teacher_MJ.glb`, `Teacher_MJ_clips.glb` | "Free Stylized Cartoon Girl Rigged Character" | Canino3d (https://sketchfab.com/Canino3d) | CC BY 4.0, verified against Sketchfab's API | https://sketchfab.com/3d-models/free-stylized-cartoon-girl-rigged-character-dcaa822909ae4e04ad7eb85bc371a8c4 | Yes: as Jake, plus a new skirt and a re-grown tee built in-house |

Licence text: https://creativecommons.org/licenses/by/4.0/

- **Textures** (21 per teacher: skin, eyes, teeth, hair, clothing) are the source model's own, re-encoded
  to WebP at 1024 px. MJ's eyelash texture is Jake's (same CC base UVs, same author). No texture from any
  other source is in these files.
- **Skirt and re-grown tee (MJ)** are Aristo's own geometry (`.claude/eval/2026-09-18-v9-bakeoff/scripts/v9_skirt.py`,
  `v9_tee.py`), and so is the viseme shape work. They sit inside the CC BY work and are shared under the
  same licence.
- Jake and MJ were built from the CC4-rig conversions Sketchfab serves; the CC BY grant covers derivatives,
  which is why `modified` is true and printed.

## Animation clips (Mixamo)

| Files | Author | Licence | Source | Modified |
|---|---|---|---|---|
| The 17 Mixamo clips inside `Teacher_Jake.glb` / `Teacher_Jake_clips.glb` and `Teacher_MJ.glb` / `Teacher_MJ_clips.glb` (the packs also carry 7 authored clips, next section); all 16 in `public/models/animations_Avaturn.glb` | Adobe Mixamo (Y Bot motions; clip names are in `scripts/build_avaturn_animations.py`) | Mixamo terms: free for personal and commercial projects, not for resale of the motions themselves. **Unverified today**: Adobe's FAQ returned 403 to the fetch tool; the wording is as recorded in the V9 plan's sources | https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html | Yes: retargeted to the CC4 and Avaturn rigs, root motion removed, resampled to 30 fps, left-right mirrors (`...M`), finger relax, compressed |

A note on redistribution: the clips are served as ordinary GLBs, so they are fetchable. They are bound
to a character skeleton and shipped as part of the app rather than as a downloadable library, which is
the use Mixamo's terms describe, but nobody has confirmed that reading with Adobe.

## Authored animation clips (Aristo's own, V9.6)

| Clips | Author | Licence | Source | Modified |
|---|---|---|---|---|
| `PresentModel`, `Almost`, `Exactly`, `WellDone`, `Encourage`, `ThatsIt`, `GlanceBoard` inside `Teacher_Jake_clips.glb` and `Teacher_MJ_clips.glb` | Aristo (Hmz, keyed in Blender with Claude's help) | Aristo's own work; no third-party source. **Not Mixamo-derived**: the keys are written by hand from poses (`.claude/eval/2026-09-18-v9-bakeoff/scripts/v9_gesture.py`), not retargeted from any captured or purchased motion | Authored 2026-09-24 | Not applicable. They play on the CC BY 4.0 characters above and are packed inside the same GLB files, so the file as a whole stays under the attribution requirement of its character |

The two clips tried and rejected in the same session (`LookAgain`, `LookAgainHand`) were never shipped.

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

## Demo lessons (`public/demo/`)

| Files | Made with | Licence |
|---|---|---|
| `<slug>/model.glb` (volcano, heart) | Generated by Tripo3D v2.5 through fal.ai from a FLUX Schnell image, Draco-compressed by Aristo | Output terms of Tripo3D and fal.ai. **Unverified**: which plan, and what the terms grant, was not recorded |
| `heart/source.jpg` | FLUX Schnell through fal.ai (`.claude/eval/2026-09-09-pipeline/README.md`) | **Unverified**: fal's output terms were not recorded |
| `heart/teaching.jpg` | Nano Banana Pro (per the same README) | **Unverified** |
| `volcano-eruption/seg_*.png` | The app's own image generator, run by `scripts/generate-demo-content.ts` | **Unverified**: which model and terms were not recorded |
| `<slug>/seg_*.mp3`, `*.align.json`, `audio.json` | ElevenLabs text-to-speech (model `eleven_turbo_v2_5`, voice "Antoni"), with character timings | ElevenLabs terms depend on the plan that rendered them (commercial use needs a paid plan). **Unverified**: the plan at render time was not recorded |

## Other files in `public/`

| Files | Source | Licence |
|---|---|---|
| `public/draco/*` | Google's Draco decoder, copied from three.js (`three/examples/jsm/libs/draco/gltf`) | Apache 2.0 (Draco); verified from the upstream project, not re-read from the copy |
| `public/images/landing/*.webp` | Aristo's own screenshots of the product (with the Marcus teacher) | Aristo's own. They show an Avaturn avatar, see the Marcus row |
| `public/next.svg`, `public/vercel.svg` | Next.js starter template | Vercel's starter, MIT-licensed project; unused |

## Open items

1. **Ryan, Sonia and the classroom GLBs**: open source from a YouTuber, per Hmz. Add the creator's name, the
   exact licence and the URL to the rows above. The classroom is on screen in every lesson, so it matters most.
3. **`dev_placeholder.glb`**: the Khronos/Sony Duck, under a licence that is not a plain open licence.
   It is dev-only; the cleanest fix is to drop it from `public/` or swap it for a CC0 model.
4. **Mixamo, Avaturn, ElevenLabs, Tripo3D and fal.ai terms**: Hmz has read them (2026-09-23), but the fetch
   tool could not, so the wording is not pasted here. Note the plan and date of the ElevenLabs render.
