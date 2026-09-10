# T04b — Landing page visual identity pass

**Model:** opus for the design decisions, sonnet to execute | **Depends on:** T04 (done, PR #4)

Paste the block at the bottom of this file to start the session.

## Why this exists

T04 rebuilt the landing page's *structure* and fixed its mechanical design faults
(em-dashes, eyebrow spam, twelve corner radii, four identical zigzag rows, three-equal-cards).
It did not touch the *identity*. Hmz's read after seeing it live:

- The colours are too bright and hued. This is measurable, not taste:
  `--aristo-orange` is `hsl(25 90% 62%)`, and the `design-taste-frontend` skill puts accents
  under 80% saturation by default. The page then uses orange tints on cards, pills, icon
  chips and the closing band, so the saturation compounds.
- The uncapitalised text reads as boring and undersells the product. This is about the
  page's typography, not the logo: the two are independent.
- It should feel like "the future of education". Right now it feels like a tidy prototype page.
- He wants a dark mode, at least for the landing page.

## What is already true (do not redo)

- Structure, copy and sections are settled and pass the skill's pre-flight. Keep the anatomy
  unless you have a reason; this is a re-skin, not another rebuild.
- `shape.ts` documents the corner-radius system (pill / control 12 / surface 20 / band 28).
  Keep one system; change the values if you want, not the discipline.
- `Reveal.tsx` is the only client component. The hero is deliberately NOT wrapped in it
  (it gates LCP). Read its comments before touching it.
- Screenshots in `public/images/landing/` are real captures of `/demo` on a production build.
  If you change how the product looks, they need re-shooting.

## The three things to decide with Hmz

1. **Palette.** Desaturate the orange, or move the accent entirely. CLAUDE.md's "Vision"
   section still says pastel orange + cream; Hmz has explicitly opened that up, so update
   CLAUDE.md to match whatever is chosen. Note the constraint that actually binds: the
   product being sold is a warm cream 3D classroom, and the page has to sit next to
   screenshots of it.
2. **Typography.** Currently Geist everywhere, shared with the app through
   `src/lib/fonts.ts`. A display face for headlines is the single biggest lift available.
   The skill bans Fraunces and Instrument_Serif as defaults and discourages serif generally.
   Casing is part of this: the page is sentence case throughout and Hmz finds it flat.

   **The wordmark is a SEPARATE decision and is not a blocker here.** Restyling headings,
   changing the type scale or moving to title case does not touch the logo. (If the mark
   itself is ever changed, it is rendered in three places: `Wordmark.tsx` on the landing
   side, inline in `LearnClient` and `DemoClient`. Logistics only.)
3. **Dark mode.** `globals.css` defines `.dark` values for the shadcn tokens but **not** for
   any `--aristo-*` token, and nothing toggles the class. Doing this properly means designing
   a dark brand palette, not adding `dark:` variants. Decide whether it is landing-only or
   product-wide.

## Constraints that are not negotiable

- `src/app/page.tsx` stays a server component; client behaviour in leaves only.
- No `three` / `@react-three` imports on this page.
- Package manager is **yarn**. Run `yarn type-check`, `yarn lint`, `yarn test`, `yarn build`
  before opening the PR; CI runs all four.
- PR base is `deploy-prep`, which is also the GitHub default branch.
- If the palette changes, `/learn` and `/demo` inherit it through the same tokens. Either
  scope the change or accept it and check both.

## Suggested prompt

> Read CLAUDE.md, .claude/docs/state.md and .claude/plans/T04b-landing-visual-identity.md.
>
> Load the `design-taste-frontend` skill and the `design` skill. The landing page at
> src/app/page.tsx + src/components/landing/* was rebuilt structurally in T04 and is fine
> anatomically, but it looks like a prototype rather than the future of education. I want a
> visual identity pass: the orange is too saturated (90%), the type is flat and the
> sentence-case headings read as boring, and I want a dark mode for the landing page. The
> logo is a separate thing and is not in scope unless I say so.
>
> Audit first, then show me 2-3 genuinely different directions on a design canvas before you
> write any code. Reference DESIGN.md files live in
> `C:\Users\Pc\Desktop\Empire\CLAUDE SETUP\awesome-design-md\` — use them for how to write a
> design system down, not to copy any brand's look.
>
> Work on a branch off deploy-prep and open the PR into deploy-prep.
