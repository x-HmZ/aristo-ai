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
