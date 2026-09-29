# V8.4a evidence: lesson panel and controls (2026-09-29)

Before is `origin/deploy-prep` at 7d457c3 (the merge of #10); after is `dev/v8-4a-lesson-panel`. Everything here was
captured headless (Playwright, Chromium on the GPU via D3D11) from free routes only: `/demo` (the pre-rendered volcano
lesson) and the `/dev/free-model` and `/dev/desk-quiz` probes. The reports record zero requests to any paid endpoint.
`/learn` was checked read-only in the signed-in browser pane (free mode, sessionStorage cleared); it made only
`/api/courses`, `/api/profile` and `/api/learn/overdue-count`.

## Files

- `before/`, `after/`: `demo-*` (picker, then Activate narrating, Explain, the image with the teacher pointing, the 3D
  model, Demonstrate, Challenge, Connect, the quiz on the desk) and `probe-*` (free-model empty / image / model in both
  rooms, desk-quiz both framings).
  - Before has 360 / 768 / 1280 in light.
  - After adds 1024x768 and 1280x600 (demo) and the dark preview. That preview is the lock meta removed in the browser,
    which is the state once V8.4c deletes the lock; nothing ships dark in V8.4a.
- `*/report-*.json`: per shot, the screen rects of the caption band, callouts and the View in 3D / Show 3D / Show image
  buttons, plus the band's text size, clamp and whether the next line shows.
- `scripts/`: the capture (`capture.cjs <label> <baseUrl> <themes> demo|probes`, `SIZES=1280x720,...`), the AA checker,
  the 44px / reduced-motion check, the transcript-follow check and the cold-load timer. They need a global `playwright`.
  The probes return 404 on a production build, so run them against `yarn dev`, and `/demo` against `yarn start`.
  `next dev` and `next start` share `.next`, so run one at a time.

## Results

- **Band vs toolbars:** no overlap in any of the 42 band shots (1024x768, 1280x720, 1280x600, both themes).
  - The in-scene buttons' lowest edge is at 76.1% / 77.4% / 78.0% of the height. The band's top edge is at 80.0% or
    lower.
  - The band hides while the quiz is on the desk. Below lg the panel shows the caption.
- **Whole sentences:** every demo sentence (127 to 358 characters) shows in full in the band.
  - Type steps from 18 to 16 to 14px, and the next line drops for the longest sentence at 1280x600 and 1024x768.
  - The line clamp was never needed.
- **AA:** 1812 text nodes in the panel, band, callouts and toolbars, over 8 lesson states × 4 widths × 2 themes, with
  0 failures.
  - Anything over the 3D scene is measured against both a white and a black pixel, and the lower ratio counts.
  - The minimums are 4.71 (light, a done step number in the rail) and 5.24 (dark).
  - `/learn` TeacherControls and the empty state: all pass. The licence credit was 4.1 until TeacherControls passed it
    `!text-muted` (5.3).
- **Targets and motion:** every button, link and textarea in scope is at least 44x44. Under `prefers-reduced-motion`
  nothing in scope animates.
- **Transcript:** with the drawer open, the spoken sentence stayed visible above the playback row through 9 skips at
  1280x720 and 768x1024.
- **Cold load** (`yarn build` + `yarn start`):

| | Before | After |
|---|---|---|
| `/` first load | 122 kB, static | 122 kB, static |
| `/learn`, `/demo` first load | 134 kB | 134 kB |
| Shared CSS | 14.3 kB | 14.6 kB |
| `/demo` cold, 7 fresh contexts, median scene ready / FCP | 2124 / 552 ms | 1903 / 356 ms |
| `/demo` JS transferred (compressed) | 447.6 kB | 453.1 kB |
| `/learn` JS transferred (compressed, pane) | 450.8 kB | 456.7 kB |

The extra ~5.5 kB is the lazy classroom chunk: the new markup, 18 lucide icons and the system Button's cva / Slot.
`tailwind-merge` was already in the first load. Scene-ready time did not get slower; the gaps between runs are noise, not a
gain. The pane's own timings follow its visibility (it runs at about 5 fps when hidden), so for `/learn` only the bytes are
compared.
