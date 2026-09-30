# V8.4c evidence: classroom shells, pickers, loading, free mode, review, the lock deleted (2026-09-29/30)

Before is `origin/deploy-prep` at 36fefc8 (#11 to #14 merged), captured before the first edit; after is
`dev/v8-4c-shells`. Everything was captured headless (Playwright, Chromium on the GPU via D3D11) in **real themes**: the
OS preference (`colorScheme`) and, for the `stored-*` runs, a choice in localStorage under `aristo-theme`. Nothing
removes the lock meta any more. The before "dark" shots render light because the lock was still there; that is the
honest before.

Routes: `/demo` (the pre-rendered volcano lesson, local quiz), `/dev/free-model`, `/dev/desk-quiz`, and a local-only
harness `/dev/learn-shell` that mounts the real `LearnClient`. Every `/api` call there is answered by an in-page mock
(courses, profile, overdue count, the demo lesson and quiz, the review, narration from a static demo mp3), so nothing
leaves the browser. The scripts also abort `/api/**` at the network layer and record it. Every report has **0 paid
requests and 0 API requests at the network**. The harness is excluded from git; a copy is in
`scripts/harness/learn-shell.tsx.txt` (put it at `pages/dev/learn-shell.tsx` and add it to `.git/info/exclude`).

## Files

- `before/`, `after/`: `demo-*` (picker, lesson, image, 3D model, desk quiz, results), `shell-*` (loading and stalled,
  mode picker with courses / empty / building / error, free mode empty and cards, lightbox, review loading / empty /
  quiz / answered / done, course lesson, desk quiz, advance bar) and `probe-*` (free-model empty / image / model in both
  rooms, the desk probe). 360 / 768 / 1280 in light and dark.
- `before-desk/`, `after-desk/`: the desk quiz at 1024x768 and 1440x900.
- `before-stored/`, `after-stored/`: `stored-dark` (OS light, stored dark) and `stored-light` (OS dark, stored light).
- `after-reduced/`: demo and shell under `prefers-reduced-motion`.
- `after-pinned/`: onboarding, course map and dashboard (V8.6 surfaces) under OS light and dark.
- `after-prod/`: the toggle test on the production build (click, stored key, first paint after reload).
- `anchors/`: `scripts/room/verify-room.mjs probe` before and after.
- `*/report-*.json`: per shot, the layout facts (horizontal overflow, the panel rect inside the viewport, the desk card
  against the panel and the strip, the top bar inside the viewport, the theme attribute); `*/audit-*.json`: AA nodes,
  sub-44 targets and running animations.
- `scripts/`: `capture.cjs <label> <baseUrl> <themes> demo|probes|shell|toggle` (`SIZES=`, `AUDIT=1`, `REDUCED=1`),
  `check.cjs` (AA and targets; inline links are exempt from the target size), `common.cjs` (themes, the API guard, the
  layout check), `reduced.cjs` (duration tokens on the root, `.theme-ink` and `.theme-paper`), `pinned.cjs`,
  `perf.cjs`. They need a global `playwright`. `/dev/*` is 404 on a production build, so captures run against
  `yarn dev` and perf against `yarn start`, one at a time. Syntax-check with `node --check`, never by requiring a
  capture script.

## Results

`after/` and `after-desk/` demo and shell were re-captured after the code-review fixes (`after-run-2.log`, the same
numbers as `after-run.log`).

| | Before | After |
|---|---|---|
| AA text nodes checked (whole page on /demo and the harness; the product parts of the probes) | 6,031 | 8,076 |
| AA failures | 1,363 (min 1.22) | **0** (min 4.74 light, 5.24 dark) |
| Targets under 44px | 43 kinds on /demo, 157 in the harness | 1: the desk card's options, 42px on screen because the card is tilted in 3D (the CSS height is 44, as in V8.4b) |
| Panel outside the viewport | 42 shots (every 360 shot) | 0 |
| Desk card under the panel | every desk shot at 360 / 768 / 1024 / 1280 / 1440 | 0; the panel collapses to its strip, and the card never meets the strip |
| Horizontal scroll at 360 | none | none |

- **Themes:** the classroom follows OS dark, OS light, a stored dark and a stored light. The desk card stays paper
  (`.theme-paper`), and the caption band, callouts, toolbars and top-bar pills stay ink glass in both. The V8.6
  surfaces (onboarding, course map, dashboard) render the same in light and dark: 56 nodes each way, the same values.
  Their own AA gaps (orange and brown-muted text) are V8.6's and unchanged.
- **Toggle** (production build): on /demo it flips `data-theme`, writes `aristo-theme`, and after a reload with every
  client script blocked, the loading screen already paints in the stored theme (`rgb(14,17,23)` dark,
  `rgb(243,244,246)` light). No flash.
- **Reduced motion:** nothing in scope animates. `--dur-*` compute to 0ms on the root, inside `.theme-ink`, inside
  `.theme-paper` and on paper inside ink, in both themes (120 / 200 / 360 / 550ms without the preference).
- **Anchors:** eight of the nine probe-downs (desk, floor, paper anchor, the display wall) hit the same surfaces at the
  same heights. The ninth lands on a mesh that moves (`Mesh039_1`), and the three screen-click probes on the display
  vary by up to 0.008 between runs; two before runs differed from each other by the same amount. No anchor, camera constant, Html position or
  `distanceFactor` changed (`git diff` is empty for `src/components/three`).
- **Gap left (not fixable without a camera change):** at 360x780 the desk camera crops the 520px paper on both sides
  (vertical FOV 40, so the paper is about 700px wide on screen). With the panel collapsed the middle of the card shows,
  the option labels start off screen. A framing per aspect ratio is a camera constant; owner: a separate desk-framing
  task.
- **Cold load** (`yarn build` + `yarn start`):

| | Before | After |
|---|---|---|
| `/` first load | 122 kB, static | 122 kB, static |
| `/demo` first load | 135 kB | 135 kB |
| `/learn` first load | 134 kB | 134 kB |
| Shared CSS | 14.6 kB | 14.1 kB |
| `/demo` cold, 7 fresh contexts, median scene ready / FCP | 2343 / 424 ms | 1639 / 288 ms (noise, not slower) |
| `/demo` JS / CSS transferred (compressed) | 455.7 / 14.3 kB | 456.9 / 13.9 kB |
| `/learn` JS / CSS transferred (compressed, pane, signed in) | 458.9 / 14.3 kB | see state.md (needs Hmz's sign-in) |

The extra ~1 kB on /demo is the lucide icons and the shared chrome in the lazy classroom chunk. The first build put
`/learn` and `/demo` at 136 kB: the loading screen (in the first load) had taken the system Button (cva, Slot) and
`MotionConfig`. Reload became a plain button with the system classes and the caption a plain cross-fade, and both
went back to 134 / 135 kB.
