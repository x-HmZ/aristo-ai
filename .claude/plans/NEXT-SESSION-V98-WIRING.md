Finish V9.8 (Sonnet): wire the four batch 3 clips through the director, test, check in the app, close out. The authoring half is done and pushed (commits 180b9ba onwards on `docs/v8-v9-programme`). The brief was Hmz's V9.8 prompt (its "Verify in the app" and "Ground rules and close-out" still apply); this file records what the Opus half decided and shipped. Rules for every clip: `.claude/plans/NEXT-SESSION-V96-TIER2-CLIPS.md`. Shape of the wiring: follow V9.7 (`.claude/plans/V9-REPORT.md`, "V9.7", "The director change").

## Shipped in both packs (Jake and MJ), reviewed by Hmz on `/dev/avatar-lab`

| Clip | Catalogue row | Signal | Length (s, from the GLBs) | Layer / mask | Notes |
|---|---|---|---|---|---|
| OneMoment | 4 | `isLoading` rising edge | 2.04 | overlay, `upper` | Right index raised in front of the shoulder, palm to the student, other fingers folded. Must be allowed over `thinking` (the base it hands over to); Thinking is not in QUIET/TALKING_BASES, so give it its own `over` |
| PointNear | 8 | `point` (existing) | 6.04, loops | **base**, `full` | Left index into the near third of the panel, chest and head turned to it. Built on two passes of Idle4; loop seam 0.00 deg. Never time-warp it (like Pointing: the aim is the point) |
| PatientTilt | 15 | `listen`, see below | 3.04 | overlay, **`head`** | Head tilts ~12 deg to his left, chin a touch down. Neck and head only on purpose (a chest lean put MJ's hip hand 12 mm into her skirt over Talking4) |
| BackToBoard | 17b | `wrong` while `previewImage` is set | 2.04 | overlay, `upper` | Chest and head turn back to the board, a light open left hand to it. Give it `look: "board"` (like GlanceBoard) so the look layer does not pull the head back to the student |
| ~~OverToYou~~ | 18 | `activeQuiz` rising edge | - | - | **Not shipped.** Hmz rejected all three rounds (the sweep: "the arm movement is very unnatural") and dropped the row: look layer only |

All: source "authored in Blender for Aristo (V9.8), scripts/v9_gesture.py", licence "Aristo's own", `mirrorable: false`, own `family`, `CANINO_CLIP_SET` only. Read durations with gltf-transform (meshopt decoder, see `v9_verify_anim.mjs`) if in doubt; the values above were read that way.

## Decided by Hmz (2026-09-27), do not re-ask

- **PatientTilt trigger:** once per question, about 4 s after the teacher stops talking while the student still has not answered (base `listen`, `awaitingAnswer` true, not speaking, not loading). Not again for the same question; the existing long wait (25 s, Idle3/GlanceBoard) takes over after it. A new question (a new challenge segment, or `awaitingAnswer` going false then true) re-arms it.
- **PointNear beside Pointing:** one hand per pointing stretch, about half and half. Today `point` is `play: "cycle"`, which would swap hands at every clip end; make it pick once when the point starts and keep that clip for the whole stretch (for example `play: "dwell"`: DWELL_S is 20 s, longer than a pointing segment). Both at weight 1.
- **OverToYou dropped (row 18):** no gesture when the quiz is handed out; the look layer turning the head to the desk (`quizLook`) is the "over to you". Wire no `quizHandout` scenario. Rounds 2 and 3 kept as `OVER_TO_YOU_R2` and `OVER_TO_YOU` in `V98_NOT_SHIPPED`, never exported.

## Also done in the Opus half (goes in the report)

- **Tool (`v9_gesture.py`):** `digits` (one finger at a time; openness below 0 bends it about its own Z, -1 a full tuck; the Canino finger bones flex about local Z, -Z left hand, +Z right, measured on both rigs); `on`/`passes` (a full-body clip riding a base loop; an empty spec on Idle4 reproduces Idle4 to 0.0 deg / 0.025 mm); `fit` (coordinate descent on a static pose); `panel_hit` (where an index ray meets the image panel; calibrated against Pointing, which lands where V9.2b measured it in three.js); `hand_frame`; `tuck_point`.
- **Pointing's hand fixed, approved by Hmz ("pointing looks good now"; before: "this looks so wrong in the pointing clip for both mj and jake", then "the angle of the pointing finger looks unnatural").** The Mixamo clip left the middle finger half out and the others loose (a claw), and its index was bent back about 9 deg at the knuckle and splayed 12.5 deg towards the thumb. `tuck_point` folds middle, ring, little finger and thumb to PointNear's shape and sets the index to a small forward bend (8, 4, 2 deg) with no splay, weighted by hand height. Aim after: Jake u 0.01-0.05 v 0.59-0.62, MJ u -0.05 to -0.01 v 0.57-0.59 (before: Jake 0.04-0.08 / 0.67, MJ -0.03-0.01 / 0.63), still at the near edge. A 4 deg splay moved the aim further off, so none. Originals kept in the scene as `<T>_Pointing_v97`.
- **Drafts:** PointNear 1 (plus a smaller push: at 6 deg MJ's fingertip came within 2 mm of the panel), OneMoment 1, BackToBoard 2 (the arm out straight was a full PresentModel; then lift-before-turn and untwist-before-drop, 32 mm to the trousers against 60 at rest), PatientTilt 3 (7 deg did not show; the chest lean hit MJ's skirt), OverToYou 2 fronts that read only from the side, then the sweep, whose path was set by MJ's armpit and sleeve (see the spec comment).
- **MJ's armpit, learnt the hard way:** her armpit skin sits between the tee's arm and chest panels. It comes through when the upper arm is pulled in to the body without swinging forward, and pushing the skin further in (`push_under`) drives it into the chest panel. Reverted; the gesture path avoids it instead.
- **Checks, both teachers, all five plus Pointing (OverToYou's numbers are for round 3, not shipped):** `find_pokes` 0 (MJ torso, arm, legs, tee against skirt; Jake body against shirt, trousers, shoes); MJ `check_through` 0 over Idle, Idle2, Idle4, Talking, Talking4; a camera-ray test (arm skin visible within 6 mm in front of the tee, lesson camera and +-0.5 rad) 0 for OverToYou; hands never closer to shirt or trousers than at rest; `v9_verify_anim.mjs` worst 0.0156 deg / 0.119 mm (Jake), 0.0166 deg / 0.242 mm (MJ).
- **Known, not fixed:** one vertex of MJ's arm skin (2407, right upper arm) is 2.2-2.7 mm through her tee in her own Idle and Idle4 with no gesture playing. It predates V9.8.
- **Sizes (OverToYou not shipped):** Jake pack 676,368 to 739,804 B, MJ pack 703,156 to 767,240 B; base files +8 B each (2,284,144 and 1,776,888).
- Scene backup `bakeoff_scene_pre_v98.blend`; review frames `v98_*.png` in the bake-off folder.
- `AvatarLab.tsx`: lists the four shipped clips; the base row gained Thinking (for OneMoment) and PointNear (a base clip from the pack).

## The director change (Sonnet)

- Scenarios in `animationManifest.ts`: `oneMoment` (over `thinking`), `listenBeat` (PatientTilt, over `listen`), `wrongBoard` (BackToBoard, falls back to `wrong`); `point` gains PointNear. Fresh `row` numbers after 25, as V9.7 did.
- Edges in `director.ts`: `isLoading` rising, the listen timer above, and `wrong` choosing `wrongBoard` when `sig.previewImage` is set (the signal exists since V9.7). `wrong` preempts like today.
- Tests: coverage snapshot in `manifest.test.ts`, one director test per new scenario, PatientTilt once per question and re-armed by a new one, the point pick staying for a stretch, BackToBoard's look, and that Marcus, Priya, custom and legacy sets are unaffected.
- `typescript-reviewer` on the director and Teacher.tsx diff.

## Still open

- Nothing for Hmz.
- **Done (Sonnet, this session):** the four clips wired (`oneMoment`, `listenBeat`, `wrongBoard` scenarios;
  `point` gains PointNear and switched to `play: "dwell"`); manifest + director tests (337, was 314);
  `typescript-reviewer` on the diff found one real bug (OneMoment's rising edge could be silently lost for a
  whole loading stretch if blocked at that exact tick), fixed with an `oneMomentPending` retry flag and covered
  by two regression tests; type-check clean, lint 10 (unchanged), build green;
  checked in the app on Jake and MJ (`/dev/free-model`, forced through the store) -- `/demo` needs a real
  wrong-answer/quiz flow to see BackToBoard and OneMoment fire from real signals rather than forced ones,
  not separately re-checked there this session; `/learn` not opened (auth). Close-out done: V9-REPORT
  "V9.8", LICENSES.md, decisions.md (five rows: PatientTilt trigger, one hand per point, OverToYou dropped,
  Pointing's hand, MJ's armpit), state.md, `V96-GESTURE-CATALOGUE.md` (row 18: dropped, look layer only;
  batch 3 marked done).
