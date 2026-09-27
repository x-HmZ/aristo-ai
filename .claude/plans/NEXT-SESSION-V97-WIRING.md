Finish V9.7 (Sonnet): wire the six approved teaching-move clips through the director, test, check in the app, close out. The authoring half is done and pushed (commits a7c50de..6621dfe on `docs/v8-v9-programme`). The brief is still `.claude/plans/NEXT-SESSION-V97-TEACHING-MOVES.md` ("The director change", "Verify in the app", "Ground rules and close-out"); this file only records what the Opus half decided and shipped.

## Approved by Hmz in motion (2026-09-27), all in both packs

| Clip | Signal (brief) | Length (s) | Hands | Notes |
|---|---|---|---|---|
| Imagine | segment role `hook` | 2.2 | both | Palms-down level sweep apart, curious tilt |
| HoldIdea | phase `explain`, sparse beat | 2.5 | both | Palms facing, cupped, one shaping beat |
| StepBeat | segment role `demo_step` | 1.4 | right | One chop, lands about 0.6 s in |
| MoveOn | segment role `transition` | 1.6 | right | Forward roll, opens palm up (Hmz picked B over a palm-down brush) |
| YourTurn | segment role `challenge_setup` | 2.0 | both | Both palms offered forward, small lean. **Play at 0.85**: `timeWarp: [0.85, 0.85]`, like the greeting wave |
| BringTogether | phase `connect`, sparse beat | 2.4 | both | Wide to close, never nearer than 182 mm |

All are `upper`-mask overlays, played once, Canino rigs only (`CANINO_CLIP_SET`), `mirrorable: false`, source "authored in Blender for Aristo (V9.7)", licence "Aristo's own". Read exact durations from the GLBs with gltf-transform before writing them into the manifest. Also in batch 2 (data only): a new board image (`activePreviewImageUrl` changes) plays PresentModel.

## Also done in the Opus half (goes in the report)

- **Hands (Hmz: "the hands remain flat ... rigid and not life like").** `v9_gesture.py` specs can set `"life": True`: finger cascade (index most open, pinky least), bent fingertips, staggered unfurl, a slow drift while held, and wrist follow-through (0.1 s lag, half strength). Built with `finish(..., relax=0)`. All six V9.7 clips and the six V9.6 hand clips (PresentModel, Encourage, Almost, Exactly, WellDone, ThatsIt) use it; Hmz approved both sets. Exactly and MoveOn start and end slightly open, and MoveOn lifts before it drops, to keep MJ's fingertips out of her skirt.
- **MJ's shirt (Hmz: "looks a bit chopped").** Arm-skin triangles showed through the front of her sleeves as skin patches, and one head-mesh face showed as a nick under the collar. The vertex-based `find_pokes` passed both (it skips skin within 1 cm of a garment edge, and a face can cross the cloth between vertices that are under it). Fixed in the mesh: head face pushed 3 mm under, the arm skin the sleeves cover 3 mm further in, the cuffs flared 5 mm off the arm. A camera ray test (skin within 6 mm in front of the sleeve or collar, three views, every clip) went from 422 hits in Idle to 0; the rest are grazing rays at the cuff rim. MJ keeps 17 visemes and her three base clips.
- **Rejected or not shipped:** Imagine B (pointed at empty space, then read as a wave; did not converge in three drafts), MoveOn A, YourTurn A. Specs kept in `V97_NOT_SHIPPED`.
- **Checks, both teachers, all 13 hand clips:** `find_pokes` 0; MJ `check_through` 0 over Idle, Idle2, Idle4, Talking and Talking4; hands never closer to shirt or trousers than at rest; `v9_verify_anim.mjs` worst 0.0166 deg / 0.242 mm.
- **Sizes:** Jake pack 577,352 to 676,368 B; MJ pack 603,744 to 703,156 B; Jake base unchanged (2,284,136 B); MJ base 1,776,860 to 1,776,880 B (the shirt fix).
- Scene backup `bakeoff_scene_pre_v97.blend`; review frames `v97_*.png` in the bake-off folder.

## Still open for the Sonnet half

- The beat rate for HoldIdea and BringTogether (brief: sparse, for example at most one per phase or every second segment). Say what was chosen; ask Hmz if unsure.
- `AvatarLab.tsx` already lists the six by their final names.
- Close-out per the brief: V9-REPORT "V9.7", LICENSES.md, decisions.md (hand life; MJ shirt fix; MoveOn and YourTurn picks; YourTurn at 0.85), state.md, plan checklist, batch 2 marked done in `V96-GESTURE-CATALOGUE.md`.
