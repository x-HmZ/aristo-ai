# Next session — V9.1d: motion QA of Jake and MJ, and MJ's wardrobe to a quality bar

Paste everything below the line into a fresh session. Suggested model: Opus; switch to Fable 5.1
only if the retarget itself needs redesigning (see the V9 plan's model discipline).

---

Continue the V9 teacher programme. Read `CLAUDE.md`, `.claude/docs/state.md`, then the **V9.1c**
section at the end of `.claude/plans/V9-REPORT.md` — that is the work you are checking. Blender is
running with the MCP add-on; `.claude/eval/2026-09-18-v9-bakeoff/bakeoff_scene.blend` holds the
classroom, the app's lesson camera and lights, both teachers, and the Mixamo source rig
(`MarcusArma`, 16 clips on muted NLA tracks). Reusable scripts are in that folder's `scripts/`
(`v9_retarget`, `v9_render`, `v9_mask`, `v9_clothe`, `v9_export`, `v9_postprocess.mjs`, `v9_ship.sh`).

Jake and MJ (Canino3d, CC BY 4.0) are now the only teachers offered in `/learn` and `/demo`, so
anything wrong with them is in front of every student. Last session fixed a retarget that buried
the arms and froze five of six clips, but **the motion was only checked at three sampled frames per
clip**. Nobody has watched the clips through, and MJ's extended clothes were only judged in a few
poses. Job one is motion, job two is MJ's wardrobe, job three is conditional on both passing.

Verify by rendering and by running the app. Frame strips, not single frames: a problem that lives
for six frames will not show on a sample. Report plainly, including anything last session got wrong.

## Part 1 — motion QA of Idle, Talking, Pointing on both teachers

For each teacher and clip, render a strip at every 4th frame from two cameras: the app's
`LessonCam` and a three-quarter side view. Render the source (`MarcusArma` playing the same action)
at the same frames beside it: the question is whether the target moves like the source, not just
whether it looks plausible. Then check in three.js.

Try to break these, each one specifically:

- **Wrists and forearms.** Twist and share bones (`*Twist01/02`, `*ShareBone`) are deliberately
  unmapped, so all forearm roll lands on the hand bone. Look for candy-wrapper collapse at the wrist
  and elbow in Talking, where the palms turn up.
- **Hands and fingers.** Rest alignment swung finger bones 17–36° and the hand 28°. Check thumbs and
  finger curl read as a relaxed hand, not a claw or a flat paddle, in close-up and at lesson distance.
- **Shoulders.** The clavicle was swung 31°. Look for hunched or dropped shoulders, and for skin or
  shirt collapse at the armpit when the arm lifts (Pointing).
- **Feet and legs.** The foot was swung 26° to match Mixamo's foot direction. Check the feet stay flat
  on the floor, the toes do not sink into it, and there is no foot sliding in Idle.
- **Hips.** Measured: no drift, loop seams at most 0.31°. Confirm it by eye at the loop point of each clip
  (last frame to first).
- **Pointing lands on the diagram.** `Experience.tsx` moved the image and 3D model anchor
  (`SCENE_X/Y/Z`) so the Pointing clip lands on it, tuned on Marcus. Check where Jake's and MJ's
  finger actually points in the running app against that anchor, and compare with Marcus
  (archived but still loadable: `/dev/free-model?avatar=marcus&state=pointing`).
- **Transitions.** `Teacher.tsx` crossfades clips over 0.5 s. Watch Idle → Talking → Pointing → Idle
  in the app for pops or a one-frame T-pose.
- **Face while moving.** Blink (now both eyes), resting smile and visemes during Talking. Visemes
  were already judged; only flag something new.

Tools in the app: `/dev/free-model?avatar=jake|mj&state=thinking|talking|pointing` (real
`AristoCanvas`, lesson camera and lights), `/dev/avatar-lab` (face framing, demo narration), and
`/demo` (Jake default, Jake/MJ switcher, pre-rendered narration; opening a topic costs nothing).
**Do not start lessons in `/learn`** — they call paid APIs. Looking at `/learn` with the switcher is
fine if Hmz is signed in to the browser pane.

Fix what fails in `v9_retarget.py` and re-bake. If the fix is to map twist bones, distribute the
forearm roll across them rather than copying the parent delta (copying it double-counts and
corkscrews the forearm, which is why they were unmapped).

## Part 2 — MJ's wardrobe, held to a quality bar

Her crop top and micro skirt were extended into a hip-length tee and a knee-length skirt by growing
her own meshes (`v9_clothe.extend_garment`), then re-weighted from the nearest body vertex. Last
session rebuilt the tee from clean geometry, masked the skin under it, welded the skirt panels and
pushed the waistband out to clear the tee.

**The bar.** At lesson distance and in the lab's face framing, in every frame of all three clips:

1. no skin, bra or panties showing through or past any garment;
2. no garment passing through another (tee through skirt, skirt through legs or hands);
3. no faceting, holes, spikes or slashed hems;
4. the tee's hem reads as a hem, and the horizontal line where the original crop top ended reads as
   intentional or not at all;
5. the skirt moves with the legs without tearing between them in a wide stance (Idle has one) or
   stretching into a tent;
6. no dark blotches in the skirt under the app's lighting. These predate last session (pleat-fold
   shading) and are the known open item; judge whether they are acceptable;
7. she looks dressed by the same artist as Jake: casual, age-appropriate for a teacher of 11–14
   year olds.

Judge 1–6 in three.js, not only in Eevee: last session found two defects (skirt normals, doubled
specular) that only three.js showed.

If the extended garments cannot meet the bar with reasonable fixes (weights, a few rings of
geometry, normals), **stop and propose alternatives to Hmz before building one**. Candidates that
cost nothing: the MPFB CC0 clothing packs already installed in Blender (`shirts01`, `pants01`,
`shoes01`), or re-fitting her garments with a donor's weights. Show renders of the options.
Anything that needs a download, an account or money is Hmz's call.

The forehead scalp seam (source asset) and hair clipping the shoulder in some poses are known.
Fix them only if cheap; otherwise leave them listed.

## Part 3 — only if Parts 1 and 2 pass: more clips

Jake and MJ have three clips; Marcus had sixteen. `MarcusArma` carries Thinking, Thinking2,
Nodding, ShakeNo, Idle2–4, Talking2–6 and Clapping. Today thinking plays Idle and feedback gestures
fall back to idle. Bake Thinking, Nodding and ShakeNo at least (one `retarget_action` each), apply
the same Part 1 checks to them, add them to `CANINO_CLIPS` in `src/components/three/Teacher.tsx`,
re-export and re-ship. Watch the GLB size: each clip adds channels for all 101 (Jake) or 255 (MJ)
nodes.

## Gotchas already paid for — do not rediscover these

- `v9_export.export()` sets `hide_viewport = hide_render` on every object, which hides
  `MarcusArma`; Blender does not evaluate a viewport-disabled object, so a bake after an export
  reads a frozen source. `retarget_action` now un-hides both rigs and raises if the source hand
  never moves. Keep that guard.
- Mixamo rests in a T-pose, CC4 in an A-pose. `rest_alignment` swings limb bones only; aligning the
  hip, spine or head tilts the pelvis 23°, because that angle is anatomy, not pose.
- `v9_render.solo()` un-hides everything under a root. Meshes hidden on purpose (MJ's panties
  `Object_41.001`, her undergarment `Object_11.001`) must be in `hide_always` or they render as
  defects that are not in the GLB.
- `hide_render` on a parent does not propagate to children. `select_all(DESELECT)` skips hidden
  objects. Blender's Decimate refuses meshes with shape keys.
- **Do not decimate.** Collapse-decimate shattered MJ's teeth, flaked her hair and faceted her tee.
  Triangles come from `v9_mask.mask_under` (deletes skin hidden by clothing; bmesh keeps shape keys).
- Welding faces of mixed winding averages their normals to zero and renders black in three.js.
  Orient faces first.
- The scene's untouched MJ import (`Object_2` hierarchy) holds her undecimated source meshes; the
  similarity transform onto the shipped hierarchy is solved from the head mesh (see V9.1c).
- The app wires Draco only (no meshopt decoder). Re-ship with
  `sh .claude/eval/2026-09-18-v9-bakeoff/scripts/v9_ship.sh` after `v9_export.export(...,
  budget=None)`. It applies the material fixes, embeds the CC BY credit in `asset.copyright` and
  installs to `public/models/`. Check all 17 morph targets survive.
- The Blender scene is saved in export state. `bakeoff_scene_pre_v91c.blend` is the backup from
  before last session's rebuild.
- `.claude/launch.json` defines `aristo-dev` (yarn dev, port 3000). `/dev/free-model` takes about
  30 s to show anything on first load; the page is blank until the scene resolves.

## Parked, do not do

- **A female narration for MJ in `/demo`.** She currently lip-syncs the male pre-rendered voice.
  It is 6,856 ElevenLabs characters and Hmz has parked it.

## Ground rules

Verify by rendering and running the app. Stop and ask before any spend, any account-gated download,
or anything needing Hmz's login. Package manager is yarn. Gates before committing: `yarn
type-check`, `yarn lint` (22 pre-existing warnings), `yarn test`. Small atomic commits, imperative
mood, no AI attribution. Keep new renders few and cited in the report: the eval folder is tracked
in git now. Update `.claude/plans/V9-REPORT.md` (a V9.1d section) and `.claude/docs/state.md` at
the end, and push to `origin docs/v8-v9-programme` once the gates pass.
