# 2026-11-19 demo glitch and classroom layout audit

Headless checks of `/demo` (free route: every `/api` request is aborted, so nothing paid runs). They use a global
Playwright install (`npm i -g playwright`) and Chromium with `--use-angle=d3d11` so the WebGL scene renders. Start a
dev server first (for example `npx next dev -p 3200`) and pass its URL. Screenshots land next to the scripts and are
not committed.

| Script | What it does |
|--------|--------------|
| `audit.cjs <label> <url> [sizes]` | The layout audit. 8 screen sizes x 6 states (picker, lesson, explain, quiz, right answer, wrong answer). Reports controls or text off screen, overlapping controls, covered controls, and sticky rows overrunning their scroller. Empty report = pass. `sizes` is a comma list (`phone-portrait,laptop`). |
| `rows.cjs <dir>` | One contact strip per size from an audit folder (`row-<size>.jpg`), for an eye check. |
| `probe.cjs <url>` | Measures the lesson panel's Back / Next row against its scroller and the playback card at three phone sizes. |
| `phones.cjs <label> <url>` | Older capture of four sizes through the lesson to the quiz. |
| `answer.cjs <label> <url>` | Same, plus answering the first question. |
| `repro*.cjs` | The 2026-11-19 camera bug: drag then quiz, paper sampling, pixel diff, transform-change check. |
| `pair.cjs` | Side-by-side strips of two capture folders. |

Result at merge of PR 34: the audit is clean at every size. The one remaining "cover" line, lesson text under the
sticky Back / Next row on a laptop, is ordinary scrolling.
