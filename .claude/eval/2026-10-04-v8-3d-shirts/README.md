# V8.3d: softer, looser teacher shirts (2026-10-04)

Hmz's ask: Jake's and MJ's shirts (1) in a pastel palette instead of V8.3c's forest and plum, (2) not skin tight: a
looser fit that reads as fabric, with folds and a matte cloth look. Plan: `~/.claude/plans/jazzy-discovering-balloon.md`
(approved). Hmz's choices before the build: Jake untucked with a straight hem, MJ untucked over the skirt, a relaxed
fit. Branch `dev/v8-3d-shirts` off `origin/deploy-prep`. No paid generation anywhere (0 API calls in every capture).

## Stops

| Stop | Evidence | Status |
|---|---|---|
| A2. Pastel candidates | `sheet-a2/sheet-jake.webp`, `sheet-a2/sheet-mj.webp`, `sheet-a2/pairs.webp`, `sheet-a2/results.json` | shown to Hmz |
| Looser fit | `blender/` (drafts), `sheets/*-before-after.webp` | shown to Hmz |
| QA | `qa/qa-*.json` (new and shipped), `sheets/*-peaks-*.webp`, `*-joints-*.webp`, `*-hem.webp`, `qa/pokes/` | shown to Hmz |

## A2: the pastel candidates

Captured by the live landing stage (`?shirt=`, dev only), as sheet A: the picture spot's end on the light page and on
the ink, and the room's end against the classroom wall. New: each colour is **solved** first. The lit shirt does not
render as the hex it is given, so the script renders it, averages the shirt's pixels in linear light (mask from a pure
green render of the same frame), corrects the hex per channel, and repeats until the render is within dE00 2.6 of the
swatch. The tile shows the colour as seen; "code" is what goes in `AVATAR_ASSETS.*.outfit`.

"Separates" = the rendered colour's WCAG ratio >= 1.3 and CIEDE2000 >= 12 against both white (the diagram) and the
light page #F3F4F6. Every candidate is far from the ink (9.4 to 13.7:1) and from the room wall (2.0 to 2.9:1).

| Teacher | Name | Swatch | Code | Renders (dE) | vs white ratio / dE | vs page ratio / dE | vs wall | vs ink | Separates |
|---|---|---|---|---|---|---|---|---|---|
| Jake | sage | #A9C6A4 | #7FAA75 | #AFCDAA (1.75) | 1.73 / 21.6 | 1.57 / 21 | 2.33 | 10.92 | yes |
| Jake | powder blue | #A6C1DD | #759BD0 | #A9C4DF (0.85) | 1.8 / 18.6 | 1.64 / 16.4 | 2.24 | 10.48 | yes |
| Jake | seafoam | #9ED2C6 | #62BAA0 | #A4D5CA (1.15) | 1.62 / 20.3 | 1.47 / 19.2 | 2.49 | 11.65 | yes |
| Jake | periwinkle | #A9B3E3 | #808CE0 | #AFB8E4 (1.66) | 1.94 / 22.4 | 1.77 / 20.1 | 2.07 | 9.72 | yes |
| Jake | butter | #EBD891 | #F7C550 | #EADB98 (1.47) | 1.39 / 21.2 | 1.27 / 22 | 2.9 | 13.57 | no |
| Jake | dusty lilac | #BFAED6 | #A285C6 | #C5B3DB (1.43) | 1.94 / 23 | 1.76 / 21 | 2.08 | 9.76 | yes |
| MJ | lavender | #C3B1E1 | #AA8CDF | #C8B7E2 (1.96) | 1.85 / 22.6 | 1.68 / 20.6 | 2.18 | 10.19 | yes |
| MJ | mint | #A8DCC4 | #6ED49E | #B2DDC8 (2.15) | 1.49 / 19.4 | 1.36 / 18.8 | 2.7 | 12.66 | yes |
| MJ | sky | #A5CDE8 | #6EB4F2 | #ABD0E6 (1.82) | 1.63 / 17.4 | 1.48 / 15.4 | 2.48 | 11.61 | yes |
| MJ | periwinkle | #A3B4E8 | #758CF1 | #A6B6E7 (0.85) | 2.01 / 23.6 | 1.82 / 21.4 | 2.01 | 9.42 | yes |
| MJ | butter | #F0DC8C | #FFD348 | #E9DD95 (2.63) | 1.38 / 21.8 | 1.25 / 22.6 | 2.93 | 13.72 | no |
| MJ | lilac grey | #C9BEDC | #B69ED5 | #CEC4DE (1.96) | 1.67 / 17.2 | 1.52 / 15.3 | 2.42 | 11.32 | yes |

Butter fails on both teachers (1.27 and 1.25 against the page). Pairs (`pairs.cjs`, dE00 between the two renders,
>= 20 = clearly different): Jake sage + MJ periwinkle 32.2, sage + lavender 31.6, dusty lilac + mint 30.6, seafoam +
lavender 29.2, sage + lilac grey 28.0, periwinkle + mint 27.8. Too close: dusty lilac + lavender 1.4, seafoam + mint
4.4, powder blue + sky 4.9. MJ's skirt is a blue-grey navy: sky and periwinkle sit close to it, lavender and mint stand
apart. None is near the one orange (#F97B2F) or MJ's red hair.

The codes were solved on the V8.3c shirt (roughness 0.55, no sheen). The new cloth reads differently, so the picked
pair is solved again on the shipped GLBs (`scripts/shirts.cjs` with only those two).

## The looser fit (Blender)

`../2026-09-18-v9-bakeoff/scripts/v9_loose.py` (the build), `v9_fabric.py` (folds and weave, baked), and
`v9_loose_qa.py`, `v9_loose_sheets.py` (QA, headless). Both re-run from the V8.3c mesh, kept as `<mesh>_v83c`.

- **Cut and regrow** (v9_tee's method): each shirt is cut above the waist and its lower part regrown as rings on a
  hanging envelope. Eight drafts tried easing Jake's own tucked bottom instead; it kept the old hem as a band, because
  his source ends in a sculpted tuck ridge, then the cloth pulled in, then a turned-in facing whose free edge is the
  mesh's boundary.
- **One plumb axis** (the mean of the spine heads): a per-slice centre and the spine's lumbar curve both put false
  bumps in the cloth (1 to 2 cm).
- **Ease**: chest 10 mm, waist 25 mm (Jake) / 28 mm (MJ), less at the sides (the hanging arm presses there); the cloth
  narrows no faster than 10 to 12 cm per metre at the front, 16 at the back, and follows the body at the sides. Sleeves
  5 to 9 mm (Jake, blousing above a cuff drawn back in), 8 to 16 mm (MJ), a third of that on the underside.
- **Hem**: Jake to about 7 cm below his waistband, 2.5 cm longer at front and back (a shirt-tail curve), 13 mm clear of
  the trousers; MJ about 5 cm over the skirt, an A-line at the front and back only. Jake's three lowest buttons, which
  the cut removes, are copied back down the placket at the source's spacing.
- **Weights**: moved vertices keep theirs; regrown ones from the source's 12 nearest (inverse distance); the loose lower
  torso smoothed over the mesh.
- **Folds**: geometric drape waves (outward only) toward the hem and stacked rings above Jake's cuffs; fine folds
  (ridged noise: drape, waist, armpit pulls, inner elbow, cuffs, MJ's sleeve hem) baked into one normal map per shirt
  (2048, shipped at 1024). Collar, placket, buttons and any face with another layer within 12 mm are flat in the map
  (the bake's rays met the other layer there); unbaked texels and misses (tilt over 22 degrees) are flat too.
- **No weave**: asked for, tried, dropped. A weave fine enough for shirting is under four texels even at 2048 (a 3 mm
  period); it baked as moire and the miss clamp flattened patches of it (`blender/jake_final_close.webp`). The matte
  cloth comes from the material. Options if Hmz wants it: a coarser canvas-like weave, or a tiling detail map in the
  shader (it would need a pass beside the landing's dissolve patch).
- **Material**: no colour map (Jake's painted folds belonged to the tight shirt), roughness 0.88, sheen 0.5 (sheen
  roughness 0.5), double-sided. `outfit.ts` gives the sheen the shirt's own colour, halfway to white, at 0.35: Blender's
  exporter writes the sheen tint as the colour and drops the weight.
- **Spike guard**: `loosen` reports how far the eased upper part sits from the source surface. A flap 5 cm out behind
  MJ's right shoulder (the envelope smoothing reaching across the shoulder outline) was found on the peak sheets and
  fixed; the guard now reads max 30.7 mm (Jake) and 36.5 mm (MJ), none over 40 mm.

## Round 2 (Hmz, 2026-10-05): sage + lavender; Jake's sleeves, the arms, the V

Hmz picked **Jake sage + MJ lavender**, and on the fit: "the sleeves for Jake can be a little shorter, the arm looks a
bit too tight and deformed, and I don't like how the V is showing in both of their torso lower halves".

- **The V**: the front hung flat while the sides were pulled in fast (a narrow cos^4 side term at 0.8 per metre), so
  the lower front read as a wedge. Now cos^2 at 0.25 per metre and the envelopes smoothed over 30 degrees, not 14:
  a round section (`blender/jake_r2_idle.webp`, `mj_r2_idle.webp`).
- **Jake's arms**: the underside kept a third of the ease (an oval sleeve) and the forearm carried stacked rings and a
  cuff gather (lumps). Now an even 12 to 14 mm, the underside keeps 70%, a gentle taper into the cuff, no rings.
- **Jake's sleeves 3 cm shorter**: the forearm part slides up the arm, most at the cuff. The forearm skin under the
  sleeve had been deleted in V9.1c (`v9_mask.mask_under`), so `v9_loose.restore_skin` puts 233 faces back from the
  same body before the mask (`bakeoff_scene_pre_v91c.blend`, same local coordinates), welded, with the donor's
  weights and UVs and the basis position in every shape key (`blender/wrists.webp`: closed in two poses).
- **Buttons ride the cloth**: each button island moves rigidly with its nearest cloth vertex; the cuff buttons had
  come off the shortened sleeve and floated below the cuff.

## QA (Blender, before showing Hmz)

`v9_loose_qa.run`: every 2nd frame of all 34 clips in `CANINO_CLIP_SET` (the 17 Mixamo clips and all 17 hand-keyed
ones; LICENSES.md said 13), per side (the teacher's left is +x), on the new shirts and, for comparison, on the V8.3c
shirts (`baseline=True`). The new meshes are about 3x denser, so the counts of the two cloth checks scale with that.

| Check | Jake new L/R (worst) | Jake shipped | MJ new L/R (worst) | MJ shipped |
|---|---|---|---|---|
| skin: body skin through the shirt | 2/0 (59 mm) | 1/0 (49 mm) | 2/0 (59 mm) | 10/0 (60 mm) |
| under: trousers or skirt through the hem | 0/0 | 0/9 (0.8 mm) | 0/0 | 11/21 (1.3 mm) |
| arm: torso cloth inside the arm skin | 0/0 | 0/0 | 1204/264 (24 mm) | 290/65 (21 mm) |
| cloth: sleeve and torso cloth through each other | 3972/3160 (30 mm cap) | 722/501 | 5343/3991 (30 mm cap) | 1432/941 |

- **skin**: the 50 to 60 mm single-vertex events (Jake Talking2M and Talking4, MJ Talking2M) do not reproduce when the
  frame is evaluated alone (`v9_loose_qa.which`) and their depth is the probe crossing the body; the shipped shirts
  have the same kind. MJ HoldIdea frame 21, 2.8 mm: a vertex of her inner upper arm in the armpit, under the sleeve;
  not visible from the front or either side (`qa/pokes/MJ_HoldIdea_21.webp`).
- **under**: the new hems cover the trousers and skirt in every frame (the shipped ones did not quite).
- **arm, cloth**: all in the armpits, where the arm presses into the torso and the sleeve folds into it, hidden between
  arm and body; the shipped shirts have the same contacts. Allowing for density, about 1.4x (MJ arm) and 1.7x (cloth)
  the shipped amount. The peak and joint sheets show none of it.
- **Symmetry**: the joint sheets put the left elbow, shoulder and armpit beside the mirrored right at every clip's
  peak; no notch, hump or poke on either side. The left/right asymmetry in the counts is the clips' (the shipped
  shirts have it too: Idle is not a symmetric pose).
- Found on the sheets and fixed: a 5 cm flap behind MJ's right shoulder; a crease at her bust apex (the envelope
  switching on at the chest line); moire and patches from a baked weave (dropped). A grey patch on MJ's right shoulder
  blade in some Blender renders is in the shipped tee too, larger: hair-card transparency in Eevee.

Sheets: `sheets/<teacher>-peaks-1..3.webp` (each clip at its peak frame: front, his left, his right, with the four
counts), `-joints-1..3.webp`, `-hem.webp` (Talking4, ShakeNo, WellDone through the clip), `-before-after.webp`.

## Files

| | V8.3c | V8.3d | |
|---|---|---|---|
| Teacher_Jake.glb | 2,283,856 | 2,357,252 | +73 KB: the shirt 2.5k to 7.9k vertices, a 1024 normal map (17 KB) for the painted-fold colour map |
| Teacher_MJ.glb | 1,776,572 | 1,812,956 | +36 KB: the tee 2.9k to 9.0k vertices |
| Teacher_*_clips.glb | | byte-identical | the base clips verify within 0.017 degrees, 0.24 mm (`v9_verify_anim.mjs`) |

Sizes before the copyright string (v9_ship.sh adds the same one as today).
