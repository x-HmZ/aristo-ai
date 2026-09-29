# V8.4b evidence: quiz, desk card, answer panel, input box, quiz bars (2026-09-29)

Before is `origin/deploy-prep` (6175bc7); after is `dev/v8-4b-quiz`. Everything was captured headless (Playwright, Chromium
on the GPU via D3D11) from free routes: `/demo` (the pre-rendered volcano lesson and its two-question quiz, graded locally),
`/dev/desk-quiz`, and a local-only harness page `/dev/quiz-bars` that is excluded from git (it renders the bars,
`InputBox`, `AnswerInputPanel` and `QuizView` with all seven question types, and every `/api/quiz/*` call is mocked in the
browser, so nothing reaches the server). The reports record zero requests to any paid endpoint. `/learn` was checked
read-only in the signed-in browser pane (free mode, sessionStorage cleared): only `/api/courses`, `/api/profile` and
`/api/learn/overdue-count`.

## Files

- `before/`, `after/`: shots at 360 / 768 / 1280 in light and the dark preview (the lock meta removed in the browser, which
  is the state once V8.4c deletes the lock; nothing ships dark in V8.4b).
  - `demo-*`: the take-quiz bar, the desk card (question 1, wrong pick, question 2, correct pick) and the result bar.
  - `probe-desk-q1-*`: the desk card in `/dev/desk-quiz`.
  - `quiz-*`: every question type and state in a panel host (`ReviewView`-like): idle, picked and waiting for the mark,
    wrong, correct, fill-in typed, short answer, code, ordering, matching.
  - `answer-*`, `inputbox-*`: the answer panel (listening, typing) and the input box (idle, typed, listening).
  - `bar-*`: the loading, take-quiz and advance bars (4/5, 2/5, 1/5 on the last topic).
  - `after-reduced/`: the same harness under `prefers-reduced-motion`.
- `after/audit-*.json`: per-state AA nodes, sub-44 targets, running animations and the desk card's fit.
- `scripts/`: `capture.cjs <label> <baseUrl> <themes> demo|probes|harness` (`SIZES=`, `AUDIT=1`, `REDUCED=1`), `check.cjs`
  (the AA, target and animation checks), `common.cjs` (the fake `SpeechRecognition`, the quiz API mock), `perf.cjs`. They
  need a global `playwright`. The probes and the harness return 404 on a production build, so run them against `yarn dev`
  and the cold-load timer against `yarn start`; `next dev` and `next start` share `.next`, so run one at a time.
- The fake `SpeechRecognition` (start succeeds and stays listening, no microphone) is how the listening states are shot.

## Results

- **AA:** 3,292 text nodes over the desk card (/demo and /dev/desk-quiz), the harness (1,872 nodes, both themes, 3 widths)
  and the bars, with 0 failures. Minimums: 5.26 (harness), 5.33 (/demo), 5.48 (/dev/desk-quiz). Non-opaque stacks are tried
  over a white and a black pixel and the lower ratio counts. Disabled controls are exempt (WCAG 1.4.3).
  - The ratios by state are in decisions.md ("Quiz feedback states") and brand-system.md.
  - Non-text: the progress fill on its track is 2.25:1 light, and choice outlines are the system's 1.30:1 `line`; both are
    documented gaps.
- **Targets:** in the flat harness every button, input, select and textarea is at least 44x44 (0 under). In the desk card the
  options measure 39-43px on screen only because the card is tilted in 3D; the CSS height is `min-h-11` (44px).
- **Motion:** with `no-preference` two things run (the listening pulse and the marking dot, both `motion-safe:`, and the
  paper's entry animation on the desk); with `reduce`, nothing runs in scope.
- **Card fit:** the desk card's content stayed within its 620px box in all 30 desk states (no scroll).
- **Regression caught and fixed:** the first restyle of `DemoResultBar` grew from about 135px to about 230px and pushed the
  playback row over the lesson content; copy was shortened and the buttons share a row (about 140px). The take-quiz bar
  copy was shortened for the same reason ("Ready for the quiz?").
- **Cold load** (`yarn build` + `yarn start`):

| | Before | After |
|---|---|---|
| `/` first load | 122 kB, static | 122 kB, static |
| `/demo` first load | 135 kB | 135 kB |
| `/learn` first load | 134 kB | 134 kB |
| `/demo` cold, 7 fresh contexts, median scene ready | 2245 ms | 1969 ms (noise, not slower) |
| `/demo` JS / CSS transferred (compressed) | 454.2 / 14.4 kB | 455.2 / 14.3 kB |
| `/learn` JS / CSS transferred (compressed, pane) | 457.8 / 14.4 kB | 458.5 / 14.3 kB |

The extra ~1 kB is the Bloom and status icons. The pane's own timings follow its visibility (about 5 fps when hidden), so for
`/learn` only the bytes are compared.

## Process note

A syntax check that `require`d `capture.cjs` ran it with its default arguments and overwrote the light `before/demo-*` shots
with shots of the new code. They were regenerated from the baseline source (`git stash` of `src`, re-run, `git stash pop`);
the dark ones and the harness and probe shots were not touched.
