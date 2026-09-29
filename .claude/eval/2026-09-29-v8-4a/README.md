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
  - After adds 1280x600 and the dark preview. That preview is the lock meta removed in the browser, which is the state
    once V8.4c deletes the lock; nothing ships dark in V8.4a.
- `*/report-*.json`: per shot, the screen rects of the caption band, callouts and the View in 3D / Show 3D / Show image
  buttons.
- `scripts/`: the capture (`capture.cjs <label> <baseUrl> <themes> demo|probes`, `SIZES=1280x720,...`), the AA checker,
  the 44px / reduced-motion check, and the cold-load timer. They need a global `playwright`. The probes return 404 on a
  production build, so run them against `yarn dev`, and `/demo` against `yarn start`. `next dev` and `next start` share
  `.next`, so run one at a time.

## Results

- **Band vs toolbars:** no overlap in any after shot at 768x1024, 1280x720 or 1280x600, in either theme.
  - The in-scene buttons' lowest edge is at 76.1% / 77.4% / 78.0% of the height. The band's top edge is at 80% or lower.
  - The closest gap is 16px, at 1280x600.
  - The band hides while the quiz is on the desk, and below md.
- **AA:** 1312 text nodes in the panel, band, callouts and toolbars, over 8 lesson states × 3 widths × 2 themes, with
  0 failures.
  - Anything over the 3D scene is measured against both a white and a black pixel, and the lower ratio counts.
  - The minimums are 4.71 (light, a done step number in the rail) and 5.24 (dark).
  - `/learn` TeacherControls and the empty state: all pass. The licence credit was 4.1 until TeacherControls passed it
    `!text-muted` (5.3).
- **Targets and motion:** every button, link and textarea in scope is at least 44x44. Under `prefers-reduced-motion`
  nothing in scope animates.
- **Cold load** (`yarn build` + `yarn start`):

| | Before | After |
|---|---|---|
| `/` first load | 122 kB, static | 122 kB, static |
| `/learn`, `/demo` first load | 134 kB | 134 kB |
| Shared CSS | 14.3 kB | 14.6 kB |
| `/demo` cold, 7 fresh contexts, median scene ready / FCP | 2124 / 552 ms | 1845 / 536 ms |
| `/demo` JS transferred (compressed) | 447.6 kB | 452.6 kB |
| `/learn` JS transferred (compressed, pane) | 450.8 kB | 456.2 kB |

The +5 kB is the lazy classroom chunk: the new markup, 18 lucide icons and the system Button's cva / Slot.
`tailwind-merge` was already in the first load. Scene-ready time did not get slower. The pane's own timings follow its
visibility (it runs at about 5 fps when hidden), so for `/learn` only the bytes are compared.
