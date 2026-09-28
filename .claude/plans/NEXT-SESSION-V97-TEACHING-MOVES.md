Start V9.7 of the teacher programme: batch 2 of the gesture catalogue, the "teaching moves" (six hand-keyed gestures for Jake and MJ that fit what the teacher is saying), plus the small director change that lets them play. Model: **Opus 5** (`/model opus`) to author and judge the motion, because it is verified by looking. A session cannot change its own model: once Hmz has approved the clips in motion and only the director change, tests, in-app checks and docs remain, stop and tell him in plain words to switch to **Sonnet**. Do not use Fable. If a clip does not converge after two rounds of your own review, stop and say so.

Read `CLAUDE.md`, the top entry of `.claude/docs/state.md`, `.claude/plans/V96-GESTURE-CATALOGUE.md` (the catalogue: the stage, the 22 situations, the batches), the "V9.6" section at the end of `.claude/plans/V9-REPORT.md` (what worked, the tooling notes, the known edges), and `.claude/plans/NEXT-SESSION-V96-WIRING.md` (how the wiring half was done). The rules for every clip are in `.claude/plans/NEXT-SESSION-V96-TIER2-CLIPS.md` and still apply.

## Settled, do not re-ask

- Jake is the default teacher, MJ the second. Batch 1 shipped in V9.6; Almost is the wrong-answer clip, ShakeNo stays at a third of its weight.
- Every gesture must mean something in the scene. V9.6 rejected LookAgain (a nod says "yes" on a wrong answer) and LookAgainHand (pointing at a desk that holds nothing). Judge meaning first, geometry second. See the auto-memory note "gestures must make sense in context".
- Hmz reviews each clip in motion on `/dev/avatar-lab` before it is wired. Stop and ask him; do not wire a clip he has not seen. Offer alternatives when a situation has two plausible gestures, and let him pick.
- Parked: the Avaturn rig's pack, female narration for MJ, MJ's hair and scalp seam, mesh-level expressions, the FFT viseme fallback. Marcus, Priya and custom teachers stay untouched.

## The six clips (catalogue rows 5, 6, 9, 12, 13, 14)

All upper-mask overlays played once, Canino rigs only, authored on Jake then copied to MJ and checked separately. Lengths are a starting point, in seconds at 24 fps.

| Clip | Situation | Signal (director) | What a good teacher does |
|---|---|---|---|
| Imagine | The hook, "imagine if..." | segment role `hook` | Both palms open outward and slightly apart, a curious head tilt (about 2.2 s) |
| HoldIdea | Explaining an idea | phase `explain`, one beat per segment | Hands in front of the chest, palms facing each other with a gap, as if holding the idea. Hands must not touch or cross the chest (about 2.5 s) |
| StepBeat | One step of a demonstration | segment role `demo_step` | A small downward chop of one hand per step, "first... then..." (about 1.4 s, so it can land on each step) |
| MoveOn | Bridging to the next idea | segment role `transition` | One hand sweeps the last idea aside, "now, next" (about 1.6 s) |
| YourTurn | Posing the question | segment role `challenge_setup` | An open palm towards the student, "your turn" (about 2.0 s) |
| BringTogether | Connecting it all | phase `connect`, one beat per segment | Two hands come together in front, close but not touching, "it all fits" (about 2.4 s) |

Also in batch 2 (data only, no new clip): a new image landing on the board (`activePreviewImageUrl` changes) plays the existing PresentModel, the same spot as the model.

Hands stay clear of the body and of each other by at least 15 cm (V9.2: the Canino proportions put hands through the chest and chin). The stage geometry, where the board, model, desk and student are, is in the catalogue file.

## Authoring

`scripts/v9_gesture.py` in `.claude/eval/2026-09-18-v9-bakeoff/` already does this: add specs, `build_all`, `finish`. Read its header for the axis conventions (F forward, L his left, U up, A about the bone; signs are noted above the V9.6 specs). Copy the checking pattern from V9.6:

1. Back up the scene as `bakeoff_scene_pre_v97.blend` first.
2. `v9_gesture.lesson_camera` and `strip` for frame strips at the real classroom camera; `close_camera` for detail; `composite` to play a clip over a base.
3. Per clip, both teachers: `v9_mask.find_pokes` (0 expected), `clearance` (hands against shirt and trousers), and for MJ `v9_skirt.check_through` over Idle, Idle2, Idle4, Talking and Talking4 (0 expected). For two-hand clips also measure the closest the hands come to each other.
4. Export with `v9_render.solo` and `v9_export.export(root, path, clips=..., budget=None)` for all clips (the existing 24 plus these six; `LookAgain`/`LookAgainHand` are gone), then `sh .claude/eval/2026-09-18-v9-bakeoff/scripts/v9_ship.sh`. `v9_verify_anim.mjs` must stay under 0.02 degrees and 0.3 mm. New clips go in the packs, not the base files.
5. Add the new names to the `GESTURES` list in `src/components/dev/AvatarLab.tsx` so Hmz can review them, then stop and ask him.

Blender is running with the MCP add-on (Blender 5.1). Re-import the scripts in every MCP call and keep each call under about 60 s. A first draft is rarely right: expect one to three drafts per clip.

## The director change (Sonnet's half)

The director sees only the lesson phase, not each segment's role. Add what the six clips need, presentational only, with tests:

- `phaseOf` in `src/lib/avatar/director.ts` finds the current segment's phase; add a matching `roleOf` (the roles are `narrate`, `hook`, `demo_step`, `callout`, `challenge_setup`, `challenge_reveal`, `transition` in `src/lib/agents/teaching.ts`) and pass `role` through `signalsOf` in `Teacher.tsx` into `DirectorSignals`.
- New scenarios in `animationManifest.ts` (`SCENARIOS`, with catalogue rows), a "beat" on the edge of a new segment starting to speak (not every frame, and not on every segment), and `over` lists so a beat never plays over Pointing or thinking.
- Rate: a beat on every segment would be constant motion. Keep it sparse (for example, at most one beat per phase, or every second segment) and say in the report what you chose. Ask Hmz if unsure.
- Manifest rows: source "authored in Blender for Aristo (V9.7)", licence "Aristo's own", real durations read from the GLBs, `mirrorable: false`, its own `family`, added to `CANINO_CLIP_SET` only.
- Tests: coverage snapshot in `manifest.test.ts`, one director test per new scenario, one that a beat does not play over Pointing or while loading, one for the new-image case, and one that Marcus, Priya, custom and legacy sets are unaffected.
- `typescript-reviewer` on the `Teacher.tsx` and director diff.

## Verify in the app

Jake and MJ, `/demo` (the Volcanoes lesson has real roles) and `/dev/free-model`. Ask Hmz to start `yarn dev` if no server is on port 3000 (do not start a second one if another session owns it). Force each scenario through the store, check the overlay blends with no pop and the base keeps playing, and show Hmz frames. Use the V9.6 tooling notes: R3F's manual `advance` takes seconds, not milliseconds; set the frame loop to `never` and use a synthetic 1/30 s clock; add the temporary `__v9x` debug hooks and revert them before committing. `/learn` needs auth: say so instead of claiming it.

## Ground rules and close-out

Yarn. Gates: `yarn type-check`, `yarn lint` (10 warnings now), `yarn test` (291 now), `yarn build` (temporary distDir if a dev server holds `.next`; revert `next.config.mjs` and `tsconfig.json`). No emojis, no AI attribution lines, no co-author trailers, small atomic commits in the imperative, push to `origin docs/v8-v9-programme`. Never run `git worktree remove` on a directory containing a junction to `node_modules`.

Close out with a V9-REPORT.md "V9.7" section (what shipped, drafts, checks, sizes, coverage table, what Hmz approved), LICENSES.md (the clips are Aristo's own), decisions.md rows, state.md, the plan checklist, and mark batch 2 done in `V96-GESTURE-CATALOGUE.md`. State plainly what shipped, the pack size, what Hmz approved, and any question left for him. Batch 3 (OneMoment, BackToBoard, OverToYou, PatientTilt, PointNear) is next, and needs two additions to `v9_gesture.py`: per-finger control and a full-body clip on a base loop.
