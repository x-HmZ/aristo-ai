# V2 — Instant Public Demo (try the product with zero signup)

**Model:** sonnet | **Tier:** VISION | **Depends on:** T02 (asset diet) strongly — demo visitors get the cold-load
**Product thesis:** The current funnel is: land on a text page -> sign up -> sit in a manual
approval queue -> only then see the product. Nobody converts through that. The product IS the
demo — a 3D teacher giving a real lesson sells itself in 60 seconds. Put a "Try a live lesson"
button on the landing page that drops visitors straight into the classroom, no account.

## Design

1. **Route `/demo`** — same Pages Router treatment as `/learn` (`pages/demo.tsx`,
   `next/dynamic({ ssr: false })`, NO auth in getServerSideProps). Reuses AristoCanvas /
   Experience / LessonPlayer with a `demoMode` flag.
2. **Zero-LLM-cost content**: demo lessons are PRE-GENERATED and stored (JSON in
   `cached_lessons` marked `demo=true`, or a static JSON file shipped with the app — prefer
   static file: zero DB dependency, instant load). Pick 3 crowd-pleasing concepts (e.g.
   "How volcanoes erupt", "What is a black hole", "How your heart works") — generate once
   with the real pipeline including NB Pro visuals + a 3D model, then freeze: images and GLB
   downloaded into `public/demo/` so the demo never calls fal.ai or Anthropic.
3. **TTS**: pre-render the ElevenLabs audio per segment to static mp3s in `public/demo/`
   (a small script hits /api/tts once per segment at build/dev time). `useTTS` gains a
   "static source" path (given a URL, skip the fetch). Lipsync works unchanged — wawa-lipsync
   analyzes whatever the audio element plays. Result: the demo costs $0 per visitor.
4. **Demo shell UX**: picker of the 3 topics -> full lesson playback with visuals + 3D model +
   gestures. Interactive bits that need a backend (challenge eval, quiz submit) run in
   "local mode": challenge accepts any answer with an encouraging scripted response; at the
   desk-quiz moment show 2 objective questions evaluated locally (the local eval for
   MCQ/true-false already exists client-side).
5. **Conversion moments**: a persistent, unobtrusive top bar "You're in the demo — create an
   account to get your own teacher"; hard CTA at lesson end ("Aristo remembers what you
   learn. Sign up to keep your progress."), plus soft CTA when they try a gated action.
6. **Abuse surface**: no LLM/API calls exist in the demo path, so there is nothing to abuse.
   Verify: the demo page must not import or call any authed route; grep the demo bundle path
   for `/api/` usage.
7. **Landing page hook** (coordinates with T04): hero primary CTA becomes "Try a live lesson"
   -> `/demo`; "Get started" stays secondary. If T04 not yet done, patch the current hero
   buttons minimally.
8. **Approval-gate softening** (small but important): after signup, route users into the demo
   content (clearly labeled) instead of the dead-end /pending page — "while you wait for
   approval, try these" — so the queue no longer kills momentum.

## Acceptance criteria

- Cold visitor -> watching a narrated 3D lesson in < 15 s on a normal connection (measure).
- Zero Anthropic/fal/ElevenLabs calls during a demo session (verify usage_events + network tab).
- Demo -> sign-up CTA click-through works; /pending shows the demo offer.
- Works logged-out in an incognito window; `yarn build` passes; Pages Router constraint respected.

## Do NOT

- No live generation in the demo path, ever (cost + latency + abuse).
- Do not weaken auth on any existing route.

## Status checklist

- [ ] 3 demo lessons generated + frozen (assets in public/demo/)
- [ ] Pre-rendered TTS + useTTS static path
- [ ] /demo route with local-mode interactions
- [ ] CTAs + /pending softening
- [ ] $0-per-visit verified (time to first narration: ____ s)
