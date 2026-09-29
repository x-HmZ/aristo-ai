# Aristo brand system

The design system for the whole app. Written in V8.2 (2026-09-29) and promoted from the landing page's
"Night Class" set (T04b, 2026-09-11). It supersedes `landing-design-system.md`, which is now only a
pointer. The source of truth is code: tokens in `src/app/globals.css`, Tailwind names in `tailwind.config.js`,
and shape, press and focus in `src/lib/design/shape.ts`. If this file and the code disagree, fix one of them
in the same PR. Copy comes from `.claude/docs/brand/messaging.md`, the mark from `src/components/brand/AristoMark.tsx`.

## Overview

The system is dark first, with a real light variant. The page is ink; the classroom (the 3D room, and
screenshots of it) is the warm, lit window, so the classroom is the brightest thing on a page. Orange is a
spark, never a fill: primary actions, one word of a headline, icons, step numbers, the lit flute in the mark.

- **The theme follows the OS.** The toggle (landing nav at sm+, footer below sm) stores an explicit choice,
  and choosing the mode the OS already wants clears it. There is no third "system" state. The choice applies
  app-wide.
- **One accent.** No second hue competes with it. Status colours (success, warning, danger, info) are for
  status only.
- **The five lesson phases have no colours.** Activate, Explain, Demonstrate, Challenge and Connect get their
  identity from their number (1 to 5), their icon and their position in the sequence, all in the one accent.
  The classroom still uses the five legacy hues until V8.4a moves it over.
- **Not on the system yet:** /learn, /demo and /dev/* (V8.4), and /admin/* and /create-teacher (V8.6). They
  declare the theme lock (see Theme) and keep the `aristo-*` palette.

## Colours

Tokens are bare RGB channels on `:root`, so Tailwind opacity modifiers work (`bg-accent/90`, `bg-danger/10`).
The dark block exists twice in `globals.css`, once for the media query and once for `[data-theme="dark"]`.
Keep the two copies identical.

### Surface

| Token / class | Light | Dark | Use |
|---|---|---|---|
| `bg` (`bg-bg`) | #F3F4F6 | #0E1117 | page |
| `surface` | #FCFCFD | #151922 | cards, panels, inputs, popovers, dialogs |
| `sunk` | #EAECF0 | #0B0D12 | footer, wells, secondary buttons, hover fills, tab rails |
| `line` | #DCDFE5 | #252B36 | every hairline and border; the global default border colour |
| `tint` / `tint-line` | #F4EAE3 / #E6D3C6 | #211A17 / #3A2C24 | warm wash on at most one surface per section; info messages |

### Text

| Token | Light | on bg / surface / sunk | Dark | on bg / surface / sunk | Use |
|---|---|---|---|---|---|
| `ink` | #0E1117 | 17.17 / 18.43 / 15.98 | #ECEDEF | 16.13 / 15.01 / 16.59 | headings, primary text, the default body colour |
| `body` | #3E4452 | 8.86 / 9.51 / 8.24 | #B7BDC7 | 10.00 / 9.31 / 10.29 | paragraphs |
| `muted` | #5A6170 | 5.65 / 6.06 / 5.26 | #8F97A4 | 6.42 / 5.97 / 6.60 | labels, captions, placeholders, nav |

### Brand and accent

| Token | Light | Dark | Use and ratio |
|---|---|---|---|
| `accent` | #B4531F | #E98A52 | solid fills: primary buttons, the lit flute, focus rings, progress |
| `accent-hover` | #9A4A1E | #F0A070 | hover on accent fills (darker in light, lighter in dark): 6.07 / 8.97 under accent-ink. Never hover with an alpha (`bg-accent/90` over surface drops the label to 4.1:1) |
| `accent-ink` | #FCFCFD | #0E1117 | text on **any** solid fill: accent 4.88 / 7.40; status fills below |
| `accent-text` | #A94C1B | #EF9A66 | accent as text or icon: on bg 5.11 / 8.53, surface 5.48 / 7.94, sunk 4.75 / 8.78, tint 4.74 / 7.74 |

The accent is the classroom orange (`--aristo-orange-main` #F97B2F, hue 22.6 degrees), darkened in light mode
and lightened in dark mode until it clears AA. #F97B2F itself fails as text and as a UI colour (2.66:1 on
white, 2.53 on cream), so it never carries text in the system. Saturation stays under 80%. There is no
gradient text and no coloured glow on a control.

### Semantic (status)

Text-safe colours on every ground (`bg`, `surface`, `sunk`, `tint`). Tints use opacity (`bg-danger/10`,
`border-danger/25`). The light success and warning were darkened after review: the first cut (#15803D, #B45309)
was 4.2:1 on `sunk` and `tint`.

| Token | Light | on bg / surface / sunk | under accent-ink | Dark | on bg / surface | under accent-ink |
|---|---|---|---|---|---|---|
| `success` | #166534 | 6.48 / 6.95 / 6.03 | 6.95 | #4ADE80 | 10.85 / 10.09 | 10.85 |
| `warning` | #92400E | 6.44 / 6.92 / 5.99 | 6.92 | #FBBF24 | 11.32 / 10.54 | 11.32 |
| `danger` | #B91C1C | 5.88 / 6.31 / 5.47 | 6.31 | #F87171 | 6.83 / 6.36 | 6.83 |
| `info` | #1D4ED8 | 6.09 / 6.54 / 5.67 | 6.54 | #60A5FA | 7.43 / 6.92 | 7.43 |

Danger text on its own 10% tint over surface is 5.35 light and 5.54 dark (the sign-in error box).

### Scrim

Overlays (dialog, sheet) are `bg-black/50` with `backdrop-blur-sm` in both themes. An ink scrim would turn
light in dark mode.

### The `aristo-*` palette (classroom)

`--aristo-*` in `globals.css` (HSL, each with its hex in a comment, checked by `src/lib/brandColors.test.ts`;
JS reads `BRAND_HEX` from `src/lib/brandColors.ts`) is the classroom's palette: pastel orange, cream, beige
and brown. It is **not themed**. Since V8.2 there is one orange (`aristo-orange-main` #F97B2F) and one brown
(`aristo-brown-main` #3D2110). The five phase hues (`purple`, `teal`, `blue`, `amber`) are deprecated. New
product UI uses the semantic tokens, not this palette.

## Typography

- **Geist** for everything in the product; **Geist Mono** for code, IDs and numbers in tables.
- **Archivo, `wdth` 125, capitals** (`.display-wide`) for the landing hero line and closing line only. It is
  loaded by `src/components/landing/fonts.ts`, so it never loads outside `/`. Below `sm` the width drops to 112.
- Headings are Title Case; body, buttons and nav are sentence case. Casing is presentation
  (`text-transform`), so the copy source stays sentence case.

### Scale (`type-*` utilities)

| Class | Size / line height | Tracking | Use |
|---|---|---|---|
| `type-display` | 56px / 1.02 | -0.02em | display lines outside the landing's tuned hero |
| `type-h1` | 36px / 1.1 | -0.015em | page titles |
| `type-h2` | 28px / 1.15 | -0.01em | section titles, the auth card title |
| `type-h3` | 20px / 1.3 | | card, dialog and sheet titles |
| `type-h4` | 17px / 1.4 | | sub-heads |
| `type-copy` | 16px / 1.6 | | body copy |
| `type-caption` | 13px / 1.45 | | captions, meta |
| `type-mono` | 14px / 1.55 | | code, IDs (sets Geist Mono) |

The classes are `type-*` and not `text-*` on purpose: `cn()` (tailwind-merge) treats an unknown `text-*` as
a colour and would silently drop `text-h1` next to `text-ink`. Weight is a separate utility.

**tailwind-merge caveat.** `cn()` is unconfigured, so it does not know that `type-*`, `shadow-e1/e2`,
`duration-fast/base/slow/reveal` and `ease-*-soft` conflict with `text-lg`, `shadow-lg`, `duration-200` or
`ease-in`. Both classes survive and CSS order picks the winner. When overriding a component that uses one
of these, remove the system class rather than stacking a Tailwind one on top. Controls keep
Tailwind's `text-sm`. The landing keeps its own tuned hero and H2 sizes (33 to 84px hero, 28 / 36 / 44px H2s).

## Layout

- The page gutter is 16px at 360, growing with the landing's container (`max-w` 1088 content column at lg+).
- Density is comfortable: cards `p-6` to `p-8`, form fields `space-y-4`, label to field `space-y-2`.
- No horizontal scroll at 360. Verified on `/`, `/sign-in` and `/sign-up` at 360 / 768 / 1280.

### Shape (`src/lib/design/shape.ts`)

| Role | Radius | Use |
|---|---|---|
| `pill` | full | badges, chips, the progress bar |
| `control` | 10px | buttons, inputs, select triggers, menus, tooltips, message boxes |
| `surface` | 16px | cards, dialogs, popovers, toasts, media frames |
| `band` | 20px | full-width feature bands, the closing CTA |

An item inside a padded container takes the container's radius minus the padding: menu items are 6px inside
a 10px menu with 4px padding. That is the only derived radius. The classroom's `rounded-lg` (12px, `--radius`)
is not part of the system.

## Elevation

One shadow colour per theme. `--shadow` carries its own alpha: soft ink on paper (14 17 23 / 0.14), a deep
drop on ink (0 0 0 / 0.5).

| Class | Value | Use |
|---|---|---|
| `shadow-e1` | 0 12px 30px | cards that float (the auth card), popovers, menus, selects, tooltips |
| `shadow-e2` | 0 30px 70px + 0 6px 18px | dialogs, sheets, toasts, hero media |

Flat cards on a page use `border-line` and no shadow. The warm light spill (`.glow-pool`, `.glow-rise`,
strength a theme token) is atmosphere behind hero media and inside a closing band, nowhere else.

## Motion

| Token | Tailwind | Value | Use |
|---|---|---|---|
| `--dur-fast` | `duration-fast` | 120ms | press, hover, focus |
| `--dur-base` | `duration-base` | 200ms | menus, toggles, small moves |
| `--dur-slow` | `duration-slow` | 360ms | dialogs, sheets, panels |
| `--dur-reveal` | `duration-reveal` | 550ms | scroll-in reveals |
| `--ease-out` | `ease-out-soft` | cubic-bezier(0.22, 1, 0.36, 1) | things arriving |
| `--ease-in-out` | `ease-in-out-soft` | cubic-bezier(0.65, 0, 0.35, 1) | things moving across |

Under `prefers-reduced-motion` every duration token is 0ms, `PRESS` drops its transform, and reveals render
in place.

## Components

- **Button** (`ui/button`): control radius, `PRESS`, `FOCUS`. Heights are 44 (default), 36 (sm) and 48 (lg),
  with a 44 square for icon buttons. Variants:
  - `default`: accent fill with accent-ink text, one per view; hover is `accent-hover`.
  - `outline`: surface with a line border.
  - `secondary`: sunk.
  - `ghost`, and `link` (accent-text).
  - `destructive`: danger fill with accent-ink.
- **Input / Select trigger:** 44px, control radius, surface fill, line border that darkens to `muted/50` on
  hover, accent focus ring offset against the page.
- **Card:** surface, line border, 16px radius, no shadow. Titles use `type-h3`.
- **Dialog / Sheet:** surface, `shadow-e2`, black 50% scrim with blur. The dialog has the 16px radius.
- **Popover / Menu / Select content / Tooltip:** surface, line border, `shadow-e1`. Popovers are 16px; menus
  and tooltips are 10px, with 6px items and a `sunk` hover.
- **Tabs:** a 44px sunk rail; the active tab is a surface.
- **Toast:** surface (or a danger fill), 16px, `shadow-e2`.
- **Message boxes** (auth): errors are `bg-danger/10 border-danger/25 text-danger`; notices are
  `bg-tint border-tint-line text-ink`. Both use the 10px radius.
- **Focus:** `FOCUS` from `shape.ts`, a 2px accent ring offset 2px against `bg`. Every interactive element
  gets it.
- **Mark:** `AristoMark`: ink letters, accent flute. A standalone mark passes `decorative={false}` so it is
  named "Aristo".
- **Nav, hero, capability strip, cards, closing band:** the landing's own components, unchanged from
  T04b / V8.1.

### shadcn mapping (for `npx shadcn add`)

shadcn's colour vocabulary was removed in V8.2: its `accent` means a hover tint, which contradicts the
system's `accent`. After adding a component, translate:

| shadcn | System |
|---|---|
| `bg-background` | `bg-bg` (page) or `bg-surface` (fields, panels) |
| `text-foreground`, `text-card-foreground`, `text-popover-foreground` | `text-ink` |
| `bg-card`, `bg-popover` | `bg-surface` |
| `bg-primary`, `text-primary-foreground` | `bg-accent`, `text-accent-ink` |
| `text-primary` | `text-accent-text` |
| `bg-secondary`, `bg-muted` | `bg-sunk` |
| `text-muted-foreground` | `text-muted` |
| `bg-accent` / `hover:bg-accent` (hover tint), `text-accent-foreground` | `bg-sunk`, `text-ink` |
| `bg-destructive`, `text-destructive-foreground`, `text-destructive` | `bg-danger`, `text-accent-ink`, `text-danger` |
| `border`, `border-input`, `bg-border` | `border-line`, `bg-line` |
| `ring-ring`, `ring-offset-background` | `ring-accent`, `ring-offset-bg` |
| `rounded-md` / `rounded-sm` / `rounded-lg` | a `SHAPE` role (control, surface), 6px for nested items |
| `shadow-md` / `shadow-lg` | `shadow-e1` / `shadow-e2` |

## Theme

- `src/components/theme/theme.ts` holds the key (`aristo-theme`), the attribute (`data-theme` on `<html>`),
  the lock meta name and the pre-paint script.
- The script runs in the `<head>` of the root layout, so every App Router page paints in the stored theme. A
  choice under the pre-V8.2 key `aristo-landing-theme` is copied to the new key once, then deleted.
- Resolution, in order:
  1. A page carrying `<meta name="aristo-theme-lock" content="light">` stays light.
  2. `data-theme`.
  3. `prefers-color-scheme`.
- The lock is read with `:has()`, so it covers Radix portals too. It also restores the pre-V8.2 page defaults
  on those pages: cream body, #2B1D12 text, #E8DDCF hairlines, the orange scrollbar. Lock sites:
  - `pages/_app.tsx` (/learn, /demo, /dev/*)
  - `src/app/admin/layout.tsx`
  - `src/app/create-teacher/page.tsx`

  Remove the meta when a surface moves onto the tokens.
- A browser without `:has()` (Chrome < 105, Safari < 15.4, Firefox < 121) gets light everywhere. Locked
  pages then show the system's light neutrals instead of cream, but stay readable.
- Checked signed in (2026-09-29): /admin and /create-teacher get the lock meta in `<head>` with the first
  response, so an OS-dark visitor sees no dark frame. Both render light under OS-dark, as does /learn.
- The 3D scene's lighting and backdrop never follow the theme: the room is the lit window in both.
- Do not use Tailwind `dark:` variants. Themes switch through the tokens.

## Responsive behaviour

- Breakpoints are Tailwind's (sm 640, md 768, lg 1024, xl 1280). Designs are checked at 360 / 768 / 1280 in
  both themes.
- Touch targets are at least 44px: buttons, inputs, the theme toggle and nav links.
- Landing: the nav stays on one line down to 360. Section links appear at lg+ and the toggle at sm+ (in the
  footer below that). The hero is one sentence per line.

## Hex literals still in components (register)

The V8.2 acceptance asks for none outside documented 3D-material constants. These remain on purpose, each
with an owner:

| Where | What | Why kept | Owner |
|---|---|---|---|
| `QuizView`, `LessonView`, `DashboardView`, `CreateTeacherClient`, `FreeTopicCard`, `CourseMapView`, `ModePicker` | quiz right/wrong greens and reds, key-insight ambers, code-block themes, Bloom-level colours | moving them would change /learn and /demo, which V8.2 must not do | V8.4a / V8.4b |
| `src/app/admin/*` (cost, overview, courses, quiz-analytics, misconceptions, knowledge graph) | data-viz and provider colours, status literals | internal; categorical data-viz is not a semantic colour | V8.6 (admin token pass) |
| `Classroom.tsx`, `Experience.tsx`, `DeskQuiz.tsx` | scene material and light constants | three.js needs strings; commented at the definition | stays |
| `opengraph-image.tsx`, `apple-icon.tsx` | image colours | rendered outside CSS | stays |
| `AvatarLab.tsx`, `DeskQuizPreview.tsx`, `FreeModelPreview.tsx` | dev-page neutrals | `/dev` only | V8.7 |

## Known AA gaps (inside locked surfaces)

These are recorded, not fixed, because the classroom look must not change before V8.4:

- White on #F97B2F buttons (2.66:1).
- `aristo-orange-ink` #C45A10 as small text on cream (4.15:1).
- The loading screen's grey caption.

Admin, also V8.6: the sidebar's section labels (orange on beige, about 2.35:1), the active nav item (white on
#F97B2F, 2.66:1) and the "Aristo Admin" header (about 2.5:1). All were lower before V8.2 (#F59047).
