Start V9.2b of the teacher programme: three fixes Hmz found in the app. Run with **Sonnet**; if
a diagnosis doesn't converge after two tries, stop and say so (Hmz will switch to Opus).

Read `CLAUDE.md`, `.claude/docs/state.md`, the **V9.2** section at the end of
`.claude/plans/V9-REPORT.md`, and **V9.2b** in the "Phases" of
`.claude/plans/V9-teacher-avatar-and-animation-library.md`.

Blender is running with the MCP add-on. The scene is
`.claude/eval/2026-09-18-v9-bakeoff/bakeoff_scene.blend`. Scripts are in that folder's
`scripts/`: add it to `sys.path` and `importlib.reload` after edits. Globals don't persist
between MCP calls, so re-import in every call, and keep each call under about 60 s (split long
checks per clip).

Back up the scene first as `bakeoff_scene_pre_v92b.blend`.

## Where things stand

- Jake and MJ ship as `public/models/Teacher_{Jake,MJ}.glb` (mesh plus Idle, Talking,
  Thinking) and `Teacher_{Jake,MJ}_clips.glb` (14 clips), loaded through `clipPacks` in
  `src/components/three/Teacher.tsx`.
- Rebuild both with the raw export and then `sh .claude/eval/2026-09-18-v9-bakeoff/scripts/v9_ship.sh`.
  It post-processes, runs `v9_verify_anim.mjs` (expect ≤ 0.02° and ≤ 0.3 mm) and installs the
  files.
- Export call, per teacher:
  1. `v9_render.solo(root, keep=(), hide_always=v9_strip.HIDE)`;
  2. `v9_export.export(root, path, clips=..., budget=None)` with all 17 clips. Take the mapping
     from V9.2: `Thinking` is `<T>_Thinking2` and `ThinkingM` is `<T>_Thinking2M`.

## 1. Scale and placement (do this first; it changes every screenshot after it)

The classroom is real size:

- chair seats 0.45-0.5 m and desk tops 0.7-0.8 m above the floor (floor z = -1.72);
- ceiling 4.28 m;
- the camera at `[0, 0, 0.9]`, which is eye height 1.71 m.

The teachers stand **2.79 m**: normalised to 1.859 m in `v9_export.TARGET_HEIGHT`, then
`scale={1.5}` in `Experience.tsx` (`<SafeTeacher position={[-1, -1.7, SCENE_Z]} scale={1.5} rotationY={0.3}>`).
A desk reaches their knee.

- **Target:** a believable adult. Jake about 1.78 m, MJ about 1.68 m (she is normalised to the
  same height as Jake today, so give her her own scale). Change the app scale, not the GLBs.
- **Re-tune together**, because all of it was tuned to the 2.79 m teacher:
  - the teacher's position and rotation;
  - `SCENE_X`/`SCENE_Y` (the image panel; Pointing must still land on it);
  - `MODEL_X/Y/Z` and the generated model's `scale={1.5}`;
  - `YourTurnBubble` and the "Thinking..." label (`spawnLabelHeight`);
  - the desk-quiz camera and paper anchor (`/dev/desk-quiz` has sliders);
  - `AvatarLoadingPlaceholder`.
  Keep the lesson camera unless the framing forces a change; say why if it does.
- **Evidence:** measure desk-to-hip, head height, and where Pointing's fingertip lands on the
  panel, before and after. Take lesson-view screenshots of both teachers at 1440×810 in
  `/dev/free-model?avatar=jake|mj` with the image stage and the model stage, and once in
  `/demo`.
- **Hmz signs off** on the before/after pair before you move on. Record the numbers in
  `decisions.md` (they supersede the 1.5 from the Marcus era).

## 2. Fingers look bent (both teachers)

Already ruled out: rest alignment leaves each palm within 3.6-5.1° of Marcus's, and the finger
deltas copy the source to 0.000°. So it's not the retarget maths.

1. In three.js, render close-ups of both hands beside Marcus (`/dev/free-model?avatar=marcus`
   still works) for Idle, Idle2, Talking, Talking3 and Pointing.
2. Decide whether the teachers' fingers differ from Marcus's, or whether Marcus looks the same
   and it's Mixamo's finger pose on cartoon hands.
3. If a fix is needed, prefer a baked, per-clip blend of the finger bones towards a relaxed
   curl (a new small step after `bake_clips`), then re-run the numbers. Do not touch Pointing's
   index finger.

## 3. Jake's trousers deform (knees and shins: lumps, deep creases)

1. Render Jake's legs at rest, and in Idle and Talking4 frames, in Blender and in three.js.
2. The candidates to separate:
   - the source's baked wrinkle normal map (disable it to test);
   - the knee-share helper from `drive_helpers`;
   - the trouser weights at the knee (compare with `CC_Base_Body.002`'s leg weights).
3. Fix at the cause. If it's the normal map, a flatter or blurred normal map on the trousers
   is fine. Then run `v9_mask.find_pokes` for body vs shirt, trousers and shoes on all 17 clips.
   Expect zero; `push_under` is fine for a few mm.
4. Look at MJ's legs and skirt in the same pass.

## Tooling (paid for in V9.2; don't rediscover)

- **Debug hooks.** In `RendererConfig` (`src/components/three/Experience.tsx`):
  `const three = useThree(); useEffect(() => { window.__v91d = three; window.__v91dStore = useAristoStore; }, [three]);`
  For mixer access, add `useEffect(() => { window.__v92 = { mixer, packActions, actions }; }, [mixer, actions]);`
  in `Teacher.tsx`. **Revert both before committing** (grep `__v9`).
- **Browser pane.** A page takes 60-110 s to load in dev. A *second* navigation in the same tab
  can stall at 11 resources forever: open a new tab (`tabs_create`) instead. Set
  `resize_window` 1440×810 on each new tab.
- **Frame loop.** Drive it from scripts with
  `await setTimeout(33); three.advance(performance.now())`. For posed close-ups:
  1. `three.setFrameloop('never')`;
  2. `mixer.stopAllAction()`, play one action, set `.time`, `mixer.update(0)`;
  3. render a cloned camera with `three.gl.render(scene, cam)`, then screenshot;
  4. restore `setFrameloop('always')`.
- **Contact gestures.** Look at them beside Marcus in close-up; the angle checks can't see them.
- **Hidden rigs aren't evaluated.** Un-hide an armature before stepping frames on it.

## Parked (don't do)

- V9.3 director.
- New clips (Mixamo is exhausted; see `decisions.md` "Clip sources").
- Female narration for MJ.
- New app signals.

## Ground rules

- Package manager: yarn.
- Gates: `yarn type-check`, `yarn lint` (22 pre-existing warnings), `yarn test` (85).
- Get a `typescript-reviewer` pass on any `Experience.tsx` or `Teacher.tsx` change.
- Small atomic commits, imperative mood, no AI attribution lines.
- Keep new renders few and cite them in the report.
- At the end:
  - add a V9.2b section to `.claude/plans/V9-REPORT.md`;
  - tick V9.2b in the plan's checklist;
  - update `.claude/docs/state.md`;
  - push to `origin docs/v8-v9-programme` once the gates pass.
