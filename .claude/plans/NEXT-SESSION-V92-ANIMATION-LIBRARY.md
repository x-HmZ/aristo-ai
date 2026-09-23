Start V9.2 of the teacher programme: the animation library for Jake and MJ. Read `CLAUDE.md`,
`.claude/docs/state.md`, then the **V9.1e** section at the end of `.claude/plans/V9-REPORT.md`,
and in `.claude/plans/V9-teacher-avatar-and-animation-library.md` the sections "Getting ActorCore
quality without buying it", "The scenario catalogue", "Architecture" and "Phases" (V9.2 and V9.3).
Blender is running with the MCP add-on; the working scene is
`.claude/eval/2026-09-18-v9-bakeoff/bakeoff_scene.blend` (both teachers, the classroom, the lesson
camera, and the Mixamo source rig `MarcusArma` with the pack's 16 clips as actions). Scripts are in
that folder's `scripts/`: add it to `sys.path` in Blender and `importlib.reload` after edits.

## Where things stand

- Jake and MJ each ship **six clips** in their own GLB (`public/models/Teacher_{Jake,MJ}.glb`):
  Idle, Talking, Pointing, Thinking (baked from the pack's Thinking2), Nodding, ShakeNo. Jake is
  2.96 MB, MJ 2.92 MB.
- **Not baked yet:** Idle2 (267 frames), Idle3 (249), Idle4 (72), Talking2 (80), Talking3 (71),
  Talking4 (249), Talking5 (208), Talking6 (24), Clapping (27). Thinking (188) was baked and
  rejected (see below).
- The Avaturn rig (Marcus, Priya, `/create-teacher`) already has all 16 in
  `public/models/animations_Avaturn.glb`.
- `Teacher.tsx` still resolves clips ad hoc (`CANINO_CLIPS`, gesture → pool). The director is
  V9.3, not this session.

## Part 1 — plan mode first: how the library ships

Do this before baking anything; it decides how every later clip is delivered. Each baked clip
costs about 0.14 MB on Jake and 0.22 MB on MJ (303 vs 765 channels per clip). All 16 would put
MJ's animation data near 3.5 MB, over the plan's 3 MB-per-rig budget. Plan, then show Hmz:

1. **Channel diet.** MJ's glTF rig has `_scaleCompensation` bones and leaf duplicates (`_0`,
   `_1`), and most of their tracks are probably constant. Measure how many of the 765 channels
   never move, and what pruning constant tracks costs or saves (gltf-transform
   `resample`/`prune` in `v9_postprocess.mjs`, or skip them at export). Verify in three.js that
   pruned tracks don't break the pose: a missing track means the bone holds its bind pose, which
   must equal the rest value.
2. **Packaging.** Either keep everything in one GLB per teacher, or ship a mesh GLB plus a base
   animation pack (Idle, Talking, Thinking) and a lazy scenario pack loaded after `sceneReady`,
   as in the plan's "Loading" item. `AVATAR_ASSETS` already separates `sceneFile` from
   `animFile`, but there is one `animFile` per avatar, so lazy packs need a code change. That is
   also V9.3's territory, so keep the loader change minimal and director-ready. Keep the T02/T03
   load budget from regressing; measure first load before and after.
3. **Which clips.** Map the 16 source clips and the Tier 1 variants (mirror, time-warp
   0.85x/1.15x) onto the scenario catalogue. List what's missing per scenario. Anything that
   needs a Mixamo download goes on a list for Hmz; it needs his login, so don't try to fetch it.
   Only Mixamo, ActorCore free, Quaternius CC0 and Mesh2Motion CC0 are allowed (see the plan's
   licence table).

Stop after the plan and get Hmz's answer before baking beyond a test clip or two.

## Part 2 — bake and check (after Hmz approves the plan)

`v9_retarget.bake_clips([...])` bakes both teachers. It already does the facing fix, rest
alignment, helper bones (elbow and knee share, forearm twist), per-frame grounding, and the
frozen-source guard. Then, for **every** new clip:

- **MJ only:** `v9_skirt.clear_hands("Object_4.001", "MJ_<clip>", "MJ_skirt",
  ["Object_12.001", "Object_14.001"])`. Then re-run `v9_skirt.check_through(...)` for hands and
  legs, because straight after a bake `clear_hands` once measured nothing.
- `v9_mask.find_pokes`:
  - MJ: torso `Object_10.001` vs tee `Object_31.001` + skirt, legs `Object_13.001` vs skirt,
    tee vs skirt, arms `Object_12.001` vs tee;
  - Jake: `CC_Base_Body.002` vs shirt, trousers and shoes.

  Expect zero on every frame. `push_under` is fine for a few mm; anything larger is a real
  problem, so diagnose it.
- **Bone deltas vs source:** expect 0.000° except MJ's hanging arms, which `clear_hands`
  deliberately swings.
- **Lower sole:** within a few mm of the floor.
- **Loop seams** for clips that loop.
- **Strips** (`v9_strip.strip`): lesson camera, three-quarter view, a camera tracking each wrist,
  and **both elbows side by side**.

Things paid for in V9.1d and V9.1e (don't rediscover them):

- **Contact gestures break on these proportions.** The angle check can pass at 0.000° while the
  gesture is wrong: the pack's Thinking put the hand on the chest instead of the chin. On MJ that
  read as a hand on her breast. Any clip where a hand touches the face, body or the other hand
  (Clapping) must be looked at beside Marcus in close-up. The IK fix was tried and thrown away
  (limp wrist, or skin 19 mm through Jake's cuff). Prefer another clip.
- **Check left against right**, not only against the source. MJ's left elbow had a sculpt defect
  that two sessions passed and Hmz caught in the app. `v9_mask.mirror_region` fixed it.
- The **skirt hem stays at 0.52** (knee joint 0.55). A clip that bends a knee back can still put
  the calf through it, and `check_through` catches that.
- Clips go into `v9_export.export(..., clips={...}, budget=None)` after
  `v9_render.solo(root, keep=(), hide_always=v9_strip.HIDE)`, then
  `sh .claude/eval/2026-09-18-v9-bakeoff/scripts/v9_ship.sh`. Check the clip list, channel count,
  17 morph targets and size.

## Part 3 — in the app

- **Wire the new clips** into the pools in `Teacher.tsx` / `CANINO_CLIPS` (e.g. `idle: ["Idle",
  "Idle2", ...]`, `talking: [...]`), or into the minimal loader from Part 1. The director is
  V9.3, so don't build it now.
- **Check each new clip** in `/dev/free-model?avatar=jake|mj` (free; don't start `/learn`
  lessons, they cost API calls). Check transitions, variant cycling (Idle rotates every 20 s,
  Talking at clip end), and one-shot timing: nod and shake revert at clip length minus the fade.
- **Tooling:**
  - **Debug hook.** Add it in `RendererConfig` (`src/components/three/Experience.tsx`):
    `const three = useThree(); useEffect(() => { window.__v91d = three; window.__v91dStore = useAristoStore; }, [three]);`
    **Revert it before committing.**
  - **Close-ups.** Render a second camera from your own `requestAnimationFrame` loop.
  - **Opening pages.** Open each page with `preview_start {url}`, then `resize_window`
    1440×810; `/dev/free-model` takes 30-60 s.
  - **Frame loop.** The pane may pause `requestAnimationFrame` while a script runs. Drive it
    with `await setTimeout(33); three.advance(performance.now())`.
  - **Restarting gestures.** Setting a gesture that is already current doesn't restart it, so
    reset to `idle` between trials.
- Also check MJ in `/demo` once (Hmz hasn't signed off her new outfit there yet).

## Parked, do not do

- Female narration for MJ in `/demo` (ElevenLabs characters).
- New app signals (mic listening, raise hand, XP) — they need Hmz's OK per the plan.
- Hand-keyframed Tier 2 gestures (next phase, after the pipeline and packaging are settled).

## Ground rules

Stop and ask before any spend, any account-gated download (Mixamo, ActorCore), or anything
needing Hmz's login.

Model use per the plan: design and debug the pipeline and packaging with the strongest model on
2-3 clips, then switch to Sonnet for the bulk bakes.

Package manager is yarn. Gates before committing: `yarn type-check`, `yarn lint` (22
pre-existing warnings), `yarn test` (85). Get a `typescript-reviewer` pass on `Teacher.tsx` and
loader changes. Small atomic commits, imperative mood, no AI attribution.

Keep new renders few and cite them in the report; the eval folder is tracked. Back up the scene
first (`bakeoff_scene_pre_v92.blend`).

At the end: add a V9.2 section to `.claude/plans/V9-REPORT.md`, tick V9.1 (and V9.2 if done) in
the V9 plan's status checklist, update `.claude/docs/state.md`, and push to
`origin docs/v8-v9-programme` once the gates pass.
