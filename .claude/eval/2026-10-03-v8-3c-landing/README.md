# V8.3c: the landing's model, shirts, teacher chooser and opening (2026-10-03)

Hmz's four asks after V8.3b: a 3D model that is worth being 3D, teachers whose shirts do not merge with white
boards, a teacher chooser that shows both teachers, and an opening that amazes. Plan:
`~/.claude/plans/in-the-landing-page-zesty-canyon.md` (approved). Branch `dev/v8-3c-landing`.

## Hmz's picks along the way

| Stop | Sheet | Pick |
|---|---|---|
| A. Shirts | `shirts/sheet-jake.webp`, `shirts/sheet-mj.webp` (live stage, page light / ink / classroom wall) | Jake forest, MJ plum |
| B. Model sources | `volcano/sheet-b.webp` (volcano), then `volcano/sheet-b2.webp` (11 topics; "none of these looks worth it" for the volcano) | brain-1, taught in the room with a new lesson |
| C. Model | `volcano/turntable-block-1.webp` (the volcano block: no real interior), `turntable-brain-1.webp`, `turntable-brain-1-mv.webp` | single-view brain; multiview was no more consistent, so no lobe is named on it |
| D. MJ's voice | `voice/mj-*.mp3` (free-tier voices only: Rachel and Aria are paid now) | Jessica |
| E. The opening | Hmz chose "Spark to Teacher" from the plan's three concepts | built; `intro/strip-dark-1440.webp`, `video/dark.webm` |

## Spend

- **fal: $1.37 of the $2.00 allowed** (script cap $1.80), `volcano/ledger.json`: FLUX $0.10 (32 sources), Tripo3D
  $0.60 (block-1, brain-1), multiview $0.52 (brain-1), NB Pro $0.15 (the brain lesson's board picture).
- One Anthropic call (generateLesson for the brain lesson).
- ElevenLabs: about 900 characters on the free plan (4 samples, 3 lines x 2 voices). See LICENSES.md: the free
  plan asks for attribution (the footer gives it) and is not for commercial use.

## Measured (production build, headless Chrome on the GPU)

| Check | Result |
|---|---|
| `/` first load | 131 kB (budget 135; was 130). `/demo` 135, `/learn` 134, unchanged |
| AA, targets, overflow (`check.cjs`, `?nointro`): Jake at 360/768/1280/1440 both themes, MJ at 360/1280 both | 2,104 text nodes, 0 failures (min 4.74), 0 targets under 44 px, 0 overflow, 0 API calls |
| Scroll (`perf.cjs`): Jake 1280/1440 both themes, MJ 1280 | every section p95 16.7 to 16.8 ms; CLS 0 (0.0008 after scroll); LCP the hero poster, 256 to 592 ms. Five Moves' one 150 to 183 ms frame and the hero's start-up frame are V8.3b's (same numbers in its `session3/perf`) |
| The opening (`intro-perf.cjs`, cold loads) | LCP 188 to 352 ms (the same as without it), CLS 0, p95 16.7 to 16.8 ms, ends at about 5.8 s, live teacher about 1.3 to 2.5 s after. 1 to 3 frames of 50 to 300 ms per run, at different moments each run; the CPU profile (`intro-busy.cjs`) has no main-thread work in them (GPU or present stalls); the mount's own frame is under the ink |
| The switch (`switch-timing.cjs`) | out 0.53 s, formed by 1.5 s, longest frame 17 ms both ways (was a 1.9 to 2.3 s compile: `switch-profile.cjs`, `switch-programs.cjs`) |
| A switch back clicked mid-switch (`switch-back.cjs`) | the stage ends on the chosen teacher |
| Bounds (`bounds.cjs`, MJ, 1280) | 0 px out in every spot (the tightest 10 px clear, the model spot) |
| Gestures (`room-peaks.cjs`, `peaks.cjs`) | room pointing at the diagram: Jake 8.4 deg, MJ 6.5 deg; the brain 3.5 to 4.4 cm past each fingertip; MJ's heart 2 cm past hers, her hand at its lower third |
| Gates | type-check clean; tests 554; lint 0 errors, 10 warnings (unchanged files) |

## Reviews

- `security-reviewer`: no critical or high. Medium: this eval's spend ledger books after the call (a killed run is
  not booked) and is not locked; left as is (one-off, run by hand). Low, fixed: `?introdebug` is development only;
  `landing-voice.mjs` takes a voice by own property only.
- `code-reviewer`: one high (a choice made during a switch was never acted on), fixed; the mediums (the opening could
  strand the page on an exception, `introPending` missed "lifting", the page under the opening was not inert, the
  switched-in teacher lost its wave when it had to load, the pre-warm reset the sweep height) fixed; lows partly fixed
  (the heart follows the teacher on stage). Left: the chooser's pressed state renders Jake for a moment on an MJ-first
  load until hydration; MJ visitors also fetch Jake's eager hero poster (display none).

## Follow-up (2026-10-04)

Hmz: fix what was left. Done and checked on a production build:
- **The room's picture becomes the model** (`switch/room-build-jake.webp`, `scripts/room-build.cjs`): the diagram's
  drawn brain lifts off the board as points onto the brain, which then solidifies; the model holds its turn until it is
  built. Present peaks after it: Jake 2.9 cm, MJ 4.0 cm past the fingertip.
- **The brain in /demo** (`demo/`, `scripts/demo-brain.cjs`): three topics in the picker; the brain lesson plays its
  narration (16 segments, aligned), its board picture and "View in 3D"; the volcano lesson offers no 3D model. 0 API,
  0 paid calls, no page errors. ElevenLabs: 3,918 characters, leaving 12 this month.
- **The chooser on an MJ-first load**: with the page's scripts blocked (before hydration), MJ's chip is already
  pressed (`html[data-teacher]` CSS) and Jake's is not.
- Tests 554; `/` 131 kB, `/demo` 135 kB.

## Scripts (in `scripts/`; the V8.3b ones copied, `TEACHER=mj` where they load the page)

`shirts.cjs`, `shirt-sample.cjs` (sheet A); `volcano-model.ts` (guarded fal runs and the ledger), `turntable.cjs`,
`markers.cjs`, `brain-parts.mjs` (sheets B, C and the label anchors); `switch.cjs`, `dissolve-frames.cjs`,
`switch-timing.cjs`, `switch-profile.cjs`, `switch-programs.cjs`, `switch-back.cjs`; `intro.cjs`, `intro-frames.cjs`
(seek the opening's clock with `?introdebug`, dev only), `intro-debug.cjs`, `intro-perf.cjs`, `intro-profile.cjs`,
`intro-busy.cjs`, `mark-points.cjs` (generates `src/components/landing/intro/markPoints.ts`); `faces.cjs`;
`record.cjs` (the video).
