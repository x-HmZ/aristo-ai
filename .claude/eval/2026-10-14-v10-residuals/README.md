# V10 residuals: runaway loops and WebRTC (2026-10-14)

Both residuals from decisions.md ("Residuals accepted", items 1 and 2) are now closed. Verified with 0 paid calls against the dev
server (`yarn dev`, port 3000) in headless Chromium from the global Playwright install.

| Script | What it proves | Result |
|---|---|---|
| `scripts/loop.cjs` | `/dev/interactive?fail=loop*`: a plain `while (1 < 2) {}`, exponential recursion, an `await` loop (microtask starvation), a loop inside a try that swallows errors, and a good widget that runs away 1.5 s after `ready`. Each is stopped by the guard, the frame reports failed, and the host page's longest pause stays near the 1 s budget. Run twice: default Chromium, and with sandboxed frames forced into the page's process. A good widget survives 40 slider moves | 32 / 32 |
| `../2026-10-13-v10-interactive/scripts/nav.cjs` | Now also `fail=rtc-nested`: 22 ways to make a nested frame (every insertion API, HTML strings, fragments, ranges, DOMParser, an XHTML prefix, SVG foreignObject, object, embed, shadow DOM, document.write, the body setter, shadowed `matches`/`nodeType`), each followed by an attempt to borrow the child's RTCPeerConnection. All refused, no child frame ever exists | 50 / 50 |
| `frame.cjs`, `room.cjs` (2026-10-13) | Unchanged suites, rerun on the guarded frame | 84 / 84, 65 / 65 |

Control in `loop-report.json`: a 3 s busy loop in an unguarded sandboxed srcdoc frame stalls the host page 3,001 ms. Headless
Chromium keeps such frames in the page's process **by default** too: without the guard every loop above would freeze the tab for good.
With it, the longest host pause is about 1.0-1.1 s, once.

Not covered (see decisions.md): one built-in call that runs long by itself (a catastrophic regex, a huge allocation) cannot be
interrupted from inside the page.
