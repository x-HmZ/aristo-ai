# Landing page design system: "Night Class" (superseded)

Superseded on 2026-09-29 by **`.claude/docs/brand-system.md`** (V8.2), which promoted these tokens app-wide.

Night Class was chosen by Hmz on 2026-09-11 (T04b) from three directions on the design canvas
(https://claude.ai/code/artifact/faee56f8-fe76-499b-9ee2-4e19f5fcf3dc). What moved:

- The `--lp-*` tokens are now the semantic tokens with the same values (`lp-bg` became `bg`, `lp-accent`
  became `accent`, and so on).
- `data-landing-theme` / `aristo-landing-theme` became `data-theme` / `aristo-theme`.
- `.lp-display` became `.display-wide`, `.lp-shadow(-lg)` became `shadow-e1` / `shadow-e2`, and `.lp-glow-*`
  became `.glow-*`.
- `src/components/landing/shape.ts` became `src/lib/design/shape.ts`.

The landing looks the same as it did before the move.
