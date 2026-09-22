# Next session — V9.2: audit the Canino rigs, then wire them into the app

Paste the block below as the first message of the new session.

---

Continue the V9 teacher programme. Read `CLAUDE.md`, `.claude/docs/state.md`, then
`.claude/plans/V9-REPORT.md` — the **"V9.1b"** section at the end is the work you are auditing.
Blender is running with the MCP add-on and
`.claude/eval/2026-09-18-v9-bakeoff/bakeoff_scene.blend` holds the classroom, the app's lesson
camera and lights, and every candidate. Reusable Blender scripts are in that folder's `scripts/`
(`v9_face`, `v9_render`, `v9_clothe`, `v9_retarget`, `v9_export`). `sources/`, `export/` and
`*.blend` are git-ignored.

Two teachers were produced last session and are already installed at `public/models/Teacher_Jake.glb`
(2.69 MB) and `public/models/Teacher_MJ.glb` (1.87 MB), from the Canino3d pair (CC-BY 4.0,
Sketchfab). **Job one is to audit them. Job two is to wire them into the app.** Do not start job
two until job one is done — if the rigs are wrong, the wiring is wasted.

## Part 1 — audit the rigs and visemes

Previous-session claims, each of which you should try to break. Verify by looking at renders and
at the running app, **not** by reading bounding-box numbers — that error cost a candidate earlier
in this programme.

1. **The 15 visemes are baked shape keys, not a runtime map.** `scripts/v9_face.py::RECIPES`
   composes them from Character Creator's 68 face shapes. Both GLBs should carry exactly 17 morph
   targets — `viseme_PP FF TH DD kk CH SS nn RR aa E I O U` plus `mouthSmile`, `eyeBlinkLeft`,
   `eyeBlinkRight`. `viseme_sil` was deliberately dropped as zero-delta (`lerpMorphTarget` in
   `Teacher.tsx` early-returns on an unknown morph). **Judge the 15 in motion against the demo
   narration, not on the contact sheets** (`visemes15_MJ.png`, `visemes15_Jake.png`) — those are
   static and flattering. `viseme_I` and `viseme_nn` were already tuned once and are still the
   weakest; say whether they read at lesson distance or only in close-up.
2. **The recipe weights are one person's judgment, not measured.** Nothing was checked against
   reference phonetics. Challenge any that look wrong, especially `TH` (tongue may be hidden
   behind the teeth) and `SS`.
3. **The retarget copies rotation deltas relative to each rig's own rest pose**
   (`scripts/v9_retarget.py`), which is why it no longer crumples. 52/52 bones map on both rigs;
   twist and share bones are deliberately unmapped. The **root translation** math
   (`tpb.location = rest3.inverted() @ (Mt3_inv @ off)`) was fixed but never isolated-tested —
   check the hips do not drift or pop across `Idle`, `Talking`, `Pointing`.
4. **Materials.** The CC4 eyes use `Std_Cornea_*` with `BLEND` alpha, and earlier candidates in
   this programme had two alpha bugs (a cornea layer transparent only via texture alpha, and an
   opacity material wiring alpha from colour). Confirm the eyes do not render as grey discs or
   dark holes **in three.js**, which is the only place that matters.
5. **Budget.** Jake is 52.7k tris against Marcus's 34.5k, because Blender's Decimate refuses a
   mesh with shape keys and on these rigs the whole body including the face is one such mesh.
   Decide whether that is acceptable or whether `gltf-transform simplify` (which does handle morph
   targets) should take the body down — if you try it, **re-verify all 17 morph targets survive**.

Report what you find plainly, including anything that was overstated.

## Part 2 — wire them into the app (only after the audit)

- **Add `jake` and `mj` to `AVATAR_ASSETS`** in `src/components/three/Teacher.tsx`. They need
  `visemes: true`, `pbrMaterials: true`, `animFile` pointing at **their own GLB** (the clips are
  embedded, not in `animations_Avaturn.glb`), and a `spawnLabelHeight` you pick by looking, not by
  guessing. The `TeacherAvatar` union type must gain both names — find where it is defined; the
  avatar switcher (`src/components/learn/TeacherControls.tsx`) and anything else keyed on that
  union will need to follow.
- **Add the CC-BY 4.0 attribution for Canino3d.** This is a licence obligation, not a nicety —
  it must appear wherever these avatars ship, not only in a doc. Decide where it belongs in the
  product and say why.
- **Check them in `/learn` and `/demo`**, not just the lab. The lab proved the GLB loads, the
  morphs resolve and the clips play; it did not prove they look right in the real lesson scene
  with its lighting, camera moves and the approval gate.

## Fixes worth making if the audit says so

- **MJ's skirt shows faint vertical seams** at lesson distance — it is 139 disconnected pleat
  panels and the extended hems sit slightly apart. Welding or a small overlap should fix it.
- **A hairline seam across MJ's forehead** where the scalp mesh meets the face. This is in the
  source asset, not something the last session introduced.
- Four empty scenes ride along in each GLB; the default scene index is correct (4 = `V9_bakeoff`)
  so three.js loads the right one, but it is cruft.

## Gotchas already paid for — do not rediscover these

- `hide_render` on a parent object does **not** propagate to its children in Blender. Hiding a
  candidate by its ROOT empty leaves every mesh of it in frame. Use `v9_render.solo()`.
- `bpy.ops.object.select_all(action="DESELECT")` does **not** deselect hidden objects, so a
  hidden object left selected rides into a `use_selection=True` glTF export. That is how a
  material-less 2 m icosphere got into the first Jake build.
- Blender's Decimate refuses any mesh that still owns a shape-key datablock, **even one holding
  only Basis**.
- The app wires **Draco** (`useGLTF.setDecoderPath("/draco/")`, self-hosted in `public/draco/`)
  and has **no meshopt decoder**. Compress with Draco or add a decoder first.
- Character Creator's own `Open` viseme moves the lips only 3.3 mm; the real jaw drop is the
  expression shape `Mouth_Open` at 16.3 mm. Any 15 → 8 name map gives a mouth that never opens.
- The teachers are normalised to **1.859 m**, Marcus's height with his root scale divided out, so
  the lesson camera and `scale={1.5}` in `Experience.tsx` work unchanged. Do not renormalise.
- **The Blender scene is currently in "pair render" state**, not export state: both ROOTs were
  re-placed into the classroom, and the NLA tracks were removed and replaced with direct actions.
  `v9_export.export()` restores both (it calls `normalise()` then `stack_nla()`), so re-export
  through it rather than by hand.
- `Teacher_Marcus.glb` contains a material-less 3 m icosphere; hide it in renders.
- The classroom's warm wall patch is baked into its texture, and no mesh in the app casts shadows.

## Running it

`.claude/launch.json` defines `aristo-dev` (`yarn dev`, port 3000). The lab is at
`/dev/avatar-lab` — Pages Router, dev-only, 404s in production. It has candidate and framing
toggles (lesson / face), the three clips, the pre-rendered demo narration with its alignment
sidecars, and a live readout of the current viseme and the loaded morph targets.

**Ground rules:** verify by rendering and by running the app, not by reading numbers. Stop and ask
before any spend, any account-gated download, or anything needing my login. Package manager is
**yarn**. Update `.claude/plans/V9-REPORT.md` and `.claude/docs/state.md` at the end.

**One open call for me, not for you:** `.claude/eval/2026-09-18-v9-bakeoff/` holds ~64 MB of PNG
renders and is still untracked. Ask me whether it goes into git before committing anything in it.
