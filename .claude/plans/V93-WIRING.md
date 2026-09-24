# V9.3 wiring brief (the Sonnet half)

The design half is done and committed: `src/lib/avatar/animationManifest.ts`, `director.ts`,
`skeletonMasks.ts`, `look.ts`, with 122 table-driven tests (`yarn test`, 207/207 total). This
brief is the settled design for wiring them into the app. **Execute it; do not redesign it.**
If something here turns out to be wrong in the running app, fix the smallest thing, and write
down what and why in V9-REPORT.md.

Read first: `NEXT-SESSION-V93-DIRECTOR.md` (acceptance, ground rules), the header comments of
`director.ts` and `animationManifest.ts`, and the current `Teacher.tsx` state machine (lines
~515-676) including every comment in it.

## Decisions already made (do not re-open)

| Decision | Why |
|---|---|
| **Pointing stays a full-body base clip**, not the catalogue's upper overlay | Its fingertip was placed on the panel edge with the clip's own hips (V9.2b). A talking base's hips would swing the aim. Recorded in `SCENARIOS.point` |
| **Nod and shake are head-only overlays** (`mask: "head"`), not base clips | The body keeps talking under a nod. Also makes the reaction visible in lessons at all: see next row |
| **Reactions are latched events**, not the `gesture` level | `submitAnswer` sets `"nodding"`, then the next segment's effect sets its own gesture in the same tick. Sampled once a frame, the nod was nearly always missed in real lessons. The renderer latches it with a store subscription (below) |
| **ShakeNo still plays for a wrong answer** | Keeps today's behaviour. The catalogue wants a gentle "let's look again" instead; that needs a Tier 2 clip. Flag it to Hmz in the report, don't remove it |
| **Overlay = weight dominance on one mixer** | three has no bone masks. A masked copy of the clip at weight `w` over a base of weight 1 shows `w/(w+1)` of it (`PropertyMixer.accumulate` is a running weighted average; checked in three 0.161's source). `overlayWeight()` converts the eased blend into that weight |
| **Crossfades 0.4 s** (was 0.5) | The programme's bar is <= 0.4 s |
| **Idle3 → long wait, Talking6/6M → greeting** on Marcus/Priya too | Their old pools had the fidget in idle and the wave in talking. Retired from the picker; the new tags are what the catalogue asks for |
| **Custom teachers keep their short clip list** (`CUSTOM_CLIP_SET`) | Same clips as before. So no greeting or long wait for them, which is a sane degradation. Widening it is a one-line change once someone checks the Avaturn pack on a generated body |
| **`lessonComplete` becomes a store field** | The catalogue said "props", but `useLessonPlayback` lives in `LessonPlayer` (DOM tree) and the teacher in the R3F canvas. No props path joins them. It's a non-persisted mirror of the hook's `isComplete`, which is transport, not a new signal |
| **Face hints are output only** | V9.4 renders expressions. V9.3 leaves the face code as it is |
| **No eyes, no drift or saccades** | V9.4. V9.3's look layer turns the head only |

## 1. Store and playback (`useAristoStore.ts`, `useLessonPlayback.ts`)

- Add `lessonComplete: boolean` (default `false`), `setLessonComplete`. **Not** in `partialize`.
- In `useLessonPlayback`: `useEffect(() => { setLessonComplete(isComplete); }, [isComplete])`,
  and reset it to `false` on unmount and whenever the lesson changes (next to wherever
  `setIsComplete(false)` already runs).

## 2. Avatar config (`Teacher.tsx`)

- Replace `AvatarConfig.clips: { idle, thinking, ... }` with `clips: readonly string[]`, a clip
  set from the manifest: Jake/MJ `CANINO_CLIP_SET`, Marcus/Priya `AVATURN_CLIP_SET`, Ryan/Sonia
  `LEGACY_CLIP_SET`, custom `CUSTOM_CLIP_SET`. Delete `CANINO_CLIPS`. Move its useful comment
  facts into the manifest rows if they are not already there (they mostly are).
- The mount clip is `MOUNT_CLIP` (`"Idle"`); keep the rule that it lives in the base GLB.
- `grep -rn "clips\." src pages` after the change: only `AvatarLab.tsx` touches `clips`, and its
  `report.clips` is unrelated.

## 3. The renderer (`Teacher.tsx`)

Delete: the `animation` state and its `[cfg]` reset effect, the resolution effect, the idle
interval, the auto-revert effect, `gestureRef`, the play effect, `cycleAt` in `useFrame`, and
`loaded`. Keep: `ClipPack`/`ClipPackBoundary`/`onPackLoad`, `getAction`, materials, blink,
thinking dots, the morph code, the `Html` label, the mixer stop on unmount, the clone.

Add, in this order inside the component (**after** `useAnimations`, because drei's
`useFrame(mixer.update)` must run before ours each frame):

**a. Available clips.** A ref `Map<string, number>` of name → `clip.duration`, holding only
names in `cfg.clips`. Fill it from `animations` (memo on `animations`) and in `onPackLoad`.
This is the director's `available`; when a pack lands, the map grows and the director picks
the new clips up at the next boundary. No re-render needed.

**b. Masks.** `useMemo` on `scene`: traverse for `isBone`, build `BoneInfo[]` (parent name
if the parent `isBone`, else null), `skeletonMasks(bones)`. The director's `masks` set is
`"full"` plus whichever of `upper`/`head` came back.

**c. Masked actions.** `overlayAction(name, mask)`: cached in a ref by `${name}@${mask}`. Get
the source clip from `getAction(name)?.getClip()`, `clip.clone()`, set `name` to
`${name}@${mask}`, keep only the tracks where `maskTrackNames` keeps the name, then
`mixer.clipAction(masked, group.current)`. Set it up with `setLoop(LoopOnce, 1)` and
`clampWhenFinished = true`. **Never** reuse the base action for an overlay: the separate clip
object is what keeps a reaction from ever clamping the base (the V9.2 bug).

**d. Reaction latch.** In a `useEffect`, subscribe to the store:
`useAristoStore.subscribe((s, p) => { if (s.gesture !== p.gesture && (s.gesture === "nodding" || s.gesture === "shaking")) reactionRef.current = { kind: s.gesture, id: ++counter } })`.
Unsubscribe on cleanup. The counter starts at 0 per mount.

**e. Director state.** `directorRef = useRef(createDirectorState(MOUNT_CLIP, seedSignals()))`,
created once per mount (the teacher is keyed by avatar in `SafeTeacher`, so a switch is a new
mount and a new director). `clockRef` accumulates `delta`.

**f. Signals, per frame.** Read `useAristoStore.getState()` inside `useFrame`, not through
hooks: no stale closures, no re-render per signal. `phase` = the phase of the segment in
`s.activeLesson?.segments` whose id is `s.currentSegmentId` (null if none). Put that lookup
in a small pure `phaseOf(lesson, segmentId)` in `director.ts`, with a table test.
`modelShown = !!s.activeModelUrl && s.viewMode3d` (the same condition `Experience.tsx` uses to
show it). `quizActive = !!s.activeQuiz`. `reaction = reactionRef.current`.

**g. Apply the base,** when `out.base.seq !== appliedBaseSeq`:
- the previous base action: `fadeOut(out.base.fade)`;
- the new one: `setLoop(LoopRepeat, Infinity)`, `clampWhenFinished = false`,
  `timeScale = out.base.timeScale`, **`reset()` only if `!action.isRunning()`** (an action still
  fading out keeps its time: resetting it is the V9.1d pop), then
  `fadeIn(mixer.time > 0 ? out.base.fade : 0).play()`;
- keep the first-mount prime: `if (mixer.time === 0) mixer.update(1 / 60)`.
  The mount clip must be playing before the first frame, as today. Do it in a layout effect on
  mount, not in `useFrame`, or the T-pose flash comes back.

**h. Apply the overlay.** Keep a small list of live overlay plays (normally one; two while one
preempts another). When `out.overlay?.seq` is new and `out.overlay.clip` is non-null: if an
older play is still live, clamp its timing to fade out over the new one's `fadeIn` (set its
`fadeOutAt = now`, `endsAt = now + fadeIn`). Then `reset().play()` the masked action at
`timeScale = out.overlay.timeScale`. Every frame, for each live play:
`action.setEffectiveWeight(overlayWeight(overlayBlend(play, now)))`. Once `now >= endsAt`,
`stop()` it and drop it. Do not use `fadeIn`/`fadeOut` on overlays: they scale the weight
linearly, and through the dominance ratio that ramps far too fast (a pop).

**i. Release.** If `out.release` is set and `getState().gesture === out.release`, call
`setGesture("idle")`. This is the old auto-revert, now timed by the director.

**j. Look (after everything above, same `useFrame`).** Head bone: the last bone of the head
chain (find it once, with the masks). Once per mount, before any animation (in the same
memo as the masks, after `scene.updateMatrixWorld(true)`), record the head's forward axis in
its own local space: `fLocal = inverse(headWorldQuatRelativeToScene) * (0, 0, 1)`. Each frame:
1. **Recover the clip's head rotation.** If `head.quaternion` still equals the one written last
   frame (exact compare), the mixer did not write this frame. That happens when the value is
   unchanged or the head track was dropped as rest (V9.2 diet). Then use the stored clip
   value; else take `head.quaternion` as the clip value and store it. Without this, the look
   offset compounds frame after frame on a still head.
2. `head.parent.updateWorldMatrix(true, false)`. Current head direction in the teacher's space
   (the `group`'s space): `groupInv * parentWorldQuat * qClip * fLocal`. Target direction:
   `groupInv * (targetWorld - headWorldPos)`.
3. `aimAngles(target)`, `yawPitchOf(current)`, `lookOffset(current, aim, LOOK_WEIGHT[out.look])`.
   Damp the applied yaw/pitch toward that offset with `damp(..., LOOK_RATE, delta)`, so
   switching targets or dropping to `none` eases rather than snaps.
4. Apply: build the offset rotation in the teacher's space (yaw about +Y, then pitch about the
   yawed +X), move it into the head's parent space, `head.quaternion = offsetParent * qClip`.
   Store what was written for step 1.

Targets (world space), passed as a new optional `lookTargets` prop from `Experience.tsx`
through `SafeTeacher`: `board` and `model` = `[SCENE_X, SCENE_Y, SCENE_Z]` (the same anchor);
`desk` = `DeskQuiz`'s `PAPER_ANCHOR` (export it); `camera` = `state.camera.position` in
`useFrame`. With no prop (the dev pages), use camera for everything.

## 4. Tests to add (bulk)

- `phaseOf`: no lesson, no segment id, unknown id, each phase.
- Manifest integrity: every id in every clip set has a manifest row; `MOUNT_CLIP` is in every
  set; every upper clip's mask is `upper` or `head` and every base clip's is `full`; every
  scenario's fallback chain terminates; no clip has `weight <= 0` unless it has no scenarios.
- Coverage table (the report wants it): for each rig's clip set, each catalogue row resolves to
  how many clips. `it.each` over rows, snapshot the counts with `toMatchInlineSnapshot` so a
  future pack change shows up in review.

## 5. Verify in the app (browser pane, `/dev/free-model` and `/demo`)

Use the `window.__v92` mixer-freeze hook from V9.2b ("Tooling paid for this session" in
V9-REPORT) if you need exact frames. Revert it before committing, as before.

- Jake and MJ: idle rotates and holds; talking cycles with no repeats; thinking cycles.
- Pointing: with the pack, crossfade Talking → Pointing, **no arm pop**. Fingertip still on the
  panel edge (look to `board` must not pull it off; if it does, drop `LOOK_WEIGHT.board`).
- Nod (FreeModelPreview button, or `setGesture("nodding")`): head nods, the body keeps its
  clip, the store gesture returns to idle at about 2.6 s. Shake: same, about 3.1 s.
- Block the pack (404): pointing plays talking, nod keeps idle looping and reverts at 2.0 s,
  the teacher stays up.
- Greeting: reload, the teacher waves once when the pack lands.
- Long wait: leave it quiet 25 s, Idle3 plays over the idle legs, and the feet do not slide.
  Start talking mid-fidget: it fades out.
- Look: the head follows the camera within the clamp, turns to the desk in the quiz.
- `/demo` end to end: the scripted nod on any answer now shows over the next segment's talking.
- Custom teacher (`/create-teacher` output or `customTeacherGlbUrl` set to a known Avaturn
  GLB): plays, nods, no greeting (expected).
- Crossfades: no pops at any switch (the largest per-step bone change must stay inside a clip's
  own motion, the V9.2 check).

## 6. Close out

Gates, `typescript-reviewer` on `Teacher.tsx`/`Experience.tsx`, the V9.3 section in
`V9-REPORT.md` (with the coverage table and the ShakeNo question for Hmz), tick V9.3 in the
plan checklist, `decisions.md` rows for the decisions table above, `state.md`, push to
`origin docs/v8-v9-programme`.
