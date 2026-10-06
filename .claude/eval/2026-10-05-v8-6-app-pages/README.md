# V8.6 evidence: the app pages onto the brand system (2026-10-05/06)

Branch `dev/v8-6-app-pages` off `origin/deploy-prep` (61f4d13). "Before" was captured on the branch before each surface's
first edit. "After" is the branch head. Everything was captured headless (global Playwright, Chromium on the GPU via
D3D11) in **real themes**: the OS preference (`colorScheme`) at 360x780, 768x1024 and 1280x800.

## How each surface was captured (no session, no paid call)

- **Onboarding, course map, dashboard:** `/dev/learn-shell`, V8.4c's local harness, which mounts the real `LearnClient`
  with every `/api` call mocked in the page. V8.6 added mocks for:
  - a course map with every mastery tier, empty, and failed;
  - the dashboard full, empty, and failed;
  - the onboarding submit error.
- **/pending and /create-teacher:** `/dev/app-pages`, a new local harness rendering the presentational `PendingView` and
  `CreateTeacherView` (split out of the pages for this) in every state. There is no Avaturn SDK, so the editor frame is
  empty there.
- **/sign-in and /sign-up:** the real public pages, with `?error=` and `?message=` states. Nothing was submitted.
- **Admin:** `/hx/admin/<section>`, a new local App Router harness rendering the real admin pages inside the real
  `AdminShell`. `usePathname` comes from Next's pathname context, and every fetch is answered by synthetic data
  (`src/app/hx/admin/mocks.ts`, invented names, example.com). `?lock=1` added the old lock meta for the "before", so it
  shows what users saw (locked light).
- **Harness files:** all excluded from git (`.git/info/exclude`):
  - `pages/dev/learn-shell.tsx` and `pages/dev/app-pages.tsx`, which render a 404 in production;
  - `src/app/hx/`, which calls `notFound()` in production.

  Copies are in `scripts/harness/`. Every report has 0 API requests at the network layer and 0 paid requests.
- **Signed in** (Hmz signed in himself in the browser pane; view only):
  - /create-teacher follows a stored dark choice with no lock meta, and Avaturn's iframe loads.
  - /admin overview, users and cost were checked in dark at 1280 with the same checker injected, on real data: 0
    failures, 0 small targets, min 5.56 / 5.97 / 5.97.
  - The drawer at 360 opens and closes on navigation.
  - The network showed only read-only GETs.

## Results

| Surface | Before: nodes, failures, min | After: nodes, failures, min (light / dark) | Targets under 44px | Overflow |
|---|---|---|---|---|
| Onboarding, course map, dashboard (10 states x 6) | 1,118, 784, 1.0 | 986, 0, 5.25 / 5.56 | 114 to 0 | none |
| /create-teacher (7 states x 6) | 366, 172, 1.83 | 342, 0, 4.98 / 6.05 | 42 to 0 | none |
| /pending, /sign-in, /sign-up (7 states x 6, audit) | 0 failures, min 4.74 | unchanged | 0 | none |
| Admin (16 states x 6, plus the 360 nav drawer) | 14,075, 4,436, 1.08 | 12,465, 0, 4.55 / 4.77 | 1,626 to 0 | none (it was a 120px column at 360) |

- **Dialogs** (`after/report-dialogs.json`):
  - The mode picker, course map and dashboard each have the dialog role and `aria-modal`, take focus on open, and keep
    it through 30 Tabs and 30 Shift+Tabs.
  - Escape closes the course map (back to the picker) and the dashboard (focus returns to Progress), and is ignored by
    the mode picker.
- **Admin drawer** (`after/report-drawer.json`, `scripts/drawer.cjs`): it opens from the 360 menu button and closes on
  a link to the page already open, on Escape, and when the viewport grows past md (the sidebar is back).
- **Production** (`yarn build`, `next start`, the harnesses moved aside as in CI): /sign-in and /sign-up in every state,
  both themes, 360 / 768 / 1280, 0 failures (`prod/report-pages.json`); /demo at 360 and 1280 in both themes, 0
  failures, 0 API calls (`prod/demo-*.jpg`).
- `/hx/admin` fails its server render in dev (it borrows Next's internal pathname context) and renders on the client;
  the scripts hide the dev overlay and wait for the page. The real admin renders normally.
- The admin "before" is pessimistic in places: its gradient page background is an image the checker cannot
  composite, so text over it was also tried on black.

## Files

- `before/`, `after/`: `<state>-<width>-<theme>.jpg` and `report-{learner,pages,admin}.json`. Admin shots are full page.
- `sheets/`: before/after compare sheets and per-surface state sheets (`scripts/sheet.cjs`).
- `scripts/`:
  - `learner.cjs`, `pages.cjs` and `admin.cjs` capture and check (AA per text node, targets, overflow);
  - `dialogs.cjs` checks the modal behaviour;
  - `check.cjs` is the V8.4c checker plus an occlusion filter (`window.__occl`);
  - `common.cjs` holds the shared helpers;
  - `admin-tokens.cjs` is the class-mapping codemod used for the admin pass;
  - `sheet.cjs` builds the sheets.

  They need a global `playwright` and `yarn dev`, since the harnesses are 404 on a production build.
