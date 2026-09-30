# V8.3 landing v3: evidence (2026-09-30)

Before is `origin/deploy-prep` at 83c6f37 (the V8.2 landing, App Router), captured before the first edit; after is
`dev/v8-3-landing`. Everything is headless Playwright on the GPU (D3D11) against a production build, real themes (the
OS preference), light and dark. Every `/api` call is aborted at the network and recorded; every report has 0 API and
0 paid requests. Scripts reuse `../2026-09-30-desk-framing/scripts/common.cjs` and `../2026-09-29-v8-4c/scripts/check.cjs`
and were syntax-checked with `node --check`. Screenshots were converted to WebP (full-page ones to JPEG, 480px wide)
after capture to keep the folder small.

## What was built

The storyboard and its decisions are `.claude/plans/V8.3-landing-plan.md` (Hmz: the recommendations, plus 6B, 7C, 8B).
`/` is a Pages Router page (spike first: the old landing moved over unchanged measured 112 kB). The live stage (R3F) is
imported after `load` and an idle moment, on the full path only (`gate.ts`), and fades in over the poster once the
room and Jake have painted. One render loop drives the scroll driver, the camera and the DOM writers.

## Load (`after-perf.log`, `before/report-perf.json`, `after-build.log`, `before-build.log`)

| | Before | After |
|---|---|---|
| `/` first load JS (build) | 122 kB, static | 127 kB, static (budget 135) |
| `/demo`, `/learn` first load | 135, 134 kB | 135, 134 kB (unchanged) |
| LCP element | the hero screenshot | the poster (`/images/landing/v3/poster.webp`), every width and theme |
| LCP time | 188 to 328 ms | 188 to 504 ms (360: 244 to 504, lite; 768 and 1280: 188 to 240) |
| CLS | 0 to 0.0001 | 0 |
| JS on the wire | 119.5 kB | 204 kB on the lite path (the page, plus Next's prefetch of `/demo` for the Try a lesson links, about 40 kB, after `load`); 505 kB on the full path (the stage chunks, about 300 kB, start after `load`) |
| 3D on the wire (full path) | 0 | room 1.05 MB, Jake 2.28 MB, then his clip pack 0.74 MB once live; the diagram (97 kB), the heart (624 kB) and `source.jpg` (16 kB) once the reader scrolls |

Stage start-up (`after-startup.log`, `scripts/dbg-start.cjs`, no scrolling): live at 1.6 to 3.0 s. The worst long frame
went from 2,146 ms (the first draw compiling and uploading the room and Jake) to 249 to 515 ms, by warming the room
hidden (`warm.ts`: parallel shader compile, textures uploaded in idle moments) before showing it.

## Smooth scrolling (`after-scroll.log`, `before/report-scroll.json`)

A steady wheel scroll through the whole page (100 px every 16 ms, about 6,000 px/s), rAF deltas and long animation
frames recorded. Headless frames are vsync-paced at 60 Hz here, so "dropped" counts frames over 25 ms.

| Width | Before p95 / dropped | After p95 / dropped / worst frame (light; dark) |
|---|---|---|
| 360 (lite) | 16.8 ms / 0.5% | 16.8 / 0.8% / 50 ms; 16.7 / 0.4% / 33 ms |
| 768 | 16.8 / 0% | 16.8 / 2.3% / 100 ms; 16.8 / 1.6% / 67 ms |
| 1024 | | 16.8 / 1.4% / 67 ms; 16.8 / 1.6% / 117 ms |
| 1280 | 16.8 / 0.6% | 16.8 / 1.7% / 117 ms; 16.8 / 2.9% / 83 ms |
| 1440 | | 16.8 / 2.4% / 217 ms; 16.8 / 3.6% / 250 ms |

- p50 is 16.7 ms everywhere. The first full-path build dropped 6 to 11% with 200 to 400 ms frames. The fixes, each
  measured with `scripts/dbg-loaf.cjs` (long frames with attribution and scene time) and `dbg-drops.cjs` (dropped
  frames per quarter section):
  - the heart replaced by a landing-sized copy of the real model;
  - the lazy parts mounted in an idle moment once the reader scrolls, and warmed up before their beat;
  - the stage's pause re-rendering only its host;
  - idle section writers skipped;
  - moving beats given their own layers;
  - no per-frame SVG filter.
- Tested and not the cause (`exp-*`, removed): the glass blur on the full path, and the layers themselves.
- The lite path under a 4x CPU throttle at 1,875 px/s (`after-throttle.log`): 8.6% dropped at 360 and 8.4% at 1280
  (was 15 to 22%), p50 16.7 ms, p95 33 ms. The rest is DOM style and paint work.

## AA, targets, overflow (`after/report-check.json`, `after-lite/`, `after-reduced/`, `after-nogl/`)

Each visible text node against its composited background. Over the 3D room the grounds are taken as white and as
black, and the lower ratio counts. The check runs at each beat's hold point in scene time (20 points), where the
beat is settled. Text that is mid-fade at a hold point is marked and skipped, and counted apart; only on-screen text
counts.

| Mode | Widths, themes | Text nodes | Failures | Minimum | Targets under 44px | Horizontal overflow |
|---|---|---|---|---|---|---|
| auto (lite at 360, full from 768) | 360 / 768 / 1024 / 1280 / 1440, light and dark | 5,412 | 0 | 5.11 light, 5.48 dark | 0 | 0 |
| lite forced | 768 / 1280, both | 2,190 | 0 | 5.11, 5.48 | 0 | 0 |
| reduced motion (the stack) | 360 / 768 / 1280, both | 2,066 | 0 | 4.74, 5.48 | 0 | 0 |
| no WebGL | 1280 light | 577 | 0 | 5.11 | 0 | 0 |

Before: 0 AA failures, but the footer's links and the wordmark links were 19 to 20px tall (now 44px). Two real
failures were found and fixed on the way: "Topic" in `muted` on ink glass (4.44) and faded chips kept `visible` inside
a hidden parent (see "Review").

## Behaviour checks

- **Poster at rest** (`rest-1280-light.webp`, `scripts/rest.cjs`): once live, the poster is at opacity 0 and the window
  shows the live room without any scroll. The accessibility tree before scrolling holds the whole outline: the H1,
  every section H2 and each step's and move's H3.
- **The opening in time** (`opening-seq/`): Jake turned to the board (the poster's pose), turns to the reader, then the
  greeting wave (1.2 s after live).
- **Gestures** (`gestures/`, `gestures-2/`, `scripts/gestures.cjs`): five frames 400 ms apart at each cue. All of the
  following play where the timeline puts them:
  - OneMoment, handing off to Thinking;
  - HoldIdea on the cards;
  - PresentModel when the diagram lands, and again for the model;
  - Pointing at the diagram;
  - Imagine on the hook;
  - HoldIdea on Explain and StepBeat on Demonstrate;
  - Pointing on Demonstrate;
  - YourTurn on the challenge;
  - BringTogether on Connect;
  - ThatsIt at the end;
  - the goodbye wave on the close.

  A cue reached while the previous one-shot gesture still plays is skipped, as in a lesson (the director never
  interrupts).
- **Sound** (`scripts/sound.cjs`): nothing audio is fetched until "Hear it". Then `seg_001.mp3` and its alignment play,
  and the spoken words light up (10 after 2.5 s). The next move swaps the line; the map stops it with the toggle still
  on. Since the fix, a line starts only after its beat holds 350 ms. No API call and no speech-synthesis fallback: the
  module has its own `<audio>`. The word timings of each move's sidecar match the words its caption shows (unit test).
- **Lite and the stack:**
  - `after-lite/`, `after/` at 360: the lite path.
  - `after-stack-1280.jpg`, `after-stack-360-dark.jpg`: reduced motion, no pinning, stills at most 960px, 0 overflow.
  - `after-nojs-1280.jpg`: no JS, the same stack.
- **`/demo` regression** (`demo-teacher/`, `scripts/demo-teacher.cjs`): `/demo` loads, the teacher renders, 0 API
  calls, before and after. Canvas hashes at fixed times differ run to run in both (the load timing moves the
  animation clock even with a seeded `Math.random`), so they cannot prove identity. The `Teacher` default path was
  checked line by line instead (the code review): with no `driver`, every changed line reads what it read before.
  `/demo` and `/learn` first loads are unchanged.

## Screenshots and recordings

- `before/`, `after/`: `<theme>-<width>-<stop>.webp` at 360 / 768 / 1280, light and dark (after: each section's start,
  middle and end), plus a full page (`*-full.jpg`).
- `after/scroll-<theme>-<width>.webm`, `before/scroll-*.webm`: scroll recordings of the whole page at 360 / 768 / 1280.
- `after-sheet-dark-1280.webp`: contact sheet.

## Assets added (all made from existing ones)

| File | What | Size |
|---|---|---|
| `public/images/landing/v3/poster.webp` | the opening window at 2x, captured from the stage (`?pose=board`) | 19 kB |
| `public/images/landing/v3/<beat>.webp`, `<beat>-640.webp` | 12 lite stills, 1280 and 640 wide, captured from the stage (`scripts/stills.cjs`) | 478 kB in all with `close.webp` |
| `public/landing/heart.glb` | the demo's real Tripo heart, resized: `gltf-transform resize --width 1024 --height 1024`, `simplify --ratio 0.2 --error 0.0005`, `draco` | 624 kB |
| `src/data/landing/kg-snapshot.json` | a real course's first 20 concepts and 21 links (`scripts/snapshot-kg.ts`) | 5 kB |

No new audio, video or generation; no fal, TTS or LLM call; $0.

## Review

The `code-reviewer` agent found no critical issues, 2 high, 7 medium and 4 low; every item was fixed.
- **High: the poster stayed over the live stage until the first scroll.** Cause: the writer gate added for the lite
  path. Fix: a gate epoch.
- **High: screen readers only reached the pinned story while it was on screen.** Fix:
  - a transcript for the Idea, the question and the moves;
  - the hero, the map and the close fade without hiding;
  - a focused beat shows itself;
  - the map is one list.
- **Medium:**
  - sound played on after leaving `/` (fixed: cleanup);
  - a failed diagram or heart tore down the whole stage (fixed: a boundary per part);
  - a warm-up rejection froze the stage (fixed: caught);
  - lesson state left over from `/demo` (fixed: cleared on mount);
  - `touch-none` on the curve (fixed: `touch-pan-y`);
  - `svh` against `innerHeight` (fixed: the frame's own height);
  - the snapshot's service-role fallback (fixed: on an error only, published courses only).
- **Low:**
  - the lite opening still competed with the LCP (fixed: rendered on lite only, hidden until faded in);
  - "Hear it" in the stack (fixed: plays the pressed line, and names its line);
  - material disposal (fixed);
  - the room re-cloned on each pause (fixed: memoised);
  - a dead CSS block (removed);
  - `twitter:description` (added).
