# V8.7: assets and cleanup (the last V8 step)

## Context

V8.6 merged as #23 (`d0f78f0`); state.md is updated on `dev/v8-7-cleanup` (c7b558b, off origin/deploy-prep). The V8
plan's V8.7 is "re-capture, assets, cleanup". Part of it is already done or moot:
- `scripts/capture-demo-video.mjs` is gone, because V8.3 dropped the hero video.
- V8.3d re-shot every landing still into `public/images/landing/v3b/`.
- Legacy components were removed in V9.5.

What is left, with your answers (2026-10-06):
- an OG image with words and a room still (variants first);
- dead code listed for you to confirm, then removed;
- the /dev pages onto the tokens;
- plan here, then **switch this session to Sonnet** for the build.

The scan also found **three in-scene UI leftovers** the V8.4 sweep missed. They are on the old palette, one has an
emoji, and they likely fail AA:
- `Experience.tsx` `YourTurnBubble`: "🎙 Your turn", `aristo-orange-ink` on white;
- `Teacher.tsx`: the "Thinking…" chip while a teacher loads;
- `GeneratedModel.tsx`: the 3D model's annotation labels.

## Steps

### 1. In-scene leftovers onto the system (one commit)

Use the V8.4a in-scene pattern (brand-system "Classroom (V8.4a)", in-scene controls and callouts): `.theme-ink` pills,
`bg-bg/[0.86]`, `border-line`, `backdrop-blur-md`, `shadow-e2`, text in `ink` / `body`. They sit on the lit room, which
never follows the theme.

- **YourTurnBubble:** a `Mic` icon (lucide) replaces 🎙. The dot is `bg-accent`. Its keyframes run under `motion-safe` /
  `prefers-reduced-motion` like the rest of the room. The inline styles become classes.
- **Thinking chip:** the same pill, with the pulsing dot `bg-accent motion-safe:animate-pulse-soft`.
- **Annotation labels:**
  - at rest: an ink pill;
  - on hover: `bg-accent text-accent-ink` (the one-orange rule, V8.4a).
- **Verify:** the AA checker over each state, captured headless:
  - the thinking chip on /demo during the teacher load;
  - "Your turn" on /demo or the learn-shell harness, forcing the listening state through `window.__store`;
  - annotations on `/dev/free-model` with a model that has annotations.

### 2. /dev pages onto the tokens (one commit)

- **Files:** `src/components/dev/AvatarLab.tsx` (inline `#fff`, `#F3E7DA`, `#4A3A2C`, BRAND_HEX buttons),
  `DeskQuizPreview.tsx`, `FreeModelPreview.tsx`, and the `pages/dev/*` wrappers (`aristo-backdrop`).
- **Mapping:**
  - Panels go to `bg-surface border-line`, and text to `ink` / `body` / `muted`.
  - Toggle buttons use the segmented-control pattern (sunk rail, chosen `bg-surface text-ink shadow-e1`,
    `aria-pressed`).
  - Pass and fail colours go to `success` / `danger` with a word.
- **Kept, commented:** genuine scene constants (a canvas clear colour, the desk backdrop behind the 3D).
- **Register:** the V8.7 row goes; anything kept moves to "stays".
- **Verify:** `/dev/avatar-lab`, `/dev/desk-quiz` and `/dev/free-model` captured in both themes at 1280 (dev tools,
  desktop only), with the AA checker and 0 API calls.

### 3. OG image: words plus a room still (stop for your pick)

- **Source:** `v3b/room.webp` (1600x900, opaque: Jake in the lit room beside the 3D brain). `ImageResponse` cannot read
  webp, so a small script `scripts/brand/og-still.mjs` uses sharp, already a Next dependency, to write a committed JPEG
  crop to `public/images/og/`. `opengraph-image.tsx` reads it at build (`fs`, data URL), keeping the static render.
- **Three variants** at 1200x630, each also shown at 600x315 to check what a feed shows:
  - **A, split:** today's mark and headline on the ink left; the still full-bleed on the right 55%.
  - **B, full bleed:** the still across the frame with an ink fade from the left, and the words over the fade.
  - **C, window:** the still as a framed, lit window with the 16px radius and `shadow-e2` on ink, the words beside it
    (the landing's "the classroom is the lit window").
- **Stop:** I send the variants and you pick. Then I implement the pick.
  - `/` and `/demo` already point `og:image` and `twitter:image` at `/opengraph-image`, so no metadata change.
  - The literals stay in the register (rendered outside CSS).
- **Verify:**
  - `yarn build`, then on `next start` fetch `/opengraph-image`: 1200x630 PNG, a sane size.
  - Text contrast on the still side checked by sampling the rendered pixels under the words.

### 4. Dead code: list, confirm, remove (stop for your confirmation)

- **When:** after steps 1 and 2, because they free more tokens.
- **The list:** `.claude/eval/2026-10-06-v8-7/dead-code.md`, one row per item with its zero-reference proof (the grep
  across `src`, `pages` and `tailwind.config.js`, excluding its own definition). Candidates today:
  - `--aristo-*` with no user beyond `globals.css`, `tailwind.config.js` and `brandColors.ts`: `beige`, `brown-faint`,
    `brown-soft`, `brown-muted`, `orange-deep`, `orange-hover`, `orange-light`, `orange-pale`, `peach`, `peach-pale`,
    `sand`, `tan`, `teal`, `blue`, `wash`, `wash-faint`, `wash-light`, `purple-hover`. Steps 1 and 2 add the ones they
    free (likely `cream`, `beige-dark`, `brown-main`, `orange-ink`, `backdrop`).
  - Tailwind `aristo-gradient` and `aristo-gradient-warm` (background images), and `shadow-aristo-sm`, `shadow-aristo`
    and `shadow-aristo-lg`, once step 1 frees them.
  - `.text-gradient` in `globals.css` (its only user, the onboarding title, went in V8.6).
  - `BRAND_HEX` keys besides `orangeMain`, `purple`, `amber` and `backdrop`, with `brandColors.test.ts` trimmed to match.
  - `public/images/landing/v3/` (one unused `idea.webp`).
- **Stop:** you confirm. Then everything goes in one commit, verified by build, tests and lint, and a before/after pixel
  diff of `/` (light and dark, 1280) and /demo, which must be identical.

### 5. Docs

- **brand-system.md:**
  - the `aristo-*` palette section is reduced to what is left and why;
  - the register has no V8.7 rows;
  - the OG image entry is added.
- **CLAUDE.md:** the Vision bullet.
- **decisions.md:** the OG variant chosen; the dead-code removal.
- **state.md:** the entry.
- **V8 plan:** tick V8.7 and close V8.

## Order and stops

1. Steps 1 and 2 (build, about an hour).
2. **Stop A:** the OG variants for your pick.
3. Step 3 implemented.
4. **Stop B:** the dead-code list for your confirmation.
5. Step 4.
6. Docs.
7. PR into deploy-prep; merge once CI passes and you have seen the OG sheet.

The model switch happens after this plan is approved: I stop and you switch this session to Sonnet.

## Verification (whole step)

- AA 0 failures and no target under 44px on every changed in-scene and /dev state, in both themes.
- `yarn test`, `yarn lint` and `yarn type-check` green.
- `yarn build` (dev stopped first, `src/app/hx` moved aside as in CI), then `next start` for the OG and the pixel diff.
- No paid generation: /demo and the harnesses only; the network watched for the paid routes.
