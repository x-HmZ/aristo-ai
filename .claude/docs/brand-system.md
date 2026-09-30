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
  identity from their number (1 to 5), their icon and their position in the sequence, all in the one accent
  (the phase rail and phase label, below). The classroom moved over in V8.4a to V8.4c; no phase or Bloom hue is left
  in it.
- **On the system:** /learn and /demo, since V8.4c: the lesson panel and band (V8.4a), the quiz and inputs (V8.4b),
  and free mode, the pickers, the loading screen, the daily review and the page shells (V8.4c). They follow the theme.
  Inside /learn, onboarding, the course map and the dashboard are V8.6's: pinned light with `.theme-paper`.
- **Not on the system yet:** /admin/* and /create-teacher (V8.6). They declare the theme lock (see Theme) and keep
  the `aristo-*` palette. /dev/* (V8.7) has no lock since V8.4c and follows the theme; its dev UI keeps literals.

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
| `accent` | #F97B2F | #E98A52 | solid fills: primary buttons, the lit flute, progress, the current phase |
| `accent-hover` | #FA8C47 | #F0A070 | hover on accent fills, lighter in both themes: 6.26 / 8.19 under accent-ink. Never hover with an alpha (`bg-accent/90` over surface washes the fill out) |
| `accent-ink` | #3D2110 | #2A160A | text on accent fills, the brand brown: 5.55 / 6.75 |
| `status-ink` | #FCFCFD | #0E1117 | text on status fills (danger button, badge, toast): danger 6.31 / 6.83 |
| `accent-text` | #A94C1B | #EF9A66 | accent as text, icon or focus ring: on bg 5.11 / 8.53, surface 5.48 / 7.94, sunk 4.75 / 8.78, tint 4.74 / 7.74 |

The accent is the brand orange (`--aristo-orange-main` #F97B2F, hue 22.6 degrees) in light mode, lightened to
#E98A52 in dark mode. Since V8.4a it is one orange on every filled button, app-wide (Hmz's choice). White fails
on it (2.66:1), so labels on it are the brand brown (#3D2110, 5.55:1; #2A160A on the dark accent, 6.75). Near-black
passed too (7.11) but read harsh against the saturated orange, so the brown won (Hmz, V8.4a, from four options
rendered in context: terracotta + cream, orange + brown, tonal peach, slate). As text or as a focus ring #F97B2F fails too
(2.66 on white, 2.59 against the page, under the 3:1 a focus indicator needs), so orange text and focus rings
use `accent-text`. Before V8.4a the light accent was #B4531F with white labels (4.88), and the classroom still
showed #F97B2F beside it. There is no gradient text and no coloured glow on a control.

### Semantic (status)

Text-safe colours on every ground (`bg`, `surface`, `sunk`, `tint`). Tints use opacity (`bg-danger/10`,
`border-danger/25`). The light success and warning were darkened after review: the first cut (#15803D, #B45309)
was 4.2:1 on `sunk` and `tint`.

| Token | Light | on bg / surface / sunk | under status-ink | Dark | on bg / surface | under status-ink |
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

**Scroll-driven motion (the landing, V8.3).** Scroll drives scene time, damped (λ 8, frame-rate independent), so
motion arrives soft rather than stepped; nothing hijacks the scroll. Beats move by opacity and transform only (their
own layers), fade over about 3% of a section, and hold still in between. The hero lines rise in with CSS at first
paint (80ms apart). The camera eases (smoothstep) between held poses. Under reduced motion none of it runs: the page
is a stack.

## Components

- **Button** (`ui/button`): control radius, `PRESS`, `FOCUS`. Heights are 44 (default), 36 (sm) and 48 (lg),
  with a 44 square for icon buttons. Variants:
  - `default`: accent fill with accent-ink text, one per view; hover is `accent-hover`.
  - `outline`: surface with a line border.
  - `secondary`: sunk.
  - `ghost`, and `link` (accent-text).
  - `destructive`: danger fill with status-ink.
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
- **Focus:** `FOCUS` from `shape.ts`, a 2px `accent-text` ring offset 2px against `bg` (5.11 light, 8.53 dark). Every interactive element
  gets it.
- **Mark:** `AristoMark`: ink letters, accent flute. A standalone mark passes `decorative={false}` so it is
  named "Aristo".
- **Nav, hero, capability strip, cards, closing band:** the landing's own components, unchanged from
  T04b / V8.1.
- **Segmented control** (TeacherControls; the Tabs pattern for buttons): a 10px `sunk` rail with 4px padding,
  44px items with a 6px radius, the chosen one `bg-surface text-ink shadow-e1` and `aria-pressed`.

### Classroom (V8.4a)

- **Phase label** (`PhaseLabel` in `LessonView.tsx`): the phase icon in `accent-text`, then "Explain, step 2 of 5"
  in `text-xs` semibold ink. The landing hero chip reads the same.
- **Phase rail** (`PhaseRail`): five steps, each a number and an icon (Activate `History`, Explain `AudioLines`,
  Demonstrate `Presentation`, Challenge `Target`, Connect `Waypoints`), joined by hairlines. The current step is
  an accent pill with its name; done steps and their connectors are `accent-text` / `accent`; upcoming ones are
  `muted`. Not interactive.
- **Caption band** (`CaptionBand` in `LessonPlayer.tsx`): the sentence being spoken in medium ink, and the next one
  in `body`. It fits the whole sentence: 18, then 16, then 14px, then without the next line, and a whole-line clamp
  only as a last resort. It is ink glass: `.theme-ink`, `bg-bg/[0.86]`, `backdrop-blur-md`, `shadow-e2`, 16px
  radius. It has fixed geometry and hide rules (decisions.md) and shows from lg; below lg the panel shows the
  caption instead.
- **Panel ground:** the lesson scroll is `bg-bg/95` over the scene, cards are opaque `bg-surface` with `border-line`,
  and the bars (TeacherControls, playback row) are `bg-surface/95` with blur. At `/85` muted text fails over a
  dark scene pixel.
- **Transcript drawer:** a 44px disclosure (`aria-expanded`) holding the whole lesson by phase. The spoken sentence
  has a 3px `border-accent` on `bg-tint` in ink; the others are `body`.
- **In-scene controls:** "View in 3D" / "Show image" are `Button variant="secondary"` inside `.theme-ink`;
  status and hint chips and the callouts are `bg-bg/[0.86]` pills with `text-body` / `text-ink`.
- **Status in lesson cards:** key insight `warning` on `warning/10` with a Lightbulb icon; output and "in the room"
  chips `success` on `success/10`; code `ink` on `sunk`; hint and analogy on `tint`.

### Classroom (V8.4b): the quiz

- **Desk card** (`DeskQuiz`): a sheet of paper in the lit room, so `.theme-paper` keeps it light in both themes:
  `bg-surface`, `border-line`, `text-ink`, 16px radius, Geist. The box is 520 x 620px on a landscape canvas and
  narrower on a phone (255px at 360x640, 270 at 360x780, 300 at 390x844, 341 at 430x932; with `distanceFactor` the width
  sets the world size), chosen with the camera by `deskFraming` so the whole sheet fits with a 16px margin. Every button
  and field on it is 44 to 52px tall in CSS (`controlHeight` from `deskFraming`: 44 where the tilt leaves 44px on screen,
  up to 52 where it does not), so that it measures 44px or more on screen once the paper is tilted, on an answered
  card too (44 to 77px measured, 9 sizes, both themes). The entry animation and the camera glide
  are off under reduced motion.
- **QuizView** is host-agnostic (tokens only). The desk gives it the paper; the daily review (`ReviewView`) gives it the
  theme.
- **Choices** (multiple choice, true or false): 44px (48 for true or false), control radius. Idle `surface` with a
  `line` border and a `sunk` hover; picked and waiting for the mark, `accent` with `accent-ink`; right,
  `success/15` with `success` text, a border at `success/40` and a Check icon; wrong, the same in `danger` with an
  X icon; the rest after an answer, `sunk` with `muted`. Each mark also has screen-reader text ("Mantle is correct").
- **Feedback banner** (`role="status"`): an icon, "Correct." or "Not quite." in `success` or `danger`, then the
  explanation in `ink` on the `/10` tint. Wrong is `danger`, not `warning`.
- **Bloom level:** one neutral chip (`bg-sunk text-body`) with an icon and the label: remember `BookOpen`, understand
  `Lightbulb`, apply `Wrench`, analyze `ScanSearch`, evaluate `Scale`, create `Hammer`. Levels have no colours.
- **Other types:** fill in the blank uses the system `Input` and Button; short answer, code and matching use the same
  field style (`surface`, `line`, 44px); ordering rows have 44px ghost icon buttons (Chevron up and down) with labels;
  code and the model answer are `ink` on `sunk`.
- **Progress:** an `accent` fill on a `sunk` track, on the `duration-slow` token (0 under reduced motion). "Question n of m"
  carries the number in `accent-text`.
- **Bars** (`CourseFlow`, `InputBox`, `AnswerInputPanel`, the desk status strip, `DemoResultBar`):
  `bg-surface/95 border-t border-line backdrop-blur-md`, following the theme like the lesson panel. Buttons are the
  system's; the result score is `success`, `warning` or `danger` with an icon and words.
- **Mic and listening:** the mic is a secondary icon Button; listening is the `accent` fill, a stop icon, a solid
  `accent-text` ring and the status text "Listening…". The pulse, the spinner and the bounce are `motion-safe:`, so a
  reduced-motion reader still gets the ring and the words.

### Classroom (V8.4c): the shells

- **Top bar** (`ClassroomChrome.tsx`, shared by `LearnClient` and `DemoClient`): ink-glass pills on the room,
  `.theme-ink`, `bg-bg/[0.86] backdrop-blur-md border-line shadow-e1`, 52px tall around 44px controls, `px-5 pt-3` so
  they line up with the panel. Text on the glass is `ink`, `body` or `accent-text` only (muted is 4.34 over a white
  room pixel). The wordmark has its own pill (the `column` variant below sm). /learn: the reviews chip is the accent
  Button (RotateCcw and the count), then ghost Buttons for Progress, Map and Sign out, the initial and name (md and up),
  and the theme toggle; below md the actions are 44px icons whose names stay for screen readers (`max-md:sr-only`).
  /demo: "You're in the demo" (sm and up), "Create an account" as a ghost link in `accent-text`, the toggle.
- **Panel column:** `w-[400px] max-w-[calc(100vw-2.5rem)]`, `right-5 top-[76px] bottom-5`, `border-line`,
  `shadow-e2`, 16px radius; the message slot is `bg-bg/95 backdrop-blur-xl`; the demo's topic and teacher rows are
  `bg-surface/95` like TeacherControls (the teacher pills are the segmented control). While the quiz is on the desk the
  panel collapses to its strip (everything else `hidden`, not unmounted).
- **Pickers** (the demo topic picker, ModePicker): the system scrim (`bg-black/50 backdrop-blur-sm`) and a surface
  card with `shadow-e2`. Choices are surface cards with a `line` border and a `sunk` hover, an icon in a `tint`
  circle (`accent-text`) instead of emoji; errors are the danger message box.
- **Loading screen:** follows the theme: `bg-bg` page, a surface card, the `ink` wordmark with the `accent` flute,
  an `accent` fill on a `sunk` track (`role="progressbar"`), a `muted` caption that cross-fades. Reload keeps the
  system button look on a plain `<button>` so the first load stays flat.
- **Free mode:** cards are `surface` with an icon (`accent-text`) and a `muted` label; the example is `ink` on `tint`;
  the fun fact is `warning` on `warning/10` with a Lightbulb; the learner's own message is `ink` on `tint`, which
  leaves the accent to the send button.
- **Daily review** (`ReviewView`): follows the theme. The system scrim; loading, empty and done are surface cards with
  an icon in a tint circle; the result is one line with an icon and words in `success`, `warning` or `danger`; the
  quiz header is a `surface/95` bar with a ghost Skip; QuizView sits in the panel's column.
- **Lightbox:** `bg-black/80` scrim, the image at 16px radius with `shadow-e2`, a 44px ink-glass close button.

### Landing (V8.3): the scroll story

- **Structure:** seven sections, five of them pinned (`.landing-pin`, a sticky 100svh frame; heights in
  `landing/stage/timeline.ts SECTIONS`): the opening (a lit window beside the H1), the idea, from a question to a
  lesson (six steps), one lesson in five moves, the map beside one concept's memory curve, the parents (not pinned,
  no 3D), the close (the window again). Copy in `landing/content.ts`; the storyboard in
  `.claude/plans/V8.3-landing-plan.md`.
- **The room is the window.** The live stage is one fixed canvas under every frame, clipped to the opening's window
  and opened to full bleed by the scroll (a lens shift keeps the room composed inside the window), faded out for the
  map and the parents, closed into the close's window. The poster (`public/images/landing/v3/poster.webp`, the LCP)
  fades out when the stage is live. The room and Jake are the product's: same lights, backdrop and model.
- **Text over the room is ink glass**, the caption band recipe: `.theme-ink`, `bg-bg/[0.86]`, blur, `border-line`.
  That covers the section titles, the step rails, the typed question, the idea chips, the move cards, the captions,
  the caption band and the real-output label. The nav is a fixed glass bar in the page theme (`bg-bg/[0.9]`), with
  `body` links (muted fails over a bright room pixel). The lite path drops the blur (the 86% ground carries the
  contrast; AA is measured without the blur).
- **Step rail:** numbered pills; done `accent-text`, current an accent pill with `accent-ink`, next `body`. The move
  rail uses the phase rail's icons (History, AudioLines, Presentation, Target, Waypoints).
- **Caption band** (`sections/parts.tsx`): the line, its label in `accent-text`, and "Hear it" (a 44px toggle,
  `aria-pressed`; on, the accent fill). While a line plays its spoken words turn `accent-text`.
- **The map** (`sections/MapStory.tsx`, dataviz rules): one series, one hue. Nodes are `surface` circles with a
  `line` ring; mastery is an `accent-text` arc (the fill orange is 2.6:1 on the light page, under the 3:1 a graphic
  needs); a mastered node's core is `accent-text`, a ready one is outlined; links are `line`, lit links
  `accent-text/60`; review pulses are `accent-text` dots with a soft ring (no filter). Names show on hover and focus
  (each node is focusable); the concept being learned is named. The curve is a 2.5px `accent-text` line on
  `line` gridlines with `muted` axis labels, a hover crosshair and a screen-reader table. Both are labelled as an
  example learner.
- **Real output** is labelled where it shows: the centrepiece carries "Real output from the heart demo lesson. The
  transitions between the steps are an illustration." No speed or time claim beyond the demo's measured "about five
  minutes".
- **Screen readers and keyboards:** beats that take turns (the Idea, the question, the moves) are hidden from the
  accessibility tree while faded, so each of those sections carries a visually hidden transcript in reading order with
  the real headings (H2, and H3 per step or move); their animated copy is `aria-hidden`. The hero, the map and the close
  only fade, never hide, and any beat that takes keyboard focus shows itself (`:focus-within`). The map is one list of
  concepts for screen readers; hover names a node for a mouse.
- **Modes:** full (live stage), lite (stills from the stage that cross-fade, same DOM), stack (reduced motion, no JS:
  no pinning, stills at most 960px, every beat in flow). See decisions.md, "Landing modes".

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
| `bg-destructive`, `text-destructive-foreground`, `text-destructive` | `bg-danger`, `text-status-ink`, `text-danger` |
| `border`, `border-input`, `bg-border` | `border-line`, `bg-line` |
| `ring-ring`, `ring-offset-background` | `ring-accent-text`, `ring-offset-bg` |
| `rounded-md` / `rounded-sm` / `rounded-lg` | a `SHAPE` role (control, surface), 6px for nested items |
| `shadow-md` / `shadow-lg` | `shadow-e1` / `shadow-e2` |

## Theme

- `src/components/theme/theme.ts` holds the key (`aristo-theme`), the attribute (`data-theme` on `<html>`),
  the lock meta name and the pre-paint script.
- The script runs in the `<head>` of the root layout, so every App Router page paints in the stored theme, and in
  `pages/_document.tsx` (V8.4c) for the Pages Router (/learn, /demo, /dev/*), whose first paint is the loading screen.
  A choice under the pre-V8.2 key `aristo-landing-theme` is copied to the new key once, then deleted.
- The toggle is on the landing (nav at sm+, footer below sm) and in the classroom top bar (/learn and /demo, V8.4c).
  Its icon vars (`--theme-icon-*`) follow the page theme only: they are not in the rules `.theme-paper` and
  `.theme-ink` share, so the toggle on the ink pill still shows the page's icon.
- Resolution, in order:
  1. A page carrying `<meta name="aristo-theme-lock" content="light">` stays light.
  2. `data-theme`.
  3. `prefers-color-scheme`.
- The lock is read with `:has()`, so it covers Radix portals too. It also restores the pre-V8.2 page defaults
  on those pages: cream body, #2B1D12 text, #E8DDCF hairlines, the orange scrollbar. Lock sites:
  - `src/app/admin/layout.tsx`
  - `src/app/create-teacher/page.tsx`

  Remove the meta when a surface moves onto the tokens. `pages/_app.tsx` (/learn, /demo, /dev/*) lost its lock in
  V8.4c.
- A browser without `:has()` (Chrome < 105, Safari < 15.4, Firefox < 121) gets light everywhere. Locked
  pages then show the system's light neutrals instead of cream, but stay readable.
- Checked signed in (2026-09-29): /admin and /create-teacher get the lock meta in `<head>` with the first
  response, so an OS-dark visitor sees no dark frame. Both render light under OS-dark (/learn did too until V8.4c).
- The 3D scene's lighting and backdrop never follow the theme: the room is the lit window in both.
- **`.theme-ink`** (V8.4a) resolves the dark tokens on a subtree, whatever the page theme and through the lock.
  It shares the explicit dark rule through a forgiving `:is()` list, so the values exist once per route in and it
  survives browsers without `:has()`. Use it for anything placed on the lit room: the caption band, the callouts,
  the image and model toolbars, the classroom top bar's pills (V8.4c). The classroom panel itself follows the theme.
- V8.4c deleted the Pages Router lock from `pages/_app.tsx`; the V8.4a and V8.4b surfaces needed no edit. Dark is
  checked by the real theme (OS dark, a stored choice, the toggle), not by removing the meta.
- **`.theme-paper`** (V8.4b) is the light twin of `.theme-ink`: it sits in the `:root` rule of `globals.css`, so it
  pins the light values on a subtree whatever the page theme (and the lock). Use it for anything that lies in the lit
  room as an object. The desk quiz card is its designed user; since V8.4c it also pins the V8.6 surfaces inside /learn
  (onboarding, course map, dashboard) light until they move onto the tokens.
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
| `DashboardView`, `CourseMapView`, `OnboardingView`, `CreateTeacherClient` | status greens and reds, mastery colours, the aristo palette, emoji | not on the system yet; on /learn they are pinned light with `.theme-paper`. The classroom's own went in V8.4a (`LessonView`), V8.4b (the quiz files) and V8.4c (`FreeTopicCard`, `ModePicker`, `ReviewView`, `LoadingScreenVisual`, the `LearnClient` / `DemoClient` shells, `AvatarCredit`, `.aristo-scroll`): none left there | V8.6 |
| `DeskQuiz` | the paper's grounding shadow, `rgba(30,14,6,0.65)` | a scene constant: it is a shadow cast on the desk in the lit room, tuned by eye in 3D, and `--shadow` is far too faint for it. Commented at the definition | stays |
| `src/app/admin/*` (cost, overview, courses, quiz-analytics, misconceptions, knowledge graph) | data-viz and provider colours, status literals | internal; categorical data-viz is not a semantic colour | V8.6 (admin token pass) |
| `Classroom.tsx`, `Experience.tsx`, `DeskQuiz.tsx` | scene material and light constants | three.js needs strings; commented at the definition | stays |
| `opengraph-image.tsx`, `apple-icon.tsx` | image colours | rendered outside CSS | stays |
| `AvatarLab.tsx`, `DeskQuizPreview.tsx`, `FreeModelPreview.tsx` | dev-page neutrals | `/dev` only | V8.7 |

## Known AA gaps (inside locked surfaces)

Fixed in V8.4a inside the lesson panel, TeacherControls, the message panel, the callouts and the in-scene toolbars:
white on #F97B2F (Next, Submit, Resume, the teacher pill, View in 3D; now `accent` with ink, 7.11, or the
secondary button), `aristo-orange-ink` on cream (the analogy label, Pause, the course title, the diagrams overlay),
#F97B2F as text (Explain more, 2.66), amber feedback text (2.15), the tan Scene label (2.76), the callouts'
orange-deep on wash (4.14) and the licence credit in the controls bar (4.1, now `muted` 5.3). Measured: 1812 text
nodes, minimum 4.71 light and 5.24 dark (`.claude/eval/2026-09-29-v8-4a/`).

Also in V8.4a, with the one-orange change: every remaining white-on-#F97B2F fill in the classroom carries ink
instead of white (Take Quiz, the demo teacher pills, the quiz's buttons and chosen options, the answer and input send and
mic buttons, review, the course map, loading retry, the reviews chip, the avatar initial: brand brown, 5.55,
hovering to `accent-hover` 6.26), and the demo banner's Create an account link is `accent-text` (5.1).

Fixed in V8.4b (the quiz, desk card, answer panel, input box and quiz bars): #F97B2F as text ("Question 1 of 2", the
fill-in-the-blank), the quiz's green and red on tints (`success` / `danger` on `/15` tints, 5.53 / 4.89 light), the
amber "not quite" banner, the Bloom hues, the grey `aristo-brown-faint` labels and the leftover white-on-orange. Measured over
the desk card, every question type, the answer panel, the input box and the bars: 3,292 text nodes, 0 failures, minimum
5.26 (`.claude/eval/2026-09-29-v8-4b/`). Two non-text gaps are left on purpose:

- The progress fill, `accent` on `sunk` (2.25:1 light), is under the 3:1 a graphic needs. "Question n of m" carries the
  number, and the rest of the system uses `accent` for progress.
- Choice and field outlines are `line` on `surface` (1.30:1), the system-wide field border. The text names each control,
  and right or wrong is never colour alone (icon, words, border).

Fixed in V8.4c (the shells, pickers, loading, free mode, review, then the lock deleted): the /learn top nav's orange
hovers, `FreeTopicCard`'s orange, green and amber labels and text, the loading screen's grey caption, `AvatarCredit`'s
brown-muted (now `muted`), the demo banner and teacher row over white glass (1.22 to 1.97 over a dark pixel), the red
course error (2.34) and ReviewView's faint lines. Measured in real themes: 8,076 text nodes, 0 failures, minimum 4.74
light and 5.24 dark (before: 6,031 nodes, 1,363 failures, minimum 1.22; `.claude/eval/2026-09-29-v8-4c/`).

Fixed in the desk-framing task (2026-09-30): the desk card cropped by the camera on portrait sizes (49% visible at 360x780,
80% at 768x1024) and its tilted controls measuring 34 to 43px. Measured: the card is fully visible and every control is
at least 44px in 144 states, and the AA figures are unchanged (`.claude/eval/2026-09-30-desk-framing/`).

Still open:

- The desk quiz on a landscape phone (844x390, 667x375): 238px of height is left between the top bar and the strip, so
  `deskFraming` keeps today's framing there and the card is cropped, with controls at about 28px on screen. Owner: a
  task on the panel and strip layout, not the camera.
- The V8.6 surfaces inside /learn (onboarding, course map, dashboard), pinned light: orange and brown-muted text as
  low as 1.82 (the gradient "Aristo" title reads as transparent to the checker).

Admin, also V8.6: the sidebar's section labels (orange on beige, about 2.35:1), the active nav item (white on
#F97B2F, 2.66:1) and the "Aristo Admin" header (about 2.5:1). All were lower before V8.2 (#F59047).
