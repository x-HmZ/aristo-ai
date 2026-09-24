Finish V9.6 of the teacher programme: wire the seven approved Tier 2 clips, verify them in the app, ship and
close out. Model: **Sonnet**. No authoring and no Blender work in this half: the clips are final and already in
the packs. If something in the app needs a clip changed, stop and say so (that goes back to Opus).

Read `CLAUDE.md`, the top of `.claude/docs/state.md`, `.claude/plans/NEXT-SESSION-V96-TIER2-CLIPS.md` (the
original brief: steps 4 to 6 and the close-out are still yours), and `.claude/plans/V96-GESTURE-CATALOGUE.md`
(why these clips exist). Everything the authoring half decided is below; do not re-ask any of it.

## Approved by Hmz in motion on /dev/avatar-lab (2026-09-24)

All authored in Blender for Aristo (V9.6), both teachers, in `Teacher_{Jake,MJ}_clips.glb` (the pack), upper
mask, played once. Durations are the real GLB lengths (24 fps).

| Clip | Scenario | Duration | Notes |
|---|---|---|---|
| PresentModel | `presentModel` | 2.63 | left palm towards the model; head left to the look layer |
| Encourage | `quizSupportive` | 2.54 | right palm offered forward, soft nod |
| Almost | `wrong` | 2.04 | warm tilt, right hand palm down rocking "so-so". **weight 3** |
| Exactly | `correct` | 1.83 | open left palm forward, one small nod. Beside Nodding, equal weight |
| WellDone | `quizGood` | 2.46 | both arms open, palms up. Beside Nodding, equal weight |
| ThatsIt | `lessonComplete` | 2.63 | hands gather, then open palms up. Replaces the fallback to quizGood on Canino |
| GlanceBoard | `longWait` | 2.83 | turns to the board; **`look: "board"`** (see below). Beside Idle3; give it a cooldown (30 s suggested) |

Also decided:

- **ShakeNo stays in `wrong` at weight 1** (Almost 3): a shake about one wrong answer in four. Hmz chose "lower".
- **Talking6 and Talking6M play at 0.75**: `timeWarp: [0.75, 0.75]` on both rows (Hmz picked it in the lab).
- LookAgain and LookAgainHand were rejected and are no longer in the packs. Do not add rows for them.
- Jake's and MJ's `viseme_PP` were softened to 0.6 in the base GLBs (committed, Hmz: "visemes look better").

## Already done in code (committed or about to be, check `git log`)

- `ClipSpec.look` (`animationManifest.ts`) and its use in `stepDirector` (`director.ts`): while an overlay clip
  with a `look` plays, until its fade-out starts, the head aims there instead of the base's target. Tested with a
  fixture in `director.test.ts` ("follows an overlay clip's own look..."). GlanceBoard needs it because the look
  layer otherwise pulls the head back to the student at weight 0.5 and halves the glance.
- `/dev/avatar-lab` plays any pack clip as a masked overlay with the director's fades, has a "classroom" framing
  and a speed choice. It has no look layer, so head turns look bigger there than in lessons.

## To do

1. **Manifest rows** in `CLIP_MANIFEST`: one per clip above. `source: "authored in Blender for Aristo (V9.6)"`,
   `licence: "Aristo's own"`, `layer: "upper"`, `mask: "upper"`, `play: "once"`, the duration above, `weight`
   (Almost 3, the rest 1), `cooldown` (0, GlanceBoard 30), `mirrorable: false`, `family` = its own id.
   GlanceBoard gets `look: "board"`. Add the seven ids to `CANINO_CLIP_SET` only (not Avaturn, custom or legacy).
   `timeWarp: [0.75, 0.75]` on Talking6 and Talking6M.
2. **Tests:** update the coverage snapshot in `manifest.test.ts` (rows 2, 9, 13, 14, 16 good, 16 supportive and 18
   gain clips on Jake and MJ; the other rigs are unchanged), and the director tests that assumed those rows were
   empty or Idle3-only (`"quiz not passed: no clip yet"`, `"lesson complete nods"`, the long-wait tests that
   expect Idle3 first). Add one director test per new scenario playing its clip, one for the wrong-pool weights
   (Almost picked about three times as often as ShakeNo over a seeded run), one for GlanceBoard's look, and one
   for the greeting's 0.75 time scale.
3. **Verify in the app** (Jake and MJ; `/demo` and `/dev/free-model`). A dev server this session started is on
   port 3000: reuse it, do not start a second. Force each scenario through the store (the V9.2b `window.__v92`
   hook pattern, reverted before committing), and check: the overlay blends in and out with no pop, the base keeps
   playing, the other arm keeps the base's motion, and GlanceBoard's head reaches the board. Screenshots or a frame
   strip for Hmz. `/learn` needs auth: say so rather than claiming it.
4. **Gates:** `yarn type-check`, `yarn lint` (10 warnings), `yarn test`, `yarn build` (temporary `distDir` because
   the dev server holds `.next`; revert `next.config.mjs` and `tsconfig.json`). `typescript-reviewer` on the diff.
   Push to `origin docs/v8-v9-programme` (the authoring commits are local and unpushed too).
5. **Close-out:** V9-REPORT.md "V9.6" (what shipped, the rejected LookAgain and why, the PP fix, the look change,
   coverage table update, pack size: Jake 500,280 to 577,352 B, MJ 526,496 to 603,744 B, base files changed only by
   the PP fix), LICENSES.md (the seven clips are Aristo's own work inside the CC BY GLBs, not Mixamo-derived),
   decisions.md (ShakeNo weight, wave speed, PP 0.6, clip-level look, LookAgain rejected), state.md top entry, plan
   checklist (add and tick V9.6), and mark batch 1 done in `V96-GESTURE-CATALOGUE.md`. Batches 2 and 3 are the next
   authoring work (Opus).
