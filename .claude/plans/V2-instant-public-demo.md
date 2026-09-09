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

- [x] 2 demo lessons generated + frozen (assets in public/demo/) — "How Volcanoes Erupt" +
      "What Is a Black Hole" (3 lessons cut to 2 per the executing brief's cost/quota
      adjustment). Generated via the real pipeline (generateLesson + generateInfographic +
      generate3dSourceImage/generate3dModel), frozen into src/data/demo/*.ts. Actual spend:
      $0.73 (usage_events: teach.lesson + retry $0.38, segment visuals $0.20, FLUX+TripoSR
      $0.15). Script kept at scripts/generate-demo-content.ts for regeneration.
- [x] TTS **(revised 2026-09-08 — superseded the decision below)**: narration is now 30
      pre-rendered ElevenLabs mp3s in `public/demo/<slug>/`, generated once by
      `scripts/prerender-demo-tts.mjs` (7,029 chars total, inside the 10,000/month free tier,
      $0 per visitor thereafter). Driven through a new `srcUrl` option on `useTTS`.
      The deciding factor was not voice quality: `window.speechSynthesis` exposes no audio
      buffer, so wawa-lipsync had nothing to analyse and the teacher narrated with a
      motionless mouth — on the one page whose job is to show a talking 3D teacher. Also
      forced the demo avatar to `marcus`: ryan carries 0 viseme morphs, so lipsync was
      impossible on him regardless of the audio path. Verified in-browser, still 0 `/api/`
      requests. Original decision, kept for the record:
- [x] TTS: ElevenLabs quota could not be checked (API key lacks `user_read` permission —
      GET /v1/user/subscription and /v1/user both 401 "missing_permissions"). Per the
      executing brief's fallback rule, treated unknown quota as insufficient and shipped
      the runtime browser speechSynthesis path instead of pre-rendering ElevenLabs mp3s.
      Implemented as a scoped `forceBrowser` option on useTTS (demoMode only — /learn is
      unaffected) rather than the global NEXT_PUBLIC_TTS=browser env var, so this never
      touches the production ElevenLabs-backed teacher.
- [x] /demo route with local-mode interactions — pages/demo.tsx (Pages Router, ssr:false,
      no getServerSideProps auth), DemoClient.tsx (leaner than LearnClient — reuses
      AristoCanvas/Experience/LessonPlayer directly, skips useCourseAutoTeach/session-flush/
      profile-hydration). Store gained `demoMode` flag threaded through useLessonPlayback,
      useTTS, Experience.tsx (View-in-3D), DeskQuiz/QuizView (localOnly eval via new
      src/lib/quiz/localEval.ts) — every fetch on the playback path is gated off in
      demoMode. Verified via Puppeteer: 0 `/api/` requests across topic pick → full 5-phase
      narration → challenge answer → desk quiz (both questions) → results screen, for both
      topics, including the "View in 3D" GLB swap.
- [x] CTAs + /pending softening — landing hero primary CTA is now "Try a live lesson" → /demo,
      secondary "Get started" → /sign-up; persistent top-bar demo pill + hard CTA at lesson/
      quiz-result end ("Create your free account"); /pending shows a "try a live demo lesson"
      offer link for users stuck in the approval queue.
- [x] $0-per-visit verified — Puppeteer network-resource audit across the full flow
      (both topics, including 3D toggle) shows 0 requests to `/api/`; the only non-`localhost`
      resource was drei's pre-existing studio HDRI (raw.githack.com, unrelated to this task).
      Time to first narration: scene interactive near-instantly on local dev; narration start
      after topic click measured at ~49 ms (warm cache) with zero network round-trip — well
      under the <15s cold-visitor target (informal local-dev measurement; not a throttled
      cold-cache production measurement).
