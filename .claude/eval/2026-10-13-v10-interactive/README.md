# V10 interactive visuals: evidence (2026-10-13)

Everything here ran with 0 paid calls: the harness serves hand-written fixtures, and `room.cjs` answers every
`/api` request with a stub or aborts it. Needs the dev server (`yarn dev`, port 3000) and headless Chromium from the
global Playwright install (`--use-angle=d3d11`: the hidden browser pane stalls the 3D scene).

| Script | What it proves | Result |
|---|---|---|
| `scripts/frame.cjs` | Each fixture x theme x 360/900: renders, says ready, text AA, 44px targets, no overflow; sliders and buttons drive redraws; the three failure paths; a hostile probe widget (obfuscated names) is stopped on eval, new Function, storage, cookies, parent access, fetch, XHR and images, with CSP violations and `ERR_BLOCKED_BY_CSP` recorded | 84 / 84 |
| `scripts/nav.cjs` | The probes the security review asked for: `location`, meta refresh, anchor click, `window.open`, history, `<a download>`, `execCommand('copy')`, PiP, fullscreen, WebRTC. Before the fix three of them made the frame request the target; after it (host `frame-src 'none'`) none do | 25 / 25 |
| `scripts/room.cjs` | The real lesson panel and playback hook on a synthetic lesson: the pause on the explore segment, Expand / Collapse / Hide / Open with slider state kept, Escape from inside the widget, Continue after Hide, Tab wrap in the large view, six viewport sizes (board card at 1180x600 and up, large view below), no overlap with the panel or the caption band, each fixture fits the board card at 1280x720 without scrolling, a failed fetch, a throwing widget, a slow widget (past and inside the 8 s wait), skipping out of the pause, and clearing the widget under an open pause | 65 / 65 |

`frame/` and `room/` hold the screenshots from the last run. `scripts/board-ref.cjs` and `scripts/demo-ref.cjs` re-capture
where the board image sits in the bare room and in `/demo` (used to place the card; their output is not kept).
