# V8.7 evidence: assets and cleanup (2026-10-06)

Branch `dev/v8-7-cleanup` off `origin/deploy-prep` (after V8.6, #23). The brief is `.claude/plans/V8-7-assets-and-cleanup.md`.
Captured headless (global Playwright, Chromium on the GPU via D3D11) in real themes; no paid generation, every report has
0 API requests and 0 paid requests.

## What was done and how it was checked

1. **The room's last three overlays** (`Experience.tsx` "Your turn", `Teacher.tsx` "Thinking", `GeneratedModel.tsx` annotations)
   became ink-glass pills. `scripts/inscene.cjs` forces each state through the learn-shell harness's `window.__store`
   (the annotations use the harness's own mocked lesson plus a model URL for the local placeholder GLB) and runs the AA
   check on the element under test, before and after: "Your turn" 3.99 to 10.92, all other states pass in both themes at
   360 and 1280 (`before/`, `after/report-inscene.json`).
2. **The /dev pages** (`AvatarLab`, `DeskQuizPreview`, `FreeModelPreview`) moved onto the tokens through `dev/devKit.tsx`.
   `scripts/devpages.cjs`: the three pages in both themes at 1280, AA minimum 1.17 to 5.48, and a click on each page's
   own control confirms the handlers.
3. **The link-preview image.** Three layouts were rendered through the same card component (`og/card-a|b|c.png`, the
   sheet `sheets/og-variants.jpg`, each at full and feed size). Hmz picked B, the fade. The shipped card is
   `og/card-final.png`; on a production build `/opengraph-image` is a 1200x630 PNG of 510,036 bytes (`prod/`).
4. **Dead code.** `scripts/deadcode.cjs` produced `dead-code.md` (zero-reference proof per token). Hmz confirmed the removal.
   `css-diff.txt` (`scripts/cssdiff.cjs`) compares the production build's compiled CSS before and after as rule sets: one
   rule differs (`:root`, 22 `--aristo-*` declarations gone, none new), 1,179 rules before and after. Tests went from
   558 to 505 (the removed tokens' own checks: 22 x 2 and 9), lint 0 errors, type-check clean.
5. **Production regression** (`scripts/prodcheck.cjs`, `prod/report-prod.json`): `/?nointro`, `/demo`, `/sign-in` and
   `/sign-up` in both themes at 360 and 1280: 0 AA failures (min 5.11), 0 overflow, 0 API calls.

## Notes

- The shell layer used here halves backslashes in `node -e` and some heredocs, which broke regexes in two of the scripts
  and cost a wrong "dead" list once (`BRAND_HEX\b` became a backspace). `deadcode.cjs` now has escaped backslashes and was
  re-run; the final list was cross-checked against the real `BRAND_HEX.*` uses with `grep`.
- `public/images/landing/v3/idea.webp` was not removed: it is the documented proportions reference (decisions.md).
- The local-only harnesses (`pages/dev/learn-shell.tsx`, `pages/dev/app-pages.tsx`, `src/app/hx/`) stay out of git; copies are
  in `.claude/eval/2026-10-05-v8-6-app-pages/scripts/harness/`.
