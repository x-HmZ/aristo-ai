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
  (the phase rail and phase label, below). The lesson panel moved over in V8.4a; the quiz still uses the legacy
  hues until V8.4b.
- **Partly on the system:** /learn and /demo. The lesson panel, TeacherControls, the message panel's own states,
  the caption band, the callouts and the in-scene toolbars are on the tokens (V8.4a). The quiz and inputs (V8.4b)
  and free mode, pickers, loading and the page shells in `LearnClient` / `DemoClient` (V8.4c) are not.
- **Not on the system yet:** /dev/* (V8.7), and /admin/* and /create-teacher (V8.6). They declare the theme lock
  (see Theme) and keep the `aristo-*` palette.

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
  `bg-surface`, `border-line`, `text-ink`, 16px radius, Geist. Its 520 x 620px box is untouched (with
  `distanceFactor` it sets the world size). The entry animation is off under reduced motion.
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
- **`.theme-ink`** (V8.4a) resolves the dark tokens on a subtree, whatever the page theme and through the lock.
  It shares the explicit dark rule through a forgiving `:is()` list, so the values exist once per route in and it
  survives browsers without `:has()`. Use it for anything placed on the lit room: the caption band, the callouts,
  the image and model toolbars. The classroom panel itself follows the theme.
- The Pages Router lock stays until V8.4c is on the tokens; V8.4c deletes it from `pages/_app.tsx`. The V8.4a and
  V8.4b surfaces need no edit then (dark checked by removing the meta in the browser).
- **`.theme-paper`** (V8.4b) is the light twin of `.theme-ink`: it sits in the `:root` rule of `globals.css`, so it
  pins the light values on a subtree whatever the page theme (and the lock). Use it for anything that lies in the lit
  room as an object. The desk quiz card is the one user.
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
| `DashboardView`, `CreateTeacherClient`, `FreeTopicCard`, `CourseMapView`, `ModePicker`, `ReviewView` | status greens and reds, key-insight ambers, code-block themes, Bloom-level colours, emoji | moving them would change /learn and /demo, which V8.2 must not do. `LessonView`'s went in V8.4a and the quiz files' in V8.4b (none left in `QuizView`, `AnswerInputPanel`, `InputBox`, `CourseFlow` or the desk card, apart from the row below) | V8.4c |
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

Still open:

- Orange as text: the /learn top nav hovers and `FreeTopicCard` (V8.4c). The quiz labels went in V8.4b.
- The loading screen's grey caption (V8.4c).
- `AvatarCredit` on its own (the /demo teacher row) keeps brown-muted #8B6E5A (4.69 on white, lower over glass).

Admin, also V8.6: the sidebar's section labels (orange on beige, about 2.35:1), the active nav item (white on
#F97B2F, 2.66:1) and the "Aristo Admin" header (about 2.5:1). All were lower before V8.2 (#F59047).
