# 2026-10-05 - The opening's Skip: never cream on the lit page

**Found:** `check.cjs` run without `?nointro` on a production build (360, lite, light;
`../2026-10-04-v8-3d-shirts/build/check-jake.log`): "Skip intro", cream rgba(244,236,225,0.8), 1.05:1 against
#F3F4F6. The checker walks a node's ancestors; the ink cover is a sibling (`.landing-intro-cover`, z 70), so Skip
read as cream on the page, and while the cover faded at the end it really was.

**Fix (`globals.css`, `Intro.tsx`):**
- The opening's own layer (`.landing-intro`) is the same ink #0E1117 while `data-intro` is `on` or `playing`, under
  its canvas: nothing on screen changes, and Skip has ink of its own.
- At `lifting` that layer clears at once (the cover still fades alone, 550 ms, as before) and `.landing-intro-skip`
  is hidden: `visibility: hidden` (out of the a11y tree and the tab order), opacity 0, no pointer events, and
  `transition: none` so PRESS's `transition-all` cannot fade it through low contrast.
- A first attempt hid Skip whenever the state was not `playing`; the reveal then faded in through PRESS's
  transition and two frames measured 1.42 and 3.07. It now hides only at `lifting` and `done`.

**Verified (production build, `next start`, dev server stopped):**
- `check.cjs` without `?nointro`, 360/768/1280, light and dark (`check.log`, `check/report.json`): 0 failures,
  min 4.74 light / 5.48 dark (6.06 at 360), 0 small targets, 0 overflow, 0 API calls.
- `scripts/skip.cjs` (`skip.log`, `skip.json`): every animation frame of the opening, 18 plays (3 widths x 2 themes x
  watched / keyboard Skip / tap). Skip is shown only in `on` and `playing`, min 10.49 on every frame, 0 below 4.5;
  0 frames in `lifting` or `done` where it is visible, opaque or takes pointer events. The opening plays through
  on, playing, lifting, done in 5.2 to 5.4 s watched and 1.55 to 1.6 s after a skip (SKIP_RATE). Tab reaches Skip,
  Enter skips, and the next Tab lands on the header's first link.
- `scripts/shots.cjs` (`shots/`): mid-play (Skip on ink, unchanged look), the lift's first frame and 250 ms in
  (Skip gone, the page lighting as before).
- Lint 0 errors; tests 556 passed.

The `check/*.png` screenshots stay local.
