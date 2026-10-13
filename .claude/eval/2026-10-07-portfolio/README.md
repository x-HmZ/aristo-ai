# Portfolio captures (2026-10-07)

The clips and stills for the Aristo case study on Hmz's portfolio, every shot in both themes. The output went to
`C:\Users\Pc\Desktop\Empire\Freelancing\portfolio\public\projects\aristo\` (56 files, 41 MB): the plain name is the
dark version, `-light` the light one. The brief they follow is the Claude doc "Aristo AI: portfolio capture and display
brief".

`rec/` (the raw frame streams, about 2.3 GB) and `out/` (the encoded files) are git-ignored; only the scripts are kept.

## How it works

- **No paid calls, no real data.** `/` and `/demo` on a production build (`yarn build`, `yarn start` on 3100); the app
  pages through the local, git-excluded harnesses on `yarn dev` (`/dev/learn-shell`, `/hx/admin/<section>`), whose
  data is invented. Every `/api` request is aborted at the network; each run reported 0.
- **Clips** are recorded as a timestamped JPEG frame stream over Chrome's screencast (`record.cjs`), reviewed on a
  contact sheet (`contact.cjs`), then a chosen window is encoded (`encode.cjs`): H.264 MP4 (yuv420p, faststart, no
  audio, 30 fps), VP9 WebM and a JPEG poster. Needs ffmpeg (`winget install Gyan.FFmpeg`; set `FFMPEG` to its path if
  it is not on PATH) and a global `playwright`.
- **Stills** are PNG at 2x (1440x900) or 3x (390x844 phone) from `stills.cjs`; the before-and-after pairs are
  composed from the V8.6 evidence captures by `beforeafter.cjs`.
- `THEME=light` makes the light set (`record.cjs` writes `rec/<session>-light`, `stills.cjs` adds `-light`).

## Windows used (seconds from each recording's first frame)

| Shot | Session | Dark | Light | Size |
|---|---|---|---|---|
| 01 hero | demo | 27, 16 s | 23.2, 16 s | 1920x1080 |
| 02 opening | opening | 0.6, 6.2 s (poster at 5.9) | the same | 1920x1080 |
| 03 3D model | demo | 61.5, 8 s | 57.7, 8 s | 1920x1080 |
| 04 desk quiz | demo | 100.5, 10 s | 94.7, 10 s | 1920x1080 |
| 05 teacher switch | switch | 33.5, 6 s | 34, 6 s | 1440x900 |
| 11 onboarding | onboarding (dev) | 7, 12 s | 6, 12 s | 1440x900 |

Timings drift a few seconds between runs (narration and load), so re-check the contact sheet before re-encoding.

## Things the captures showed

- The lesson's callout chips stack over the board diagram's title at 1080p (shots 01 and 08): the app, not the capture.
- On phones the lesson panel covers the room, so `06-phone-classroom` is mostly the panel.
- The teacher switch is recorded after one off-camera switch each way, so both teachers are loaded; a cold first
  switch has a few seconds of empty stage.
- One Next server per `.next`: `yarn dev` overwrites the production build, so rebuild before going back to
  `yarn start` (with `src/app/hx` moved aside, as CI has no harness).
