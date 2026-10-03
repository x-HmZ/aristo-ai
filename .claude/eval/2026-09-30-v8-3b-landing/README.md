# V8.3b landing: design rounds and the note 7 face (2026-09-30)

Plan: `.claude/plans/V8.3b-landing-plan.md`. This folder holds the evidence from before the build. The build's own
evidence (load, frames, AA, captures, recordings) is added here as it lands.

## Mockups (`mockups/`)

Real HTML on the app's tokens (`mock.css` mirrors `globals.css` as hex), with:
- the real mark;
- the real heart lesson's diagram, model, lines and word timings;
- the real course map (`build.cjs` writes `data.js` from `markPaths.ts`, the KG snapshot and `seg_004.align.json`).

Open any file in a browser; `?theme=light|dark` forces a theme and `?still=1` shows the settled state. Nothing here
ships.

| Round | File | Sheet | Hmz |
|---|---|---|---|
| 1 | `a.html` Lesson Objects, `b.html` The Lit Window, `c.html` Line and Light | `shots/sheet-a..c.webp` | liked A's style and B's teacher; the tilted quiz card read badly |
| 2 | `d.html` Lesson Objects in the Room | `shots/sheet-d.webp` | wanted Jake presenting per section, with the room as one Immersive section |
| 3 | `e.html` Jake Presents | `shots/sheet-e.webp`, `e-crop-*.webp` | **approved**, with two hard requirements (plan, round 3) |

`jake/*.webp` are Jake's poses on a transparent ground (`scripts/jake-poses.cjs`, from `/dev/avatar-lab`), and
`jake/heart.webp` is the real heart alone (`scripts/heart.cjs`). **The poses' framing made Jake look slim in the hero
(Hmz); they are for the mockups only.** The build renders the product's `Teacher` live.

## Note 7: Jake's idle face (`face/`)

- `sheet.webp`: five resting faces, at face distance and at the classroom camera (zoomed 3x). Hmz picked smile 0.8
  with lids 0.12.
- `pair-sheet.webp`: Jake and MJ before and after, once shipped (54f15a6). Shipped app-wide and gain-scaled.

## Scripts (`scripts/`, all checked with `node --check`)

| Script | What it does |
|---|---|
| `face.cjs`, `face-pair.cjs` | Idle-face captures from `/dev/avatar-lab` (`?who=&view=&clip=&smile=&lid=&blink=0`) |
| `jake-poses.cjs`, `poses-sheet.cjs` | Jake's poses as transparent images, and a sheet of them |
| `heart.cjs` | The real heart model rendered alone (three 0.161.0 from unpkg; model and Draco from the dev server) |
| `mockups.cjs`, `sheets.cjs` | Full-page captures of the mockups (1280 and 360, light and dark), with overflow, and contact sheets |
| `measure.cjs` | The hero lines' width in Archivo wide caps (9.61em at wdth 125, 8.59em at 112) |
| `overflow.cjs`, `crop.cjs` | The elements past the viewport; a crop of a capture |
| `webp.cjs` | PNG to WebP in place (the captures are stored as WebP; the capture scripts write PNG) |

Every capture ran headless on the GPU with `/api` aborted: 0 API calls, 0 paid calls.

## The build: first sections (nav, hero, the model build), for Hmz's review

Steps 2 to 5 of plan section 8, plus the model section (round 3's "It Builds the Model"). Curated evidence in
`first-sections/` (WebP and JSON); raw captures go to `build/` (ignored). All headless on the GPU, `/api` aborted:
0 API calls and 0 paid calls in every run.

- **How Jake is rendered:** the product's `Teacher`, live, on one transparent canvas that moves to whichever spot is
  most in view. The camera is the classroom's own lesson camera and Jake stands where the classroom puts him; a spot
  only picks the crop of that view that fills its box (an off-axis frustum, `stage/spots.ts`).
- **Proportions** (`proportions.json`, `proportions.webp`): against `public/images/landing/v3/idea.webp` at the same
  head-to-belt scale, chest width -1.5% and waist +1.8%, within measurement noise (idea.webp was shot from the
  display pose, not the lesson pose).
- **Peaks** (`peaks.json`, `*-peak-*.webp`, `*-strip-*.webp`): the frame is chosen from Jake's bones read in the same
  frame (`?probe`), not by eye.
  - Wave (hero): the raised hand's highest frame, about 1.3 s after he appears.
  - PresentModel (model): his left fingertip at its furthest reach; the heart's real bounds are 1.8 cm past it, and
    his open hand is at 0.36 of the heart's height. The heart is at the product's spawn scale (0.825).
- **Checks** (`check.json`): 360 / 768 / 1024 / 1280 / 1440, light and dark, 5 stops each. 0 AA failures (minimum
  4.74 light, For Parents' eyebrow on its tint, unchanged from V8.3; 5.97 dark), 0 targets under 44px, 0 overflow.
- **Load and frames** (`perf.json`, production build): `/` 116 kB first load (budget 135; `/demo` 135 unchanged). LCP is
  the hero still, 152 to 368 ms (lite at 360: 160 to 368). CLS 0. Jake live at 1.2 to 2.2 s. Frame p95 16.7 to 16.8 ms
  in every phase; 0% dropped while the model builds and while scrolling. The hero phase has one 100 to 150 ms frame
  (0.9 to 1.3%) as the stage finishes starting up (next: find it with long-frame attribution). Lite under a 4x CPU
  throttle (`perf-throttle4.json`): 0% dropped, LCP 740 to 764 ms.

| Script | What it does |
|---|---|
| `nav.cjs` | The nav at four widths, both themes: sheet, Escape, highlight, targets, overflow |
| `stage.cjs` | The canvas moving hero, close, hero: the layer's box against the spot's |
| `peaks.cjs` | Frames from the moment Jake is live at a spot, with bones, picking the gesture's peak |
| `stills.cjs` | The spots' stills from the live stage (`?full=1&still=<spot>`), to `public/images/landing/v3b/` |
| `proportions.cjs` | The side-by-side against the classroom render, measured |
| `check.cjs` | AA, targets, overflow and a screenshot per stop |
| `perf.cjs` | LCP, CLS, time to live, frame times (`THROTTLE=4` for the throttled lite run) |
| `review.cjs` | The review sheet |

### Round 2 (Hmz's review of the first sections)

Hmz: the hero is a hello, not a lesson; the landing shows features, not one hardcoded lesson (the lesson is the
demo's); the lesson's picture is an infographic; spread the topics (volcano, heart, volcano).

- **Hero** (`review-round2.webp`, `hero-*.webp`, `scripts/hero-play.cjs`): the heart lesson's line card is gone.
  Jake waves on arrival, then plays along with the product's own gestures:
  - his head and eyes follow the mouse pointer (a new optional `viewer` on Teacher's driver; the classroom path
    is unchanged);
  - hovering or focusing Try a lesson gets "your turn" (both palms offered);
  - a tap on him gets another wave, and coming back to the page after 3 s away gets a welcome-back wave.
  - Tried and dropped: an approving nod on Create an account. The product's "that's right" pool also picks
    "Exactly", a one-hand offer to his left, away from the button.
- **The model build** (`model-strip-*.webp`, `present-peak-*.webp`): it starts from the heart lesson's infographic
  (`teaching.jpg`, rounded card), whose drawn heart lifts into points onto the model. Re-verified peak: the fingertip
  is 2.2 cm from the heart's edge, and his hand is at 0.37 of its height, in both themes.
- **Topics from here:** It Finds the Ideas and It Draws the Picture use the volcano, the model build the heart, and
  Immersive the volcano. Five Moves is described in plain words, with no lesson lines.

### Round 3 (Hmz: one hand, and the gesture and the gaze must meet)

- Tried and measured: MoveOn (the product's one-hand "now, next", right hand, the buttons' side). On this rig the hand
  rolls up in front of the chest and opens low at his side: it moved 26 px towards the button and ended 49 degrees
  off the line to it. Rejected.
- **Chosen (Hmz): the hero is mirrored.** Jake is on the left, the text on the right, top-aligned with his head.
  Hovering or focusing Try a lesson gets the one-hand palm-up offer (PresentModel, his left hand). While it plays,
  his head and eyes go to the button: its look point is taken at his hand's depth (`GESTURE_Z`), not on the pointer
  plane, so the head turns where the hand goes.
- **Measured** (`hero-offer-peak.webp`, `peaks.json` heroPlay.offer): at the peak, shoulder to fingertip is 14 degrees
  from shoulder to the button's centre (was 30 with the old layout).
- **Framing:** the hero crop is a little closer (to the upper thigh), and it keeps his whole reach in the box at every
  width (`need` in `spots.ts`, unit-tested). The hero still was recaptured to match.
- **Checks** (`check.json`): 360 to 1440, both themes. 0 AA failures (minimum 4.74 light, 6.42 dark), 0 targets
  under 44px, 0 overflow.

### Round 4 (Hmz: the palm should point at the button)

- **Aim** (`src/components/landing/stage/aim.ts`, unit-tested): after the pose each frame, the shoulder turns (at
  most 25 degrees) so the shoulder-to-fingertip line meets the button, then the wrist (at most 30) so the hand does,
  which tips the palm towards it.
  - It is weighted by how far the arm is raised, so it grows and fades with the offer and never moves the arm at rest.
  - It never compounds when the mixer skips a bone.
  - It runs through a new optional `afterPose` on Teacher's driver; the classroom path is unchanged.
- **Measured** (`peaks.json` heroOffer, `hero-offer-peak*.webp`): at the peak, shoulder to fingertip is 5.4 to 5.9
  degrees from the line to the button's centre, and wrist to fingertip 0.7 to 3.6. That holds at 1024, 1280 and 1440
  in light, and at 1280 in dark (was 14 and not measured).

## The next sections: A Teacher of Your Own, It Finds the Ideas Inside, It Draws a Diagram

Commits 72ab2bc, 0ab9cd5, 747b148. Evidence: `sections-r5/` (`review-round5.webp`, `peaks.json`, `check.json`,
`perf.json`). New scripts: `section.cjs` (a section over time); `peaks.cjs` gained the hold and pointing measures;
`stills.cjs` now forces each spot to its capture size.

- **A Teacher of Your Own:**
  - The story's three beats (messaging.md) rise beside the mark, and the colonnade draws itself with its middle
    flute's place empty.
  - Jake holds the idea (the product's HoldIdea). While his palms are up, an orb of light shows between them, sized
    to 0.62 of the gap and following them as the stage reports them.
  - When his hands start down, it flies into the empty place and lights it.
  - **Measured:** palm gap 165 px, orb 102 px, 0 px off centre, 31 px clear each side.
  - **Tried and changed:** a flute-shaped bar between the palms floated in a gap five times its width.
- **It Finds the Ideas Inside (the volcano lesson):**
  - The panel sits at the classroom board's place and size, under the canvas, so his hand is drawn in front of it.
  - The topic types itself while he thinks (OneMoment, Thinking).
  - The lesson's own ideas appear and link; ringed ideas are what it builds on.
  - He points with PointNear, aimed at the magma chamber.
  - **Measured over three runs:** the finger is 3.6 to 4.3 degrees from the node, with the fingertip at its edge.
  - **Teacher change:** the driver gained `withhold`, so the landing never draws the Mixamo Pointing clip, which
    raises his right hand across his body.
  - Below 640 px the panel stands alone and he is not shown.
- **It Draws a Diagram for the Lesson (the volcano lesson's cross-section):**
  - It resolves noise, then lines, then colour at the board's place.
  - It is set 0.3 m back and enlarged to look identical, because PointNear brings his hand to the board's own plane
    and the hand vanished behind it.
  - He points at the crater: 6.2 degrees, in both themes.
  - The lines phase is ink on paper on a light page and chalk on a dark one.
- **Checks:** at 360 to 1440, both themes: 0 AA failures (minimum 4.74 light, 6.42 dark), 0 targets under 44 px,
  0 overflow.
- **Load:** `/` is 118 kB first load (budget 135). LCP 152 to 428 ms. CLS 0.
- **Frames:** every section plays at p95 16.7 to 16.8 ms with 0% dropped.
- **Open:** the hero's one 83 to 150 ms start-up frame, and one 133 ms frame in the steady scroll at 1440 light
  (probably Jake remounting at a spot change). Both are for the verification step.

### Round 6 (Hmz: no jump into the first frame, the cut-off wave, a better ideas section)

Commits a080b10, 495030a, b73e4e0. Evidence: `sections-r6/`.
- **First frames:** on the live path each spot's poster is now its section's first frame (`<spot>-start.webp`:
  Jake at rest, nothing built), captured with `stills.cjs <spots> <base> <wait> start` (`?still&start`). Going live
  no longer jumps from the finished state to the start. Lite and the stack keep the finished stills; the CSS swaps
  them by `data-mode`, and a lazy image that is not displayed is never fetched.
- **The wave:** decoded from the clip pack, Talking6 waves the right arm and Talking6M the left. The hero withholds
  Talking6. Three runs (`measures.json`): his left hand is up each time (y 0.30, right hand -0.43).
- **It Finds the Ideas Inside, redrawn:**
  - The panel is the classroom's dark display (`.theme-ink`).
  - A thinking glow gathers in its middle, and the ideas come out of it as orbs of the idea's own light: rings for
    what the topic builds on, filled for its own ideas.
  - The links draw like a constellation.
  - The pointing lands on the chamber's orb: 5.3 to 5.4 degrees, with the labels clear of his arm.
- **Checks:** at 360 to 1440, both themes: 0 AA failures, 0 small targets, 0 overflow. Tests 519.

## Session 2 (2026-10-01): Five Moves, the posters, the bounds, It Remembers

Evidence in `session2/`. New scripts:

| Script | What it does |
|---|---|
| `track.cjs` | A spot over its whole clock: bones, `[data-track]` marks and a screenshot per sample (`NOSHOT=1` for bones only) |
| `keysheet.cjs` | A sheet of a track's frames nearest given section times |
| `moves-peaks.cjs` | Five Moves: each gesture's peak, the piece against the hand that makes it |
| `remember-peaks.cjs` | It Remembers: the finger against each review point as the line reaches it (angle, miss px) |
| `handover.cjs` | Each poster against the first live frame (mean difference, silhouette shift) |
| `bounds.cjs` | Jake's mesh outside his box through each timeline (`?probe&wide=0.25`) |

- **Five Moves** (`session2/moves/`): round 1 (gestures with graphics at his hands) was "too vague" (Hmz); round 2
  tells one story on the board. Every piece within 4 px of its hand, both themes.
- **Posters** (`session2/posters/`): 0 px shift at 1024 to 1440 after the stillCss placement and the recapture.
- **Bounds** (`session2/bounds*`): before, Five Moves 85 px out and Ideas 5 px; after, 0 out, >= 23 px clear.
- **It Finds the Ideas Inside** removed (Hmz).
- **It Remembers** (`session2/remember/`): taps within 4 px, map and curve in both themes; checks.txt has the full
  AA/targets/overflow run.

## Session 3 (2026-10-01): Step Into the Classroom, then the rest

Evidence in `session3/`. New scripts:

| Script | What it does |
|---|---|
| `room-peaks.cjs` | The room tour's two gestures at their peaks: the pointing finger against its target (angle, line miss), the presenting fingertip against the model's real surface (nearest vertex, via the probe's `nearest`) |
| `room-stills.cjs` | The room's posters from the live stage at 16:9 (1600 x 900): `room-start.webp` (the tour's first frame) and `room.webp` (its end, lite and stack); refuses a blank box |
| `room-play.cjs` | The room's controls: a tab, a drag, Pause, Hear it (which mp3 is fetched) |
| `room-frame.cjs` | Jake in frame through the tour: head and hands against the box edges (from a `track.cjs` run) |
| `shift.cjs` | A poster against its live frame at every offset within +-R px: aligned (least at 0,0) or shifted |
| `check.cjs` | gained the `immersive` stop and `ONLY=` to run some stops alone |

### Step Into the Classroom (`session3/immersive/`)

- **The story** (`tour.webp`): the product's room, edge to edge. The camera comes in from the back of the room to
  the seat; Jake explains (the soda bottle, HoldIdea); the board: the cross-section lands and he points at it ("Take a
  look at this cross-section"), the camera leans in while he names the chamber; the picture becomes the volcano's
  model and he presents it; the camera glances down at the quiz on your desk (the product's QuizView on its paper,
  inert) and back up. His lines are the volcano lesson's own (seg_003, seg_008, seg_009, to sentence ends), silent
  with the words lighting, or heard (Hear it).
- **Peaks** (`peaks.webp`, `peaks.json`; light 1280 top, dark 1440 bottom):
  - pointing: the finger 0.4 degrees from the line to the picture's middle (the vent), its line 0.6 to 0.7 px from it
    on the page;
  - PresentModel: his fingertip 1.9 to 4 cm from the model's real surface, level with its base, outside it. The model
    is placed from his fingertip measured in the room (his head turns to the model, which moves his arm a little, so
    it was iterated to a fixed point).
  - Tried and dropped: a second pointing at the magma chamber. It is below what aim.ts may turn his arm to; the finger
    ended at the empty rock beside the vent. Also tried: a camera push to the chamber, which cut his head off.
- **Frame** (`room-frame.cjs`): head and hands inside the box through the tour (the desk glance aside) at 1024 and
  1440; the closest is a fingertip 22 px from the edge (before the board lean was nudged left).
- **Poster** (`handover-1440.webp`): the first frame held 0.6 s before the camera moves; poster against live: mean
  difference 1.8, best offset (0, 0) in every corner at 1024 (16:9) and 1440 (wider: the camera keeps the 16:9 width,
  as the poster's cover does).
- **Controls** (`controls.webp`, `play.json`): a tab lands on its shot (17.22 for The model) and plays on; a drag turns
  the view and the next shot eases it back; Pause holds the clock; Hear it fetches `/demo/volcano-eruption/seg_008.mp3`
  only. 0 API calls, 0 paid.
- **Checks** (`check.json`): 360 to 1440, both themes: 0 AA failures (min 5.48 light, 5.97 dark), 0 targets under
  44 px, 0 overflow. Lite at 360 shows the end still at 4:3.
- **Loading:** the room (1.05 MB), the model (0.66 MB) and the quiz are their own chunk, imported once the reader is
  within two screens of the section, then warmed and uploaded off screen before the spot goes live.

### The long frames (`session3/perf/`, production build; scripts `longframes.cjs`, `glframes.cjs`, `profile.cjs`, `remount.cjs`)

- **Hero start-up (was one 500 to 850 ms frame):** Jake's ten material programs finishing at his first draw
  (`getProgramInfoLog` in three's `onFirstUse`), after compileAsync had reported them ready: ANGLE over Direct3D 11
  does that work at first use. Fixed by `warm.ts drawEach` (each mesh drawn once, alone, in its own idle moment
  before he shows). Now: idle tasks of 59 to 165 ms before he is live, and after it frames of at most 146 ms (binding
  his gesture-clip pack, about 75 ms of React work, and unattributed GPU-side frames).
- **Near the room (a 2.5 s frame, introduced this session):** the room's first warm-up drew into a render target,
  which compiles another set of shader variants (no tone mapping, linear output) that the screen never uses. Removed;
  the room uses `drawEach` too.
- **The steady scroll (the 133 ms frame of session 1):** in a 6000 px/s scroll the frames over 100 ms are now the
  room's one-off load two screens before it: React committing the room (up to 179 ms) and the 4096 px baked
  texture's upload or a mesh's first draw in idle moments (up to 171 ms). Not chased further: at reading speed they land
  while the reader is still above the section. A resized copy of the room's texture (as the heart was resized) would
  shrink the upload, at a visible cost on a 1440 px room.
- **Frames (`report.json`):** p95 16.7 to 16.8 ms in every section, the room's tour included (0% dropped), at 360 to
  1440, both themes. LCP 160 to 252 ms full, 200 to 632 lite; lite under a 4x CPU throttle 496 to 1112 ms
  (`report-throttle4.json`). CLS 0 before any scroll, at most 0.0021 after. `/` 129 kB first load (budget 135);
  `/demo` 135 and `/learn` 134, unchanged.

### For Parents, the close, the stills, the review, the verification

- **For Parents** (`session3/parents/`): restyled on the system; AA minimum 5.55 light (was 4.74).
- **The close** (`session3/close/`, `close-wave.cjs`): waves each time it comes into view, 8 s cool-down; both
  waves peak inside his box (0 px out, at least 20 px clear).
- **Stills:** `picture.webp` recaptured (the finger aim). Lite and stack checked at 768 and 1280 (lite) and 360 and
  1280 (stack): 0 AA failures, 0 small targets, 0 overflow.
- **Reviews:** security, nothing above low; code review, eleven findings, the ones that mattered fixed (the room's GLB
  was preloaded with the stage; the clocks and shared state survived client-side navigation; a failed room left live
  controls; focus was lost at the tour's end). `review-fixes.cjs`: no room request at the hero, one near the section;
  Back from /demo starts the page fresh.
- **Verification** (`session3/verify/`): full check 360 to 1440 both themes (0 AA failures, minimum 5.11 light and
  5.48 dark; 0 targets under 44 px; 0 overflow), bounds 0 px out for every spot at 768, 1024 and 1440, posters against
  first frames (Jake's region within 2 of 255 and 0 to 1 px everywhere; the picture and the model start fading their
  graphic in at once), every gesture's peaks re-measured, `/demo` smoke (no console errors), 0 API and 0 paid calls in
  every run.
