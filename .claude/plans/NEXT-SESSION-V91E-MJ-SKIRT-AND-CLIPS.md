# Next session — V9.1e: build MJ's new skirt (option A), repair her tee, then more clips

Paste everything below the line into a fresh session. Suggested model: Opus.

---

Continue the V9 teacher programme. Read `CLAUDE.md`, `.claude/docs/state.md`, then the **V9.1d**
section at the end of `.claude/plans/V9-REPORT.md`. Blender is running with the MCP add-on;
`.claude/eval/2026-09-18-v9-bakeoff/bakeoff_scene.blend` holds the classroom, the app's lesson
camera and lights, both teachers, and the Mixamo source rig `MarcusArma`. Scripts are in that
folder's `scripts/` (add it to `sys.path` in Blender and `importlib.reload` after edits).

V9.1d fixed and re-shipped the motion. It found that MJ's extended tee and skirt fail the quality
bar and rendered two free options (`v91d_mj_wardrobe_options.png`). **Hmz picked A: rebuild her
skirt and repair her tee. B (CC0 MPFB trousers) is the fallback, only if A cannot pass the bar.**
Recorded in `.claude/docs/decisions.md`. Job one is A, job two is B only if A fails, job three is
more clips once MJ passes.

Verify by rendering and by running the app. Report plainly, including anything last session got
wrong.

## The bar (unchanged from V9.1d)

At lesson distance and in close-up, in every frame of every clip MJ ships with:

1. no skin, bra or panties showing through or past any garment;
2. no garment through another (tee through skirt, skirt through legs or hands);
3. no faceting, holes, spikes or slashed hems;
4. the tee's hem reads as a hem, and the line where the original crop top ended reads as
   intentional or not at all;
5. the skirt moves with the legs without tearing between them in a wide stance (Idle has one) or
   stretching into a tent;
6. no dark blotches under the app's lighting;
7. she looks dressed by the same artist as Jake: casual, age-appropriate for a teacher of 11–14
   year olds.

Judge 1–6 in three.js, not only in Eevee: three.js showed defects Eevee hid in both V9.1c and V9.1d.

## Part 1 — option A

**Skirt.** The mock-up is `OPT_skirt` in the scene's `V91d_options` collection, built by
`v9_skirt.build(target, z_top=1.10)` and `v9_skirt.weight_and_bind(...)`. The ray-cast target is
`OPT_bodytarget` (MJ's legs `Object_13.001`, torso skin `Object_10.001` and tee `Object_31.001`,
at rest). Rebuild it from the script rather than trusting the mock-up. Then:
- Put it in MJ's export hierarchy: parent it to her armature `Object_4.001` with an Armature
  modifier. `v9_export.export` only takes descendants of `ROOT_canino_girl_GLB` that are not
  `hide_render`.
- Retire the old skirt `Object_39.001` from the export (hide_render, or delete it after the new
  one passes).
- Fix the one tee vertex that pokes through the waistband (19 mm, found by
  `v9_mask.find_pokes("Object_31.001", ["OPT_skirt"], ...)`). `v9_mask.push_under` works on a
  garment as well as on skin.
- The mock-up is plain: flat navy, 16 knife pleats that barely read at lesson distance. Judge it
  against item 7 next to Jake. More pleat depth or a slightly darker hem band are cheap if it
  looks unfinished. Don't reintroduce texture from her old skirt: its baked shading is what made
  the blotches.

**Tee** (`Object_31.001`, grown by `v9_clothe.extend_garment`). Failures to fix:
- The old crop hem shows as a ridge with a shading step (item 4). The extension grew from the
  boundary loop below her rolled hem. Flatten or remove that roll band, or re-grow from above it.
  Most of the tee's lower part now sits under the skirt waistband at 1.10 m, so check what is
  still visible.
- It was projected skin-tight (offset 4 mm), so it reads as body paint (item 7). Loosen it.
- 464 extension faces have zero UV area under a normal map, which gives three.js undefined
  tangents. It's a plain white tee: re-UV the extension, or drop the normal map for this
  material in `v9_postprocess.mjs`.
- Torso skin pokes through the tee at 22 vertices, up to 7.3 mm. Run `find_pokes` on
  `Object_10.001` against the tee and new skirt, then `push_under`.

**Checks before shipping.** Automated, every frame of all shipped clips: `find_pokes` for torso
skin vs tee+skirt, legs vs skirt, tee vs skirt, and arms (`Object_12.001`) vs tee — expect zero.
Frame strips beside Jake with `v9_strip.strip` (lesson camera plus three-quarter view), then
three.js as below. Export with `v9_export.export(..., budget=None)` after
`v9_render.solo("ROOT_canino_girl_GLB", keep=(), hide_always=v9_strip.HIDE + ("Object_39.001",))`,
then `sh .claude/eval/2026-09-18-v9-bakeoff/scripts/v9_ship.sh`. Check the 17 morph targets, the
clip list and the size.

**When A has failed.** Only if, after reasonable fixes (weights, a few rings, normals, UVs), it
still breaks items 1–6 in three.js: the skirt tears or passes through the legs in Idle's wide
stance, or the tee cannot stop showing through. Say which item failed, with a render, then build B.

## Part 2 — option B, only if A failed

`OPT_pants` (MPFB CC0 `toigo_wool_pants`, in `V91d_options`) was a 20-minute fit and looked it:
the crotch sags into harem pants, the calf splits open, and the realistic wool texture clashes
with the Canino style. A proper fit needs:
- a waist rise that meets the tee (no midriff);
- the crotch pulled up to her body;
- the calf split closed or cut off;
- the texture replaced by a flat colour that suits Jake's palette.

The other MPFB CC0 garments are in
`%APPDATA%/Blender Foundation/Blender/5.1/extensions/.user/user_default/mpfb/data/clothes/`
(`cortu_cargo_pants`, jeans in `female_casualsuit01`; check each licence line, most are CC0).
Same checks and bar as A.

## Part 3 — only once MJ passes: more clips

Jake and MJ have Idle, Talking and Pointing. Today thinking plays Idle, and a nod or head-shake
keeps the current Idle with no visible gesture (V9.1d `Teacher.tsx` fix, deliberate). Bake at least
Thinking, Nodding and ShakeNo:

- `v9_retarget.bake_clips(["Thinking", "Nodding", "ShakeNo"])` bakes both teachers. It already
  does the facing fix, the helper bones (elbow/knee share, forearm twist) and per-frame grounding.
  It keeps the frozen-source guard.
- Apply the V9.1d checks to each new clip:
  - bone directions vs source (expect ≤ 0.1°);
  - loop seams;
  - lower sole within a few mm of the floor;
  - wrist, elbow and shoulder strips;
  - `find_pokes` for both teachers;
  - transitions in the app.
- Add them to `CANINO_CLIPS` in `src/components/three/Teacher.tsx` (`thinking: ["Thinking"]`,
  `nodding: ["Nodding"]`, `shaking: ["ShakeNo"]`). Pass the new clip names in the `clips` dict of
  `v9_export.export`, re-export and re-ship.
- **Check the one-shot timing:** `Teacher.tsx` reverts nodding after 2000 ms and shaking after
  1500 ms. Nodding is about 2.6 s and ShakeNo about 3.1 s at 24 fps, so the revert may cut them
  mid-gesture. Watch it in the app and decide whether the timers should follow the clip length.
- Watch the GLB size: each clip adds 303 channels on Jake and 765 on MJ (V9.1d: 2.54 / 2.27 MB
  for three clips).

## Tools and gotchas paid for in V9.1d (do not rediscover)

- **Seeing three.js state.** Add a temporary hook in `RendererConfig` in
  `src/components/three/Experience.tsx`:
  `const three = useThree(); useEffect(() => { window.__v91d = three; window.__v91dStore = useAristoStore; }, [three]);`
  Use it to read bones and morphs and to drive gestures. **Revert it before committing.**
- **Close-ups in three.js.** The CameraController fights any camera you set. Instead, render a
  second camera after the app's render in your own `requestAnimationFrame` loop
  (`gl.render(scene, myCam)`); the canvas then shows your view.
- **The Browser pane hides after `navigate`,** and a hidden page throttles `requestAnimationFrame`
  and never finishes loading. Open each page with `preview_start {url}`, which opens a visible
  tab, then `resize_window` 1440×810 (the lesson framing assumes 16:9). A dev server from another
  session may already hold port 3000; use it by URL. `/dev/free-model` takes 30–60 s to show
  anything.
- **Long Blender calls can drop the MCP socket** ("No data received") while Blender keeps
  rendering. Poll for the output file with a Bash until-loop instead of re-running.
- **`v9_strip.strip`** renders the source beside each teacher at the same frames. A 4th element
  in a camera tuple, `(bone, offset)`, makes the camera track a bone. `v9_strip.SUBJECTS` is a
  module-level dict: remove any test entries you add.
- **Python isn't on PATH** in the Bash tool, and heredocs containing apostrophes fail there. Edit
  files with the Edit/Write tools.
- **MJ's glTF rig** has `_scaleCompensation` bones between most bones and their parents. Solve a
  helper's basis from its actual parent (see `drive_helpers`).
- **Jake's shirt group rename** (`R_ElbowShareBone` → `R_ForearmTwist01`) and the one-vertex body
  push live in the working scene only. `bakeoff_scene_pre_v91d.blend` predates them.
- Still true from V9.1c: don't decimate. Orient faces before welding. `v9_render.solo()` un-hides
  everything under a root, so list deliberately hidden meshes in `hide_always`. Blender doesn't
  evaluate viewport-disabled objects, so un-hide any rig before a bake.

## Parked, do not do

- A female narration for MJ in `/demo` (6,856 ElevenLabs characters). Hmz has parked it.

## Ground rules

Stop and ask before any spend, any account-gated download, or anything needing Hmz's login. Don't
start lessons in `/learn` (paid APIs); `/demo` and the `/dev` pages cost nothing. Package manager
is yarn. Gates before committing: `yarn type-check`, `yarn lint` (22 pre-existing warnings),
`yarn test` (85). Small atomic commits, imperative mood, no AI attribution. Keep new renders few
and cite them in the report; the eval folder is tracked. At the end, add a V9.1e section to
`.claude/plans/V9-REPORT.md`, update `.claude/docs/state.md`, and push to
`origin docs/v8-v9-programme` once the gates pass.
