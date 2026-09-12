# Landing page design system: "Night Class"

Chosen by Hmz on 2026-09-11 (T04b) from three directions on the design canvas
(https://claude.ai/code/artifact/faee56f8-fe76-499b-9ee2-4e19f5fcf3dc). Covers `/` only:
`src/app/page.tsx` + `src/components/landing/*`. The classroom (`/learn`, `/demo`) keeps the
pastel orange + cream it has always had.

## Overview

Dark first, with a real light variant. The page is ink; the product screenshots are the warm,
lit window in it, so the classroom is the brightest thing on the page. Orange is a spark
(primary buttons, one word of the headline, icons, step numbers), never a fill.

Mode follows `prefers-color-scheme`. The toggle (nav at sm+, footer below sm) stores an
explicit choice; choosing the mode the OS already wants clears it again. There is no third
"system" state.

## Colours

All tokens live in `src/app/globals.css` under `:is(:root:has(.landing), .landing)` as bare RGB
channels, exposed to Tailwind as `lp-*` (opacity modifiers work: `bg-lp-accent/90`). The dark
block exists twice (media query + `[data-landing-theme="dark"]`); keep them identical.

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#F3F4F6` | `#0E1117` | page |
| `surface` | `#FCFCFD` | `#151922` | cards, bands, media frames |
| `sunk` | `#EAECF0` | `#0B0D12` | footer |
| `ink` | `#0E1117` | `#ECEDEF` | headings |
| `body` | `#3E4452` | `#B7BDC7` | paragraphs (8.9 / 10.0 : 1 on bg) |
| `muted` | `#5A6170` | `#8F97A4` | labels, nav, captions (5.7 / 6.4 : 1) |
| `line` | `#DCDFE5` | `#252B36` | every hairline and border |
| `accent` | `#B4521F` 71% sat | `#E98A52` 77% sat | solid fills: primary buttons only |
| `accent-ink` | `#FCFCFD` | `#0E1117` | text on `accent` (4.9 / 7.4 : 1) |
| `accent-text` | `#A94C1B` | `#EF9A66` | accent as text or icon (5.1 / 8.5 : 1) |
| `tint` / `tint-line` | `#F4EAE3` / `#E6D3C6` | `#211A17` / `#3A2C24` | warm wash on at most one surface per section |

Rules: saturation stays under 80%. No gradient text. No coloured glow on a control. Every CTA
is checked at AA or better. The warm radial "light spill" (`.lp-glow-pool`, `.lp-glow-rise`)
is atmosphere behind the hero shot and inside the closing band, and nowhere else.

## Typography

- **Display: Archivo, `wdth` 125, capitals** via `.lp-display`. H1, section H2s and the
  closing CTA only. Loaded by `src/components/landing/fonts.ts` so it never preloads on
  `/learn` or `/demo`. Below `sm` the width drops to 112 to save a line.
- **Everything else: Geist**, sentence case: H3s, body, buttons, nav.
- Casing is presentation (`text-transform`), so the source copy stays sentence case.
- H1 is 34 / 48 / 58 / 64 px (base / sm / lg / xl), sized to hold **two lines** at lg and xl.
  "teaches you" is bound with `whitespace-nowrap` so "you" never orphans.
- Section H2s are 26 / 36 / 40 px, `leading-[1.05]`, `text-balance`.

## Shape and elevation

`shape.ts`: pill (full), control 10px, surface 16px, band 20px. One system, four roles.
Elevation is `.lp-shadow` / `.lp-shadow-lg`, one colour per theme (`--lp-shadow` carries its
own alpha: soft ink on paper, a deep drop on ink).

## Components

- **Nav:** wordmark (unchanged mark), section links at lg+, theme toggle at sm+, Sign in,
  "Try a lesson" (accent). 72px, one line at every width down to 360.
- **Hero:** eyebrow, full-width display H1, then a 380px column (subtext + stacked CTAs)
  beside the classroom shot, which bleeds at xl/2xl. Not wrapped in `Reveal` (LCP).
- **Capability strip:** plain list between two hairlines, no card.
- **Cards:** `surface` + `line`. The warm `tint` gradient marks the one standout per group.
- **Closing band:** `surface` with the light rising from its lower edge; the button is the
  only solid accent in it.

## Eyebrows

Two on the page (hero "Grades 6 to 8", "For parents"). The budget is three.
