Start V9.6 of the teacher programme: the three Tier 2 clips (hand-keyed gestures for Jake and MJ). Model: **Opus 5** (`/model opus`) to author and judge the motion, because the output is verified by looking. A session cannot change its own model: once the clips are accepted in motion and only the manifest, tests, ship and docs remain, stop and tell Hmz in plain words to switch to **Sonnet** for that half. Do not use Fable. If a clip does not converge after two rounds of your own review, stop and say so instead of grinding.

Read `CLAUDE.md`, the top entry of `.claude/docs/state.md`, "Tier 2" and "Things only Hmz can do" in `.claude/plans/V9-teacher-avatar-and-animation-library.md`, and the V9.2, V9.3 (coverage table and "Question for Hmz: ShakeNo") and V9.5 sections of `.claude/plans/V9-REPORT.md`. Then `.claude/plans/NEXT-SESSION-V92B-FIXES.md` for how Blender, the scene and the ship script are driven. Marcus, Priya and custom teachers stay untouched: do not test or extend them.

Blender is running with the MCP add-on. Scene: `.claude/eval/2026-09-18-v9-bakeoff/bakeoff_scene.blend`; scripts in that folder's `scripts/` (add to `sys.path`, `importlib.reload` after edits, re-import in every MCP call, keep each call under about 60 s). Back the scene up first as `bakeoff_scene_pre_v96.blend`.

## Settled by Hmz (do not re-ask)

- Jake is the default teacher, MJ the second. Both are Canino3d rigs.
- **ShakeNo stays for a wrong answer for now.** Do not silence it and do not remove it from the manifest.
- Tier 2 is wanted. The new clips are authored, not Mixamo.
- Parked: the Avaturn rig's pack, female narration for MJ, MJ's hair and scalp seam, mesh-level expressions, the FFT viseme fallback.

## The three clips

Each is an **upper-body or head overlay** (the director plays overlays over a base clip, so they must drive only the masked bones and never move the hips, legs or root). Author for both Jake and MJ on the same skeleton naming as the existing clips; the shape must read at the real classroom camera, not in a close-up.

| Clip | Scenario (manifest) | Mask | What it is | Notes |
|---|---|---|---|---|
| `PresentModel` | `presentModel` (row 9), over quiet and talking bases | `upper` | An open-palm presenting gesture toward where the generated 3D model appears (the scene anchor, up and to the teacher's right, see `SCENE_X/SCENE_Y` in `Experience.tsx`) | About 2 to 3 s, hand returns to the base pose. The head already turns to the model through the look layer, so do not key the head |
| `LookAgain` | `wrong` (row 14), added beside ShakeNo | `head` (a small shoulder and upper-body settle is allowed only if it stays inside the `upper` mask) | A gentle "let's look at that again": a slow head tilt with a soft partial nod, no shake, warm not scolding | About 2 s. Pair with the existing warm face hint |
| `Encourage` | `quizSupportive` (row 16, not passed) | `upper` | A small encouraging beat: open palm slightly out and a soft nod, "you're getting there" | About 2 to 3 s. The face hint is already `warm` |

Rules for every clip:

- Pose-to-pose, forgiving timing, shape carries the meaning (the plan's honest limit: Claude reads frames, not motion, so keep gestures emblematic and simple; do not attempt talking acting).
- 30 fps, ease in and out, first and last pose equal to the rest pose of the masked bones so the overlay blends in and out without a pop.
- No root motion; no hand-to-body or hand-to-face contact (the Canino proportions put hands through the chest and chin; this is why Mixamo's Thinking was replaced in V9.1e).
- Fingers: relaxed, not clawed. Run the same finger relax as the other clips (`v9_fingers.py`), and `v9_mask.find_pokes` on shirt, trousers or skirt and shoes: expect 0 pokes.
- MJ's skirt: check her legs and skirt are untouched (upper-body clips should be, but verify).

## Steps

1. **Author** the three clips on Jake, look at them in the Blender viewport at several frames, and iterate. Then copy them to MJ (same bone names; retarget by name, mirror not needed) and check her separately, because her proportions and the numbered bone names differ.
2. **Export and ship** with the existing pipeline, as in the V9.2b brief: `v9_render.solo`, `v9_export.export(root, path, clips=..., budget=None)` with the 17 existing clips plus the three new ones (20), then `sh .claude/eval/2026-09-18-v9-bakeoff/scripts/v9_ship.sh`. `v9_verify_anim.mjs` must pass (at most 0.02 degrees and 0.3 mm). The new clips go in the **pack**, not the base file: base stays Idle, Talking, Thinking. The pack must stay well under the 3 MB per rig budget (it is 0.5 MB now).
3. **Hmz reviews each clip in motion** on `/dev/avatar-lab` (stills cannot show timing). Stop here and ask him for notes before wiring anything into the manifest. Do not wire a clip he has not seen.
4. **After his approval, wire it** (this half is Sonnet's):
   - add three `ClipSpec` rows to `CLIP_MANIFEST` in `src/lib/avatar/animationManifest.ts` (source "authored in Blender for Aristo (V9.6)", licence "Aristo's own", `mask`, `play: "once"`, real `duration`, cooldown, `mirrorable: false`, its own `family`), and add the names to `CANINO_CLIP_SET` only (not the Avaturn, custom or legacy sets);
   - `presentModel` and `quizSupportive` get their clip; **`LookAgain` joins the `wrong` pool next to ShakeNo**. Ask Hmz in plain words whether ShakeNo should then keep an equal weight, a lower one, or leave the pool. Do not decide that yourself;
   - update the coverage snapshot in `src/lib/avatar/manifest.test.ts` (rows 9 and 16-supportive now have clips on Jake and MJ; row 14 gains one) and any director test that assumed those rows are empty. Add a director test for each new scenario playing its clip.
5. **Verify in the app** (Jake and MJ, `/demo` and `/dev/free-model`; another session's dev server owns port 3000, so point the browser pane at it and do not start a second): force each scenario, check the overlay blends in and out with no pop and the base clip keeps playing, and show Hmz screenshots or a frame strip. `/learn` needs auth; say so instead of claiming it.
6. **Docs and ship:** LICENSES.md (the authored clips are Aristo's own work, inside the CC BY GLBs; note that they are not Mixamo-derived), V9-REPORT.md new "V9.6" section with the coverage table update and the pack size before and after, decisions.md rows, state.md top entry, plan checklist (add and tick V9.6). Update CLAUDE.md only if a rule changed.

## Ground rules

Yarn. Gates: `yarn type-check`, `yarn lint` (10 warnings now), `yarn test`, `yarn build` (another session's dev server may hold `.next` on Windows: build with a temporary `distDir`, then revert `next.config.mjs` and `tsconfig.json`). `typescript-reviewer` on any `Teacher.tsx` or store change (none is expected: this should be manifest and data only). No emojis, no AI attribution lines, no co-author trailers, small atomic commits in the imperative, push to origin `docs/v8-v9-programme` (or ask if Hmz has moved to another branch).

Do not run `git worktree remove` on anything containing a junction to `node_modules`: on 2026-09-23 that deleted part of the real `node_modules` through the link (repaired with `yarn install --frozen-lockfile`). Remove junctions with `cmd /c rmdir <path>` first.

## Close out

State plainly: what shipped, the pack size, what Hmz approved, and any question left for him. Note that V8.7 (re-capture the landing footage) is no longer blocked by V9 but still waits on V8.4 and V8.5; the plan assigns it Sonnet 5 for captures and Haiku 4.5 for dead-code removal.
