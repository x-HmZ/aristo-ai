# Desk quiz at portrait sizes: evidence (2026-09-30)

Before is `origin/deploy-prep` at b3cc79b (V8.4c and #16), captured before the first edit; after is
`dev/desk-quiz-portrait`. Everything is headless Playwright on the GPU (D3D11), real themes (the OS preference), light
and dark. Routes are free only: `/dev/desk-quiz` (stub quiz; `probe` is the default room, `probe-alt` the Evening
room), `/demo` (its local quiz) and the local `/dev/learn-shell` harness (the real `LearnClient` with every `/api` call
mocked in the page; see `../2026-09-29-v8-4c/scripts/harness/`). Every report has 0 paid requests and 0 API requests at
the network.

## The problem, and one thing the plan got wrong

The canvas FOV is a fixed 40 degrees vertical, so the paper's width on screen scales with the viewport height. The
520 x 331 card measured 728px wide at 360x780 (49% of it visible), 955px at 768x1024 (80%), and its controls were 38px
at 360x640 and 42px at 1280x720 because the card is tilted.

Found while modelling it: `OrbitControls` in `AristoCanvas` has `minPolarAngle = pi/6`, and `CameraController` calls
`controls.update()` every frame, so the desk camera is clamped from 23.7 degrees off vertical (`DESK_POS`) to 30. The
camera that renders is `(0, 0.133, 0.083)`, not `(0, 0.2, -0.05)`. A model of "a rectangle on the desk plane seen through
the canvas camera" (1 CSS px = 0.55/400 world units) reproduces the measured card rects to the pixel only with that
clamped pose (`deskFraming.test.ts` pins four of them). It also means the "steeper camera" probe in the plan (`options/steep-*`)
was clamped to the same pose and proves nothing about a steeper view; a real one would need a different
`minPolarAngle`, which the lesson orbit also uses.

## Options, probed on `/dev/desk-quiz` (`options/`)

Stub quiz, light, sidebar hidden. "Min choice" is the smallest on-screen choice height. Card widths are the projected near
edge.

| Size | Today | 1. Pull back only | 2a. Scale the paper | 2b. Narrow the card (camera as today) | 3. Flat sheet | Shipped |
|---|---|---|---|---|---|---|
| 360x780 | 728px, 49% visible, 46 | fits, 22px | fits, 21px | fits, 48px, header in 4 lines | 328px, 44 | 270px card, 47 |
| 390x844 | 787px, 50%, 50 | fits, 24px | fits, 23px | fits, 52px | 358px, 44 | 300px card, 47 |
| 768x1024 | 955px, 80%, 60 | fits, 48px | fits, 47px | fits, 61px | 520px, 44 | 520px card, 55 |
| 1024x768 and up | fits | unchanged | unchanged | unchanged | | unchanged |

Pulling back or scaling the paper multiplies the card by about 0.45 on a phone, so 44px targets become 21 to 24px.
Narrowing the card alone works at 390 but not at 360x640 (39px). The flat sheet is exactly 44px but is the
"popup over a desk" that DeskQuiz attempts 2 and 3 rejected. The shipped rule is 1 + 2b together (`ray-52-*`):
slide the camera along today's view ray and narrow the card until the card fits the width and the first control is
44px, with desk controls 52px tall in CSS.

Scripts: `options/probe-options.cjs` (the variants), `options/model-explore.cjs` and `model-solve.cjs` (the model
before it became `deskFraming.ts`).

## Results (`before/`, `after/`)

Probe stub card, light. After the change the CSS card is 363px tall in landscape (the 52px controls) against 331 before,
which is why the landscape rects moved by 3 to 5px; the framing is the same object.

| Size | Before: card x range (visible) | Before: min control | After: card x range (visible) | After: card CSS width | After: min control |
|---|---|---|---|---|---|
| 360x640 | -119..479 (60%) | 38 | 19..341 (100%) | 255 | 48 |
| 360x780 | -184..544 (49%) | 46 | 18..342 (100%) | 270 | 47 |
| 390x844 | -199..589 (50%) | 50 | 18..372 (100%) | 300 | 47 |
| 430x932 | -220..650 (50%) | 55 | 18..412 (100%) | 341 | 46 |
| 768x1024 | -94..862 (80%) | 60 | 24..744 (100%) | 520 | 55 |
| 1024x768 | 154..870 (100%) | 45 | 150..874 (100%) | 520 | 53 |
| 1280x720 | 304..976 (100%) | 42 | 301..979 (100%) | 520 | 49 |
| 1440x900 | 300..1140 (100%) | 53 | 296..1144 (100%) | 520 | 62 |
| 1920x1080 | 456..1464 (100%) | 63 | 451..1469 (100%) | 520 | 74 |

- **Over every state** (9 sizes, light and dark: the probe in both rooms, /demo and the harness, first question, answered and
  true or false; 36 probe states, 36 desk states and 72 answered states in the hosts): the card is fully inside the viewport in all of them (before: 60 host states
  cropped), never under the top bar, the panel or the strip, the smallest desk control is 45px (before: 34), and there
  is no horizontal overflow or panel outside the viewport (as before).
- **Targets:** 0 controls under 44px on the desk card (before: 52 kinds, the tilted 38 to 43px ones). `check.cjs`
  TARGETS scoped to `.aristo-paper`.
- **AA:** 1,288 text nodes on the desk card in the hosts plus 468 in the probes, 0 failures, minimum 5.33 (the card's
  colours did not change since V8.4b, which measured 5.26).
- **Landscape framing:** `deskFraming` returns the `DESK_POS` / `DESK_TARGET` objects themselves for 1024x768, 1280x720,
  1366x768, 1440x900, 1600x900, 1920x1080 and 2560x1440 (unit test, `toBe`). The browser camera reads
  `(0, 0.133, 0.083)` at all of them, the same as the clamped constant.
- **Phones:** the camera slides along the same ray: 360x640 `(0, 0.07, 0.047)`, 360x780 `(0, 0.307, 0.183)`, 390x844
  `(0, 0.413, 0.245)`, 430x932 `(0, 0.563, 0.331)`, 768x1024 `(0, 0.44, 0.26)`. The look direction is unchanged.
- **Motion** (`after/report-probe*.json`, `motion-*`): toggling the quiz off and on samples the camera at 150ms and 3s.
  Normal motion glides (360x780: y 0.20, z 0.43 at 150ms on the way out, settling at y 0.007, z 0.885, the lesson pose).
  Under `prefers-reduced-motion` (`after-reduced/`) it cuts: `(0, 0, 0.9)` at 150ms out and the desk pose at 150ms in,
  and no animation runs in the card. The first version of the cut left the camera at the desk on the way out (the
  hand-back check returned before applying the pose); the after numbers are with the fix.
- **fps in the desk framing** (`/demo`, production build, uncapped, 3 x 8s medians; noise between runs is about 10%):
  1280x720 126.8 before, 119.1 and 125.5 after; 390x844 246.2 before, 229.1 and 233.8 after; p95 frame time 5 to 6ms in
  all.
- **Anchors** (`anchors/`, `scripts/room/verify-room.mjs probe`): the 9 probe-downs are identical except the moving mesh
  `Mesh039_1` (0.842 to 0.848), and the 3 display clicks vary with run, not with the change: the old code read 0.392 and
  0.403 on a warm server, the new 0.408 to 0.419. No `LESSON_*`, `SCENE_*`, `MODEL_*` or `PAPER_ANCHOR` value, no FOV,
  no `distanceFactor` changed.
- **Builds:** `/` 122 kB static, `/demo` 135 kB, `/learn` 134 kB before and after (`before-build.log`, `after-build.log`).

## Known gap

A landscape phone (844x390, 667x375) has 238px of height between the top bar and the strip. Fitting a usable card there
means a 260px scrolling strip, so `deskFraming` keeps today's framing below a 320px card and the card crops there (its
controls project to about 28px). Owner: a separate task with the panel and the strip, since the fix is a layout
decision, not a camera one.

## Files

- `before/`, `after/`: `probe-*`, `probe-alt-*`, `demo-*`, `shell-*` (the desk at 9 sizes, light and dark), and
  `demo-answered-*`, `demo-tf-*`, `shell-answered-*`, `shell-tf-*` (the next two questions). `report-*.json` has the
  layout facts per shot; `audit-*.json` the AA nodes and targets.
- `after-reduced/`: the probes under `prefers-reduced-motion`, with the camera samples.
- `scripts/`: `desk.cjs <label> <baseUrl> <themes> <hosts>` (`MOTION=1`, `REDUCED=1`, `SIZES=`), `fps-desk.cjs`, and
  the V8.4c helpers (`common.cjs`, `check.cjs`, `capture.cjs`, `perf.cjs`). They need a global `playwright`.
  `/dev/*` is 404 on a production build, so `desk.cjs` runs against `yarn dev` and `fps-desk.cjs` against `yarn start`.
  Syntax-check with `node --check`, never by requiring a script.
- `anchors/`, `before-fps.log`, `after-fps*.log`, `before-build.log`, `after-build.log`.
