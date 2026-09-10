# T04 — Landing Page Rebuild

**Model:** sonnet (load the `frontend-design` skill before writing any code) | **Priority:** 9 | **Depends on:** nothing

## Context

`src/app/page.tsx` is currently a single hero + 3 emoji feature cards (~90 lines). It never
shows the product. For a product whose whole pitch is "immersive 3D teacher", that is the
biggest missed opportunity on the page. There is no how-it-works, no audience section
(parents decide, kids use), no footer, no FAQ.

Design language: pastel orange #F97B2F + cream/beige, soft glassmorphism, "not childish,
not corporate". Tokens live in `src/app/globals.css` and `tailwind.config`. shadcn/ui and
framer-motion are available. This page is App Router — server component by default, add
`"use client"` only to leaf interactive pieces.

## What to do

Rebuild `src/app/page.tsx` (splitting sections into `src/components/landing/*`) with:

1. **Hero** — keep the current copy direction but add a product visual on the right/below:
   a real screenshot of the 3D classroom. Ask the user to provide 1-3 screenshots of `/learn`
   (or capture them yourself if a dev server + signed-in session is available); store under
   `public/images/landing/`. Use Next `<Image>` with proper sizing. Frame it in a soft
   glassmorphic browser/tablet mockup.
   - Do NOT embed the actual R3F scene on the landing page (78 MB of GLBs, and R3F is
     quarantined to Pages Router). Screenshot or short muted looping video (<3 MB webm) only.
2. **How it works** — 3-4 steps with small visuals: "Pick a topic -> Your teacher explains with
   visuals and 3D models -> Answer challenges by voice -> Aristo remembers what you know and
   schedules reviews." This maps to the real 5-phase + SRS mechanics; keep the copy honest.
3. **Feature grid** — replace emoji icons with lucide-react icons (already a dependency).
   Feature set worth showing: adaptive lessons, live 3D models, voice teaching, mastery map,
   spaced-repetition reviews, progress dashboard.
4. **For parents strip** — one calm section: what data is tracked (mastery, not surveillance),
   grade range 6-8, approval-gated access.
5. **Footer** — logo, sign-in/sign-up links, contact mailto, room for legal links later.
6. Motion: subtle scroll-reveal via framer-motion or `react-intersection-observer` (already
   installed); respect `prefers-reduced-motion`.
7. Responsive at 360 px, 768 px, 1280 px. Lighthouse performance of this page should stay >90 —
   it must remain light (no 3D, no heavy media).

## Acceptance criteria

- Page shows the actual product visually within the first viewport.
- All sections above present; copy grade-appropriate and honest (no fake testimonials,
  no invented user counts).
- `yarn build` passes; page is a server component shell with client leaves only where needed.
- Mobile layout verified.

## Do NOT

- No fabricated social proof, logos, or press mentions.
- No R3F/three imports on this page.
- Do not change auth pages or `/learn`.

## Status checklist

- [x] Screenshots/video sourced — three stills captured from a production build of `/demo`
      (volcano lesson, generated black-hole model, desk quiz) into `public/images/landing/`
- [x] Sections built (hero, how-it-works, features, parents, footer) — plus a capability
      strip and a closing CTA, in `src/components/landing/`
- [x] Responsive + reduced-motion verified — no horizontal overflow at 360 / 768 / 1024 /
      1280 / 1440; reveal is a CSS transition disabled by a `prefers-reduced-motion` query
- [x] Build passes — type-check, lint, test (83/83) and build all green; `/` first-load JS
      120 kB, statically prerendered

## Outcome (2026-09-09)

Built on `dev/t04-landing-page`. Design canvas reviewed before any code was written:
https://claude.ai/code/artifact/d0d76f20-e5f9-4051-8ee3-ea36eb68a1d5

Still open, deliberately: no FAQ section (offered, not asked for), and `LEGAL_LINKS` in
`SiteFooter.tsx` is an empty array so the privacy/terms row renders nothing until those
routes exist.
