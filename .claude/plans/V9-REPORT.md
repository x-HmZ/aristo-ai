# V9.1 Bake-off report (round 1, 2026-09-18, in progress)

Renders: `.claude/eval/2026-09-18-v9-bakeoff/` (`bakeoff_sheet_round1.png` is the overview).
Working scene `bakeoff_scene.blend` is git-ignored; third-party sources live in the ignored `sources/`.

## Render setup (matches the app, not by eye)

- Camera from `CameraController.tsx` / `AristoCanvas.tsx`: three.js pos `(0,0,0.9)` -> target `(0,0,0.4)`, vertical FOV 40, near 0.01. Assumes a 16:9 canvas.
- Placement from `Experience.tsx`: teacher `(-1,-1.7,-3)`, scale 1.5, rotY 0.3; classroom `(0.2,-1.7,-2)`.
- `SceneLights` mirrored; no shadows (no mesh in the app casts one). ACES 1.3 view, exposure log2(0.83).
- The warm patch on the right wall is baked into `classroom_default.glb`, not a lighting artefact.
- A 3 m material-less icosphere ships inside `Teacher_Marcus.glb`; hidden for renders. Worth checking why the app does not show it.
- Face close-ups: 85 mm "FaceCam" 2.2 m in front of the head bone.

## Candidates

| ID | Look | Source | Licence | Tris | Face rig | Body rig |
|---|---|---|---|---|---|---|
| control | L1 | Avaturn Marcus | existing | 34.5k | 52 ARKit + 15 `viseme_*` | Mixamo names, no prefix |
| L2-a | L2 | MPFB 2.0.17, female, age 25 | CC0 output (MPFB GPLv3; core assets CC0) | 40k incl. hair/clothes, high-poly eyes | 52 ARKit + 15 `viseme_*`, **same names as Marcus** | `mixamo` rig, 52 bones, all present in the Avaturn rig once `mixamorig:` is stripped |
| L2-b | L2 | Rocketbox Female_Adult_17, Male_Adult_12 (`_facial.fbx`) | MIT | 8.5k / 6.7k | 52 ARKit (`AK_`), 15 visemes (`AA_VI_nn_`), 48 FACS (`AU_`), 42 Vive (`SR_`) | 3ds Max Biped (`Bip01 *`), 81 bones |
| L3-a | L3 | L2-a body, cel materials + inverted-hull outline | CC0 | same as L2-a | same as L2-a | same as L2-a |
| L3-b | L3 | Quaternius Universal Base Characters (free) | CC0 | ~13k | none | humanoid |

MPFB packs used (all CC0, no CC-BY): system assets, visemes02, faceunits01, skins01/02, eyebrows01, eyelashes01, hair01, shirts01, pants01, shoes01, system hair/clothes materials.

## Findings so far

- **The face rig is solved for both L2 routes.** MPFB and Rocketbox both carry the full ARKit set plus the 15 Oculus visemes. MPFB's names match what `Teacher.tsx` drives today; Rocketbox needs a rename map (`AA_VI_10_aa` -> `viseme_aa`, `AK_*` -> ARKit).
- **Existing clips do not play directly on MPFB.** Bone names match, but bone rolls and the rest pose differ (Avaturn is a T-pose, MPFB an A-pose), so the arms cross. Needs the V9.2 retarget. The renders use a one-frame, world-direction pose transfer from Marcus's Idle, frame 10.
- **Rocketbox FBX animation trap:** clip rotations come in relative to the clip file's own rest pose, and bones import in Euler mode. The renders drive the avatar from the clip's skeleton with world-space constraints. V9.2 must handle both.
- **Rocketbox** has the best face at close range and the cheapest meshes (6-9k tris). The look is dated (mid-2000s realism), the neutral face reads slightly worried, and textures are 2k TGAs (12 MB each), so recompression is mandatory.
- **MPFB L2** is plausible but reads flat, "Sims-like". Eyes are small, and hair and clothing are the weakest parts (the sweater needed an 8 mm offset to stop the trousers poking through).
- **MPFB L3** (cel shading + outline) works on the body. The face is the problem: realistic proportions under flat shading read uncanny. A real L3 needs stylised proportions (larger eyes, simpler nose/mouth), via MPFB targets (`l/r-eye-scale-incr`, head scale) or a hand sculpt, **re-checked against the viseme shape keys**.
- **Quaternius free tier is not viable as-is:** it contains only the Superhero bodies, in underwear, with no clothes and no face shapes. Teen/Regular bodies are in the $19.99 Source tier. Dropped unless the budget changes.
- Two shader bugs to remember for export: MPFB eyes have an outer cornea layer that is only transparent via texture alpha; the Rocketbox opacity material wires alpha from colour instead of alpha.

## Round 1 decisions (Hmz, 2026-09-19)

- **L2 = Rocketbox** (F17/M12 liked; final casting open). MPFB L2 not pursued.
- **L3-a (MPFB + cel shading) rejected.** Replacement search:
  - VRoid CC0 samples are anime (schoolgirls, an elf). Out: childish.
  - Quaternius Modular Men/Women are low-poly with dot eyes and no mouth, so they can't lip-sync. Out.
  - Sketchfab (public search API, 166 hits triaged): proposed the **Canino3d set**. Stylised woman `dcaa8229`, man `a69c8962`, young man `92b4b22d`. CC-BY 4.0, rigged, "100+ face blendshapes" (viseme coverage unverified), 57-105k tris (needs decimation). Download needs Hmz's Sketchfab login.
  - Also excluded: Levi (fan art of Corinna Marie's concept, IP risk) and "Pixar style girl" (suggestive listing).
- Casting board (both looks): https://claude.ai/artifact/Qk5cieG57J5LGtrLHMRCha

## Round 2 (2026-09-20)

- **Quality challenge answered with `quality_check.png`.** The casting board's 240 px crops of Rocketbox's own preview PNGs read far worse than the models are. Measured: Rocketbox ships **2048² colour + normal + specular**, against Marcus's **1024²-and-mostly-512²** — 4x the texture detail of the avatar shipping today. Marcus carries more geometry (34.5k tris vs 8.5k/6.7k), which shows in hair and silhouette, not skin. The honest objection to Rocketbox is its dated mid-2000s style, not resolution.
- **Casting picked: Female_Adult_01 and Male_Adult_04** (rendered at lesson framing + close-up). Note: **M04's hair shows seams where the alpha cards overlap** — needs a material fix or a different candidate.
- **L3 Canino3d imported and tested (original FBX).** One of three is usable:
  - **`Jake.fbx` (the man) is good** — clean stylised, shirt and trousers, reads as a teacher at both framings. Best-looking candidate in the programme so far.
  - **`MJ.fbx` (the woman) is defective**: forearms and hands are melted **in the rest mesh itself** (identical bbox with the armature modifier on and off, zero unweighted verts), so re-binding cannot fix it — it would need sculpting. Wardrobe is a crop top and micro skirt anyway.
  - **`Frank.fbx` (the young man) explodes**: head, limbs and clothing meshes scatter at separate transforms.
  - Canino3d publishes only these three characters, so a matched same-artist pair is not available.
- **Face rig is weaker than the listing claims:** 69 shapes on the body mesh, whose mouth set is Character Creator's 8 visemes (`Open`, `Explosive`, `Dental_Lip`, `Tight_O`, `Tight`, `Wide`, `Affricate`, `Lip_Open`), **not** the 15 the app drives, and no ARKit set. Expression shapes (brow, blink, smile, frown) are fine.
- **CC4 rig does not take the existing clips**: a world-direction pose transfer from the Rocketbox/Mixamo skeleton crumples the mesh to ~40% height. Retarget belongs in V9.2; renders use the rest pose.
- **Import notes for anyone repeating this:** the meshes are centimetre-scale and Y-up, so normalise the root by the *full* bbox (leftover `hide_render` flags silently produce a partial bbox and a 9 m character), and hide `Skate_Board`.
- **Downloads keep truncating** because the browser pane cancels in-flight downloads when the tab navigates, and the Save dialog appears at the start of the transfer. Verify with `unzip -t` before importing.

## Decision: L2 Rocketbox, F01 + M04 (2026-09-20)

Hmz chose "find a CC-style female to match Jake, fall back to shipping F01/M04". The search failed, so the fallback stands.

- **Searched ~250 free models** in two sweeps: general stylised-character queries, then the Character Creator tags (`charactercreator`, `cc4`, `cc3`, `iclone`, `reallusion`). The CC tags are almost entirely fan art of copyrighted characters (Family Guy, Lara Croft, Jim Carrey); the general sweep produced nothing near Jake's quality. Closest was "Green Dress Girl" (Guugoo3D, CC-BY), whose listing never claims a rig.
- **Sketchfab's converted GLB of the Canino woman (`MJ_sketchfab.glb`, md5 9c4c5040…) fixes the geometry but not the face.** Rendered in `glbtest_canino_girl.png`: arms and hands are correct, rig present (255 bones). But it imports with **zero morph targets** — their conversion drops them — so there is no viseme or expression set at all. (An earlier note here claimed the GLB arms were warped; that was inferred from bounding boxes and was wrong.) Two blockers remain before she could teach: sculpt the 15 visemes plus expressions by hand, and replace the crop top and micro skirt.
- **Shipping candidates: Female_Adult_01 + Male_Adult_04** (Rocketbox, MIT). Rendered in `chosen_teachers_f01_m04.png`. Outstanding defect: **M04's hair seams** where alpha cards overlap.
- **Jake (`a69c8962`) is parked, not dead.** Best-looking candidate in the programme; viable if Aristo ever runs one teacher, or if a matching female gets commissioned or bought. Needs: 8 CC visemes mapped or sculpted up to 15, and a CC4 retarget.

## Open
- Not done yet: lab page (`pages/dev/avatar-lab.tsx`), GLB export + compressed sizes, 3-clip retarget, lipsync with demo narration.
- The generate-and-rig pipeline run (Meshy/Tripo -> AccuRIG) was skipped by Hmz on 2026-09-18.

## V9.1b — the Canino pair is usable (2026-09-20/21)

**The blocker is solved. Both teachers export, animate and lip-sync in the app.** Judged in
`/dev/avatar-lab`, not in renders.

### The woman: the FBX defect is local, so the shape keys transfer

The premise that "neither file has both a good body and a face rig" was right, but the FBX is
much less broken than it looked. Fitting the FBX rest skeleton onto the GLB one
(`scripts/v9_face.py::fit_armatures`, similarity fit + outlier rejection) lands **92 of 101 bones
at exactly zero residual**. The nine that miss are the whole story:

| bone | error |
|---|---|
| `CC_Base_UpperJaw` | 2.48 m (stray) |
| `L/R_Forearm`, `L/R_ElbowShareBone`, `L/R_ForearmTwist01` | 0.36–0.38 m |
| `L/R_UpperarmTwist02` | 0.18 m |

So the damage is the forearm chain, nothing else. Comparing the meshes confirms it — per GLB body
part, nearest-neighbour distance to the FBX body:

| part | mean | max |
|---|---|---|
| **Head** | 0.000001 m | **0.00066 m** |
| Body / Leg / Nails / Eyelash | 0.000001 m | 0.000001 m |
| Arm | 0.0017 m | 0.054 m |

The head is identical to within 0.66 mm, so **the face deltas are valid and transfer exactly**.
68 of 68 shapes landed on the GLB head with zero unmatched vertices, plus eyelash, tongue,
tearline and eye-occlusion sets. Route 1 worked; routes 2 and 3 were never needed, and nothing
had to be sculpted.

### 15 visemes, baked, so Teacher.tsx needs no changes

The listing's "8 CC visemes" understates the rig: there are **68 usable face shapes**. CC's own
`Open` viseme only moves the lips **3.3 mm** — the real jaw drop is the expression shape
`Mouth_Open` at **16.3 mm**. A naive 15 → 8 name map therefore produces a mouth that never opens,
which settles the question in the brief: **neither map nor sculpt — bake.**

`scripts/v9_face.py::RECIPES` composes the 15 Oculus names plus `mouthSmile`,
`eyeBlinkLeft`/`eyeBlinkRight` as weighted sums of CC shapes, written as real shape keys. Blender
exports shape-key names into `extras.targetNames`, three.js reads them into
`morphTargetDictionary`, and `Teacher.tsx` already resolves morphs by name across every skinned
mesh — so **the app drives these rigs unmodified**. It also cut morph targets from 69 to 17.
`viseme_sil` is dropped: it is zero-delta by definition and `lerpMorphTarget` skips a morph it
cannot find.

Same bake applied to Jake directly — his geometry is sound (forearms and hands verified by render,
`jake_body_and_hand.png`) and he shares MJ's base topology, so no transfer was needed.

### Retarget: copy the delta, not the direction

The earlier crumple-to-40% was the expected result of copying world-space bone *directions*. What
works is the rotation **delta** relative to each rig's own rest pose, replayed on the target's rest
pose, written into `matrix_basis` parents-first (`scripts/v9_retarget.py`). All **52 mapped bones
resolve on both rigs, nothing missing**. Twist and share bones are deliberately unmapped — driving
them from the parent's delta double-counts and corkscrews the forearm; an identity-basis bone
carries its parent's delta unchanged, so their rest frames cancel. Idle, Talking and Pointing baked
for both. Verified by render, not by numbers: `retarget_jake_idle.png`, `retarget_mj_clips.png`.

### Wardrobe

Her crop top and micro skirt are gone. Rather than fit a donor garment (shrinkwrap, weight
transfer, and a style clash with Jake), her own meshes were extended: the tee grown to hip length
and projected onto the body, the skirt to just below the knee. Both are near-flat colour so the UV
stretch is invisible. New vertices are re-weighted from the nearest body vertex — extrusion
inherits the hem's weights, which would otherwise pin the shirt tail to the ribcage.

Two traps: the skirt is **139 disconnected pleat panels**, so the hem selection must exclude
near-vertical panel side edges and smoothing must be off, or the hem comes out slashed. And the
white triangles at the waistband were the **panties mesh** poking through — hidden, never visible
under a knee-length skirt.

### Export and budget

Normalised to Marcus's height (1.859 m with his root scale divided out) so the lesson camera and
`scale={1.5}` placement work unchanged. Draco, not meshopt — the app wires
`useGLTF.setDecoderPath("/draco/")` and has no meshopt decoder.

| | tris before | tris after | raw GLB | shipped |
|---|---|---|---|---|
| Jake | 105,357 | 52,679 | 33.5 MB | **2.69 MB** |
| MJ | 59,837 | 32,652 | 18.1 MB | **1.87 MB** |
| _Marcus (control)_ | _34,500_ | — | — | _9.18 MB_ |

Both ship smaller than the avatar in production today. Geometry was only ~5 MB of the raw file;
the rest was textures (WebP, 1024 px). Decimation is partial on purpose: Blender's Decimate
refuses a mesh with shape keys, and on these rigs the whole body including the face is one such
mesh — so hair, clothing and shoes took the reduction and the face was left alone.

### Judged in the app

`pages/dev/avatar-lab.tsx` + `src/components/dev/AvatarLab.tsx` (Pages Router, dev-only, 404s in
production). Loads the GLB as `/learn` does and drives the mouth from `src/lib/lipsync/visemes.ts`
against the demo narration and its alignment sidecars. Confirmed in the browser for both teachers:

- Draco decodes; **all 17 morph targets present with the exact names the app drives**
- `Idle, Talking, Pointing` all load and play on the CC4 skeleton
- Alignment parses (72/73 spans) and the mouth moves through `viseme_RR → O → nn → PP → E` in time
  with the audio

### Known defects (not blockers)

- **MJ's skirt shows faint vertical seams** where the 139 pleat panels meet — visible at lesson
  distance in `v91_pair_lesson_framing.png`. Welding the panels or a small overlap would fix it.
- **A hairline seam across MJ's forehead** where the scalp mesh meets the face, in the source asset.
- `viseme_I` and `viseme_nn` are the weakest of the 15; tuned once already, still subtle.
- Four empty scenes ride along in each GLB (`gltf-transform prune` leaves them). The default scene
  index is correct (4 = `V9_bakeoff`), so three.js loads the right one.
- Both GLBs carry a 2 m material-less icosphere risk: it was caught and removed, but note that
  `select_all(DESELECT)` does **not** deselect hidden objects, which is how it got in.

### Not done

- No `AVATAR_ASSETS` entry yet — adding Jake/MJ to `Teacher.tsx` is a deliberate next step, not an
  accident. They need `visemes: true`, `animFile` pointing at their own GLB, and a `spawnLabelHeight`.
- Licence: Canino3d is **CC-BY 4.0** — attribution is required wherever these ship. Not yet written
  into the app.

## V9.1c — audit of V9.1b, then wiring (2026-09-22)

**Verdict: the V9.1b rigs were not shippable, and the report above overstated them.** Everything
below was found by looking at renders and at three.js in the running app, then fixed and re-shipped.
Evidence renders in `.claude/eval/2026-09-18-v9-bakeoff/` (`retarget_v2_*`, `v91c_*`, `audit_mouth_*`).

### What was overstated

| V9.1b claim | What was actually true |
|---|---|
| "Retarget works … verified by render" | Both teachers had **both arms swept behind the back in every clip**. It shows in V9.1b's own evidence renders (`retarget_*_idle.png`, `v91_pair_lesson_framing.png`). |
| "Idle, Talking, Pointing all load and play" | They loaded. **Five of six clips were frozen stills** (2 keys, zero variation): Jake's Talking/Pointing and all three of MJ's. Pointing never pointed. |
| MJ 32.6k tris, "the face was left alone" | The budget came from collapse-decimating everything else: **teeth 2,362 → 1,056 (jagged shards), hair 9,176 → 4,105 (floating flakes), tee 2,824 → 1,650 (faceted, with holes)**. |
| Eyes render correctly | They looked right only by accident. **MJ's right eyeball was MASK with base alpha 0**, so every fragment was discarded; the cornea shell carried the eye texture over the hole. |
| Visemes judged in the lab | The lab loads the GLB directly and never went near `Teacher.tsx`, the real lighting or the lesson camera. |

### Root causes and fixes

- **Rest-pose mismatch (arms).** Mixamo rests in a T-pose (upper arm 0.3° below horizontal); CC4 in
  an A-pose (30° down, 15° forward). Copying the delta relative to each rig's own rest is only valid
  when the two rests match, so every arms-down clip added 30° past vertical. Fix:
  `v9_retarget.rest_alignment` swings each *limb* bone onto the source's rest direction first (upper
  arm 33°, clavicle 31°, hand 28°). Hip/spine/head are excluded on purpose: aligning the hip gave a
  23° pelvis tilt that was anatomy, not pose.
- **Frozen clips.** `v9_export.export()` sets `hide_viewport = hide_render` on every object; that
  hid the Mixamo source rig, and Blender's depsgraph does not evaluate a viewport-disabled object, so
  every later bake read one still pose. `retarget_action` now un-hides both rigs and **raises if the
  source hand never moves**.
- **Root translation.** Tested in isolation: moving the source hips by a known vector lands the target
  hips on the ratio-scaled vector with **0.0 mm error** on both rigs. It is moot for these clips — the
  Avaturn clips carry no hip translation — so there is no drift or pop (loop seams ≤ 0.31°).
- **MJ rebuilt from undecimated meshes.** An untouched import of her GLB was still in the scene; the
  damaged meshes were replaced from it (similarity transform solved from the head, 0.18 µm residual)
  and the tee re-grown from the clean mesh. **No decimation anywhere now** (`budget=None`).
- **Hidden-skin masking instead** (`scripts/v9_mask.py`): body faces a garment covers are deleted,
  shape keys preserved. It fixed Jake's shoulder poking through his shirt, MJ's torso through her
  tee, and a patch of *head-mesh* skin (CC4's head material reaches the upper chest) through her tee.
  Jake's body 28,092 → 18,258 tris.
- **Materials** (`scripts/v9_postprocess.mjs`): teeth, tongue and eyeballs BLEND → OPAQUE (GLTFLoader
  turns BLEND into depthWrite off); MJ's right eye fixed; MJ's lashes were an opaque black slab with
  no opacity map, now use Jake's lash texture (same CC base UVs); Jake's trousers metallic 1 → 0;
  **every material exported with `specularColorFactor` [2,2,2]** (double F0), which turned dark fabric
  grey and skin plasticky — dropped except on corneas. Eye-occlusion meshes (alpha 0) and a hidden
  undergarment are dropped; the 4–12 empty scenes are gone.
- **Skirt.** Panel seams welded (293 pairs; 75% of panel edges already touched at 0 mm) after
  orienting all faces outward — welding mixed-winding faces averages normals to zero. The waistband
  was pushed out 8 mm median to clear the tee.

### Visemes

Judged at full weight in close-up (`audit_mouth_closeup.png`, before; `audit_mouth_ss_i_v2.png`, after)
and in motion in `/demo` against the heart narration.

- **SS was wrong**: lips closed. /s/ is teeth together behind parted lips. **I was a closed slit.**
  Both now add a share of `viseme_DD` (jaw + lip part + tongue up); `RECIPES` updated so a re-bake
  reproduces it. PP, FF, CH, U read right. TH works on Jake (tongue between the teeth); on MJ only a
  sliver of tongue shows — left as is.
- **At lesson distance only jaw-driven shapes read** (aa, E, O). I, nn, SS, DD, kk read in close-up
  only. That is the camera (face ~70 px tall at 1440 wide), true of Marcus too, not these recipes.
- The weights are still one person's judgment, now checked against articulation, not measured.

### Budget

| | V9.1b shipped | V9.1c shipped |
|---|---|---|
| Jake | 52.7k tris, 2.69 MB, clips frozen | **42.8k tris, 2.49 MB** |
| MJ | 32.0k tris, 1.87 MB, damaged | **53.3k tris, 2.21 MB** |
| _Marcus_ | _34.5k, 9.18 MB_ | |

**Accepted, no simplify.** One teacher renders at a time, and triangles are not the bottleneck on any
GPU this targets; the visible cost of reduction was the whole problem. gltf-transform `simplify` was
not tried on the face: the head is where quality has to survive. If mobile needs it later, MJ's boots
(8.8k) are the safe target.

### Wiring

- `jake`, `mj` in `TeacherAvatar`, `AVATAR_ASSETS` (own GLB as `animFile`, `visemes: true`,
  `pbrMaterials: true`, **`spawnLabelHeight: 1.4`**, chosen by looking: 1.25 put the label at MJ's
  waist because her stylised head shifts proportions), the switcher, the voice map (jake → marcus
  voice, mj → priya voice, until they get their own) and `/dev/free-model?avatar=`.
- **Blink fix for every ARKit rig**: `eyeClose` drove only `eyeBlinkLeft`, so Marcus and Priya have
  been winking. Now both eyes.
- `/dev/free-model?state=thinking|talking|pointing` holds a teacher in one state for judging.

### Attribution (CC BY 4.0)

Titles and author confirmed from Sketchfab's public API:
"Free Cartoon Game Man Character (Rigged)" and "Free Stylized Cartoon Girl Rigged Character" by
Canino3d. Placed **next to the avatar, wherever it renders**: `AVATAR_ASSETS[*].credit` →
`<AvatarCredit>` in the `/learn` panel (always on screen with the teacher) and the `/demo` panel. The
credit lives on the avatar's config entry, so a new CC-BY avatar cannot ship without declaring one.
It is also written into each GLB's `asset.copyright`, because `/models/*.glb` is publicly fetchable.

### Checked where

- `/dev/free-model` (the real `AristoCanvas`, lighting and lesson camera): both teachers in thinking
  and talking, label height, materials.
- `/demo` with Jake swapped in temporarily: credit line renders, Talking plays in time with the
  narration, camera moves fine. Reverted — the demo still runs Marcus.
- **`/learn` not checked**: it needs Hmz's login. The credit component is the same one verified in
  `/demo`.

### Still open

- MJ's skirt shows darker pleat-fold patches under the app's lighting. Present in the V9.1b build
  too; cosmetic.
- MJ's forehead scalp seam (source asset) — not fixed.
- Hair cards clip the tee at the shoulder in some poses (normal for card hair).
- No Thinking, Nodding or ShakeNo clips: thinking plays Idle, feedback gestures fall back to idle.
  Retargeting more Avaturn clips is now cheap (`retarget_action` per clip).

### Follow-up, same day: Jake and MJ become the roster

Hmz's call after the audit: Jake runs the demo, both new teachers are offered in `/learn` and
`/demo`, and the old four are archived.

- **Why `/learn` showed only the old four:** Jake and MJ were there, but the switcher row was capped
  at 260 px with 423 px of content and a hidden scrollbar, so they sat off-screen to the right.
- **Archived, not deleted:** `ACTIVE_TEACHERS = ["jake", "mj"]` in `useAristoStore.ts` drives both
  pickers. Ryan, Sonia, Marcus and Priya keep their `AVATAR_ASSETS` entries and GLBs (restore by
  listing them again). A persisted session holding one of them lands on `DEFAULT_TEACHER`, now
  **jake**. Ryan remains the error-boundary fallback if a teacher GLB fails to load.
- Sign-in prefetch is now one file (`Teacher_Jake.glb`, clips embedded) instead of Marcus plus the
  11.6 MB Avaturn pack.
- `/demo` opens on Jake and has a Jake / MJ switcher with the credit line under it. **The narration is
  a single pre-rendered male voice (Antoni)**, so MJ lip-syncs a man's voice there. A female narration
  is 6,856 ElevenLabs characters for both topics (dry-run count, nothing sent), plus a per-voice
  folder in the player. Not done: it is spend.
- Checked in Hmz's signed-in `/learn` (switcher only, no lesson started): Jake, MJ, + Create, no
  clipping, credit swaps with the avatar, the old persisted choice remapped to jake. Checked `/demo`
  with both teachers.

## V9.1d — motion QA, then MJ's wardrobe against a written bar (2026-09-22/23)

**Verdict: motion passes after fixes. MJ's wardrobe fails the bar and needs Hmz's pick. Part 3
(more clips) not started: it was gated on both.** Evidence in `.claude/eval/2026-09-18-v9-bakeoff/`:
`v91d_retarget_facing_fix.png`, `v91d_mj_elbow_share.png`, `v91d_mj_wardrobe_options.png`.
Method: frame strips at every 4th frame (source Marcus beside each teacher; the lesson camera, a
three-quarter view on a plain floor, and cameras that track each wrist, shoulder and the feet;
`scripts/v9_strip.py`), numbers read off the rigs, then three.js in `/dev/free-model` and `/demo`.

### What V9.1c got wrong (all fixed and re-shipped)

| V9.1c state | Found by | Fix |
|---|---|---|
| Arms and hands 13–20° off the source in every clip; hands palm-up where Marcus is palm-down, up to 11 cm out | wrist strips beside the source, then bone-direction comparison | The bake ran with the teachers turned to the app facing (rotZ 0.3) and the source facing front, and world-space deltas rotated with it. The shipped Talking is **bit-identical** to a bake made that way, so this was the cause. `facing_map` now conjugates by the yaw difference: every limb and finger is **≤ 0.1°** from the source in all three clips, and placement no longer matters (rotated vs unrotated bake: 0.000°). |
| Feet pitched ~15° toe-down: heels 4–7 cm off the floor, toes 4–12 mm into it | foot pitch vs rest, sole heights per frame | Mixamo's foot bone aims 28° down to the ball, CC4's 11–14°. That is anatomy, like the pelvis. Feet now take only the yaw of the rest swing (`YAW_ONLY`). |
| With flat feet, the feet floated 1–6 cm | sole heights per frame | Inherited: the Avaturn clips pin the hips at rest height while the legs pose, so **Marcus's own feet rise 1.2–3.2 cm** (he stands 2 cm into the floor, which hid it). `ground()` lowers the hips per frame so the lower foot keeps its rest contact. MJ's lower sole now stays within ±3 mm. |
| Jake's rest soles 30 mm above the floor (45 mm in the app); both teachers off Marcus's mark | per-mesh rest bounds | `normalise` measured skinned bounds in whatever pose was showing. It now measures in the rest pose and puts the hip joint on Marcus's hip (0, −14 mm) instead of the bounding-box centre, which had put Jake 8 cm behind Marcus. Scale changed ±0.9%. |
| Hard skin step inside MJ's elbow when it bends (Talking) | tracking close-up | `ElbowShareBone` followed the forearm fully. `drive_helpers` sets Elbow/KneeShare halfway between the limb bones and gives `ForearmTwist01/02` **25% / 60% of the hand's roll** (a fraction, never the parent's delta). |
| Skin through Jake's right cuff, up to 4 mm (Talking 49–65; present in the V9.1c bake too) | cuff close-ups, then `v9_mask.find_pokes` over every frame | His shirt's right sleeve is weighted to a group named `R_ElbowShareBone` that mirrors the left sleeve's `ForearmTwist01` to 0.01 weight: a mislabel in the source asset, harmless until the share bone is driven. Renamed; one wrist vertex pushed 2 mm under. **Zero skin-through-cloth vertices on Jake in any frame of the three clips.** |
| One-frame 33° arm pop on Talking → Pointing; Idle frozen after any nod | per-frame bone rotation logged in the running app (30 fps) | `Teacher.tsx`: the play effect had `gesture` in its deps, so a gesture change re-ran it for the clip still playing and `reset()` snapped it to frame 0. For avatars with no Nodding clip (Jake, MJ, Ryan, Sonia) a nod falls back to the Idle already playing, and the re-run switched it to `LoopOnce` for good: bone motion 0.086°/frame before a nod, 0.003 after (measured on the old code). The gesture is now read through a ref, and non-one-shot clips get their loop mode back. |

The shirt-group rename and the body push are in the working scene, not a script (one-off asset
repairs). Sizes after re-ship: Jake 2.54 MB (was 2.49), MJ 2.27 MB (was 2.21); the growth is the
helper-bone channels. All 17 morph targets present on both, checked in three.js.

### Checked and passing

- **Wrists and forearms:** no candy-wrapper in Talking at up to 96° of hand roll, close up and at
  lesson distance, both teachers.
- **Hands and fingers:** a relaxed curl matching Marcus frame for frame; no claw, no paddle. After
  the rest swing the palm normal is within 3.6–5.1° of Mixamo's.
- **Shoulders:** no hunch or drop, no cloth or skin collapse. Pointing lifts the arm forward
  across the body, so the armpit never opens in these clips.
- **Feet:** flat, planted, no sinking. Foot slide is the source's own (toes travel 1.2 cm in Idle
  and 5.5 cm in Talking with the hips fixed); the lesson camera cuts off at the shins.
- **Knees:** Talking holds a 34° knee bend. That is the source clip (matched to 0.0°); Jake's slim
  trousers show it more than Marcus's suit does.
- **Loop points:** hip jump from last frame to first ≤ 0.04 mm; rotation seams equal the source's
  own (0.28° Talking, 0.37° Pointing); no pop in the strips.
- **Pointing lands:** measured in three.js, the finger ray meets the diagram plane at x −0.20
  (Jake), −0.31 (MJ) and −0.40 (Marcus), against the image's left edge at −0.36, all at
  y ≈ 0.6–0.7. **Jake and MJ land inside the image's upper-left, Marcus just outside it.** The
  three aim within 2° of each other. Anchor unchanged.
- **Transitions** (Idle → Talking → Pointing → Idle, three trials each, both teachers): no
  isolated spikes after the fix, no T-pose frame.
- **Face while moving:** blink drives both eyes identically (difference 0.000), the resting smile
  drops to 0 while speaking, and visemes are active on 82% of Talking frames across 11 shapes.
  Nothing new.

### MJ's wardrobe: fails the bar

Judged in three.js (`/demo`, plus a free camera in the running app) and in Eevee, all three clips.

| Bar item | Tee (extended crop top) | Skirt (extended micro skirt) |
|---|---|---|
| 1 skin through | torso skin through tee/skirt at 22 vertices, up to 7.3 mm | **legs show through open slits as thin orange lines**, every frame |
| 2 garment through garment | tee through the skirt waistband at 15 vertices, up to 20 mm | — |
| 3 faceting, holes, slashed hems | 464 faces with zero UV area under a normal map | **jagged hem** (139 panel ends at different heights); 676 of 1,244 faces with zero UV area |
| 4 hem reads as a hem | **the old crop hem shows as a ridge with a shading step**: reads as a crop top over a white bodysuit | — |
| 5 moves without tearing or tenting | projected skin-tight onto the waist | wide bell/tent in every clip |
| 6 dark blotches | — | **not acceptable**: rectangles of baked pleat shading stretched down the zero-UV extension read as tears at lesson distance |
| 7 same artist, age-appropriate | the skin-tight tee reads as body paint | — |

The root causes are modelling, not weights or normals: the skirt is 139 separate panels that
flare apart, the grown rings copied the hem's UVs, and the tee's extension starts below the old
rolled hem. So, per the brief, this stopped at options, rendered in `v91d_mj_wardrobe_options.png`
(rows: current, A, B; each at lesson framing and three-quarter; Idle ×2, Talking ×2, Pointing):

- **A. Rebuilt pleated skirt (recommended).** One continuous tube from 1.10 m to below the knee,
  sized from her body's cross-section, 16 knife pleats, real UVs, flat navy, weights folded into
  thigh and hip so a wide stance swings it instead of tearing it (`scripts/v9_skirt.py`,
  reproducible). Automated checks on every third frame of all three clips: **0 legs through the
  skirt, 0 torso through tee or skirt, 1 tee vertex through the waistband** (a spot fix).
  +3.5k tris. Keeps her look. Still to do if picked: the tee (remove the old rolled hem ring
  before growing, loosen the fit, drop or re-UV the normal map), then judging in three.js.
- **B. MPFB CC0 wool trousers** (`toigo_wool_pants`). The quick fit is poor: the MakeHuman cut
  sags into a harem crotch on her stylised body and splits at the calf, and its realistic texture
  clashes with the Canino style. A proper fit is real work.
- Not rendered: the other MPFB CC0 garments (a basic tucked tee, a female tee, the jeans in
  `female_casualsuit01`, cargo trousers) share B's style clash; Jake's own garments would match the
  artist but are cut for a man's body.

The mock-ups sit in the scene's `V91d_options` collection, outside MJ's hierarchy, so no export
can pick them up. **None of the options needs money or an account.**

### Not done

- Part 3 (Thinking, Nodding, ShakeNo): gated on Part 2 passing. The retarget is ready for it.
- The forehead scalp seam and hair clipping the shoulder: unchanged, still listed.
