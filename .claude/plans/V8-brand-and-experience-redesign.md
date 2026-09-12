# V8 — Brand and experience redesign ("the future of teaching")

**Model:** see `V8-V9-estimates-models-tooling.md` per sub-task (Opus 5 decides, Sonnet 5 builds)
**Depends on:** T04b (merged), the hex-to-token refactor (task "Replace hardcoded classroom
orange with tokens", started 2026-09-11). **Runs in parallel with:** V9 (new teacher avatar).
**Written:** 2026-09-11, from a brand critique of the T04b landing page.

This is a multi-session programme, not one task. Each `V8.x` below is self-contained: a
fresh session can pick up one sub-task, read this file plus `CLAUDE.md`, and execute it.

## The goal

Aristo should look and feel like a brand about **the future of teaching**, across the whole
product, not only the landing page. Hmz has approved a **complete visual redesign** to get
there, with one hard boundary: **no change to underlying functionality**. APIs, agents, the
lesson schema, store shape, BKT/FSRS, auth and the approval gate are untouched. Everything in
this plan is presentation: layout, visual design, copy, motion, 3D art direction and brand.

## Why (the critique, condensed)

T04b fixed the paint (contrast, saturation, type, dark mode) but not the story. Measured
against the `design-taste-frontend` skill, the page passes every mechanical check and fails
the one that matters: it looks templated. The weaknesses, most important first:

1. **No story.** "Aristo" points at Aristotle, the private tutor of Alexander the Great, and
   there is a well-known research idea behind one-to-one tutoring (Bloom's "2 sigma problem",
   1984). The positioning writes itself: *the tutor only princes used to get, for every kid.*
   Later studies find smaller effects than two sigma, so use it as the idea, never as a stat.
2. **The teacher is shown as a still inside fake browser chrome**, the way every SaaS shows
   a dashboard. The one asset nobody else has (a 3D teacher who talks, points and draws) is
   silent and static on the page.
3. **The method is buried.** Activate, Explain, Demonstrate, Challenge, Connect is Aristo's
   actual pedagogy; on the page it is five small pills.
4. **The brain is invisible.** Knowledge graph, mastery and spaced review appear as a bento
   cell with an icon.
5. **The ✦ mark** is the universal "AI feature" glyph (Gemini, a thousand generate buttons).
   It signals commodity AI, not teaching.
6. **The product UI caps the brand.** Screenshots show a dense text panel, a teal
   "3 · DEMONSTRATE" chip clashing with the orange, "seg 9 / 15" debug labels and small
   orange pills. It reads as a prototype however good the page around it is.
7. **The room is nostalgic.** Lockers, wall clock, chalkboard: a 20th-century classroom
   rebuilt in 3D. Comforting, not the future.
8. **Copy defines Aristo by negation** ("not like a search box", "not a picture of it",
   "a map, not a playlist"). Defensive. Future-facing brands assert.
9. **Wide capitals everywhere** borrow from EV and esports branding and shout at parents.
10. **The teacher's look** (a realistic adult in a black suit and tie) reads formal and a
    little uncanny for 11 to 14 year olds. This is its own programme: see V9.

What to keep: the dark "classroom is the lit window" idea, orange used as a spark and not a
fill, honest copy (the parents section admits lessons are AI-generated and can be wrong), and
no fabricated proof.

## Guardrails for every V8 sub-task

- **No functional change.** If a task seems to need one (new store field, new API, lesson
  schema change), stop and ask Hmz. Diffs in `src/lib/`, `src/app/api/`, `src/hooks/` and
  `src/store/` should be empty unless a sub-task explicitly allows a presentational helper.
- **`CLAUDE.md` constraints stand:** `/learn` stays in the Pages Router; three / R3F / drei
  versions are pinned; model IDs only in `src/lib/agents/models.ts`; yarn only.
- **Landing stays a server component** with client leaves only; no `three` / `@react-three`
  import on `/`.
- **Honesty:** no testimonials, user counts, logos or statistics that are not real. Anything
  illustrative is labelled as an example. The Bloom idea is cited as an idea, not a number.
- **Spend:** $0 by default. No fal generations without Hmz's explicit go-ahead (he prefers
  desk research over test generations). ElevenLabs has roughly 2,879 credits left: reuse the
  pre-rendered demo audio in `public/demo/*`; do not generate new narration for marketing.
- **Accessibility:** WCAG AA on every text/background pair (record ratios), 44px targets,
  captions on any speaking video, audio is always opt-in, `prefers-reduced-motion` honoured
  (video shows its poster, pinned scroll becomes a plain stack).
- **Performance budgets:** `/` first-load JS ≤ 135 kB and still statically prerendered;
  LCP element is an image poster (never a video, never behind a reveal); hero video ≤ 2.5 MB
  per format; `/learn` cold load must not regress (measure before and after).
- **Gates before any PR:** `yarn type-check`, `yarn lint`, `yarn test`, `yarn build`, plus
  before/after screenshots of every surface touched, in both themes, at 360 / 768 / 1280.
- **Git:** branch per sub-task off `deploy-prep` (`dev/v8-<n>-<slug>`), PR into
  `deploy-prep` (merging deploys to production). Small atomic commits, no AI attribution.
- **Docs:** update `.claude/docs/state.md` at the end; record decisions in
  `.claude/docs/decisions.md`; keep the brand system doc current (V8.2 creates it).

## Sequence (revised 2026-09-12: the avatar comes first)

```
V8.0 + V8.0b + V9.0 (one wave: brand direction, THE NAME, teacher look)
   -> V9.1 bake-off -> V9.2 library -> V9.3 director -> V9.4 face
        (in parallel, after the token refactor) V8.2 design system v2
   -> V8.5 room + V9.5 integration      (the scene is finished here)
   -> V8.4a/b/c classroom UI + V8.1 brand copy and mark
   -> V8.3 landing v3   (hero video captured ONCE, from the finished scene)
   -> V8.6 app pages -> V8.7 cleanup and assets
```

**This supersedes the earlier ordering.** The landing hero is the teacher in motion, so
building the landing before the teacher and the room means capturing the footage twice. The
only thing that must precede the avatar is the look decision, because the teacher is the
brand. Full wave table in `V8-V9-estimates-models-tooling.md`.

---

## V8.0 — Direction lock (design canvas, no code)

**Model:** Opus 5 start to finish (`/model opus`). Taste work: judgement per token is what matters and there is no code to write. Do NOT use Fable here; it is priced for hard reasoning, not taste, and thinks longer for no gain.

**Goal:** settle the big creative decisions visually with Hmz before anything is built.
**Run this together with V9.0** (the teacher's look): they are one decision, and the teacher
is the brand's main asset. Confirm the $0 animation strategy from V9 in the same session.

Load the `design-taste-frontend` and `design` skills. Produce one canvas with pages for:

1. **Positioning line** (3 options, including the Aristotle/"every kid" line) set as real
   hero type, not a list.
2. **Mark** (3 or 4 explorations replacing ✦): typographic and symbolic. The mark should mean
   *teacher* or *learning*, not *model*. Show each at favicon size, in the nav, and over the
   dark and light themes. Candidate ideas to explore, not prescriptions: a pointer/cursor
   meeting a line (the teacher pointing at the board), the five-phase arc, a lit doorway.
3. **Landing narrative** as low-fi wireframes: Hero (living teacher) → The idea → One lesson
   in five phases → The map → For parents → Close. Two layout variants for the five-phase
   section (pinned scroll vs. horizontal chapters).
4. **Classroom UI** (the lesson panel over the 3D scene): 2 directions, e.g. "caption-first
   dark glass" vs. "docked transcript rail". Hi-fi enough to judge the feel.
5. **Casing and type**: keep Archivo wide capitals for the hero and closing line only, and
   mixed case for section headings. Show both on the same headings so Hmz can compare.

Close with Hmz's picks recorded in `.claude/docs/decisions.md`. Keep option names stable
across turns. No code changes in this sub-task.

**Acceptance:** Hmz has chosen a positioning line, a mark direction, a narrative layout, a
classroom UI direction and the casing rule; all recorded.

## V8.0b — The name (decide before anything carries it)

**Model:** Opus 5 for candidates and judgement; Sonnet 5 for the screening legwork.

**Why now.** Hmz opened this on 2026-09-12: "Aristo" is crowded, with several unrelated
products already using it. The name is the single most expensive thing to change late, because
it is stamped into the mark, the copy, the domain, the screenshots and the deployed URL. Decide
it in wave 1, before V8.1 draws a mark and writes copy around it.

**Keep or change is a real option.** A crowded name is survivable if the mark and the story are
distinctive. Changing costs a sweep; keeping costs discoverability. Put both on the table.

1. **Generate 25 to 30 candidates** across different naming families, not 30 variations of one:
   classical or mythological (the current family), invented and phonetic, plain-language
   (what it does), metaphor (a place, a light, a doorway, a map), and a person's name. Avoid a
   second Greek-philosopher cliche unless it is genuinely better than the alternatives.
2. **Screen the shortlist mechanically** and record results in a table: exact-match domain
   (.com and .ai) availability, app-store collisions, GitHub and social handle availability,
   and a quick free trademark look in the classes that matter (roughly class 9 for software,
   class 41 for education services) on the USPTO and EUIPO public search pages. **This is a
   screen, not legal advice:** anything that survives should get a professional clearance
   search before Hmz files or prints anything.
3. **Shortlist 5** and set each as a real wordmark, in the chosen display face, next to the
   mark explorations from V8.1, on the canvas. A name has to be judged set, not in a list.
4. **Hmz picks**, and the decision is recorded in `decisions.md` with the runners-up and why.

**If the name changes, the rename splits in two:**

- **User-visible (must happen with the rename, in V8.1):** the wordmark and the three places it
  renders, page titles and metadata, OG image, email from-address and templates, in-app copy,
  the domain and the Vercel project, the GitHub repo name, `package.json` name.
- **Code identifiers (cosmetic, defer to a Haiku sweep after the dust settles):**
  `useAristoStore`, the `--aristo-*` CSS tokens, the `aristo-*` Tailwind colours,
  `.aristo-scroll`, the `aristo-landing-theme` storage key, component and directory names,
  `AI_TEACHER_APP_SPEC.md` references. None of this is user-visible; doing it in one pass later
  is cheaper and safer than threading it through the redesign.

**Do not** rename the Supabase project reference, storage buckets, or any database identifier:
that is a migration, not a rebrand, and nothing user-facing depends on it.

**Acceptance:** a decision (keep or change) recorded with its screening table; if changed, the
user-visible list above has an owner and lands inside V8.1.

## V8.1 — Brand foundation: story, voice, copy, mark

**Model:** **Opus 5** for the messaging doc and the mark, then **Sonnet 5** (`/model sonnet`) once the words are settled and the job becomes "apply these strings in these files".

**Goal:** the words and the mark, applied everywhere they appear.

1. Write `.claude/docs/brand/messaging.md`: positioning line, a 50-word and a 150-word
   description, three brand pillars, voice rules (assertive, specific, warm; no negations as
   headlines; no filler verbs; no em-dashes in rendered copy), words to avoid, and the honesty
   rules above. Use the `brand-voice` skill from the reference library if it helps
   (`C:\Users\Pc\Desktop\Empire\CLAUDE SETUP\everything-claude-code\skills\brand-voice`).
2. Rewrite every rendered string on the landing page to the new voice. Section headlines
   become assertions about the learner.
3. Fix root metadata in `src/app/layout.tsx`. Today it has an em-dash in the title, says the
   teacher "adapts to your style" (learning styles were explicitly rejected; see CLAUDE.md
   "FSLSM rejected"), and points `openGraph.url` at `aristo.vercel.app` instead of the real
   deployment. Add a real `opengraph-image` (Next `ImageResponse`), favicon and app icons
   from the new mark.
4. Implement the chosen mark as an SVG component. It renders in exactly three places today:
   `src/components/landing/Wordmark.tsx`, inline in `src/components/learn/LearnClient.tsx`,
   and inline in `src/components/demo/DemoClient.tsx`. Make all three use one component.
5. Sweep in-app microcopy (buttons, empty states, loading lines) for the same voice, without
   changing behaviour.

**Acceptance:** zero ✦ glyphs in the codebase; metadata correct and honest; the messaging
doc exists; every landing string passes the copy self-audit in `design-taste-frontend` §4.9.

## V8.2 — Design system v2 (product-wide)

**Model:** **`/model opusplan`**: Opus plans the token structure and theme migration, Sonnet edits. The risk here is a missed surface, not hard reasoning, so Fable is not worth 2x.

**Goal:** one brand system for the whole app, promoted from the landing page's scoped
`--lp-*` tokens. **Wait until the hex-to-token refactor has merged:** it moves the ~87
hardcoded `#F97B2F` values (plus the browns, creams and the stray `#10B981` teal, `#8B5CF6`
purple and `#3B82F6` blue) onto tokens, which is what makes this sub-task a token edit
instead of a sweep.

1. Define semantic tokens app-wide in `globals.css` + `tailwind.config.js`: `bg`, `surface`,
   `sunk`, `ink`, `body`, `muted`, `line`, `accent`, `accent-ink`, `accent-text`, `tint`,
   `success`, `warning`, `danger`, `info`, each with light and dark values and recorded
   contrast. One accent. The five lesson phases get identity from numbering, iconography and
   position, not five colours.
2. Promote the theme mechanism from landing-only to app-wide: `data-landing-theme` →
   `data-theme`, keeping the old localStorage key readable once for existing visitors.
   Default follows the OS; the toggle overrides. The 3D scene lighting does not change with
   the theme (the room is the lit window in both).
3. Restyle `src/components/ui/*` (shadcn) to the system: radii from `shape.ts` (promote it
   to `src/lib/design/shape.ts`), focus rings, control heights, press feedback, elevation.
   Use the `vercel:shadcn` skill.
4. Add motion tokens (durations, easings) and a type scale (display / h1 to h4 / body /
   caption / mono) as CSS variables and Tailwind utilities.
5. Write `.claude/docs/brand-system.md` (supersedes `landing-design-system.md`; keep that
   file as a pointer). Follow the structure of the reference DESIGN.md files in
   `C:\Users\Pc\Desktop\Empire\CLAUDE SETUP\awesome-design-md\design-md\` (overview, colours,
   typography, layout, elevation, components, responsive).

**Acceptance:** no hex literals left in components except documented 3D-material constants;
every surface renders correctly in both themes; the brand-system doc exists.

## V8.3 — Landing v3: the teacher alive, the method as the story

**Model:** **`/model opusplan`**. One exception: if the capture and encoding pipeline fights back for more than a couple of rounds (codec, determinism, LCP), give that sub-problem one scoped **Fable 5.1** session.

**Goal:** rebuild `/` around the narrative chosen in V8.0. Structure (adjust to V8.0's
picks): **Hero → The idea → One lesson, five phases → The map → For parents → Close → Footer.**

1. **Hero: the teacher, alive.** Full-bleed, no fake browser chrome. A muted, looping 8 to 12
   second clip of the teacher teaching, captured from `/demo` on a production build.
   - Poster = a still frame served through `next/image priority`: that is the LCP element.
   - `<video autoplay muted loop playsinline>` loads after first paint; WebM (VP9 or AV1)
     plus MP4 (H.264) for Safari; ≤ 2.5 MB each; 1280px wide.
   - Captions from the demo's alignment sidecars (`public/demo/<topic>/<seg>.align.json`
     carry exact character timings). Generate WebVTT from them; do not hand-time captions.
   - An opt-in "Hear it" button plays the matching pre-rendered demo mp3 with captions
     highlighted in sync. Never autoplay sound. Zero new TTS spend.
   - Reduced motion: poster only.
   - **Capture pipeline** (new `scripts/capture-demo-video.mjs`): drive `/demo` headlessly,
     record the R3F canvas via `canvas.captureStream()` + `MediaRecorder`, or CDP screencast
     frames, then encode with ffmpeg. **ffmpeg is not installed on this machine**; ask Hmz to
     run `winget install Gyan.FFmpeg` first. Make the script deterministic (fixed viewport,
     fixed topic and segment, fixed camera) so V8.7 can re-run it after V9.
2. **The idea.** One short section carrying the positioning story (Aristotle, one-to-one
   tutoring for everyone). Editorial layout, one image or none.
3. **One lesson, five phases.** The teacher and scene stay pinned while the five phases
   scroll past: Activate, Explain, Demonstrate, Challenge, Connect, each with a short caption
   and a captured clip or still from the same demo lesson. The demo data already tags every
   segment with its phase (`src/data/demo/heart.ts`, `volcano-eruption.ts`). Implement with
   CSS `position: sticky` + IntersectionObserver in one client leaf; no GSAP, no new
   dependency. Mobile and reduced motion: a plain vertical stack.
4. **The map.** A real knowledge-graph subgraph rendered as a static SVG with precomputed
   layout. New `scripts/snapshot-kg.ts` reads one real course's concepts and prerequisites
   (Supabase, service role, run locally only; never ship the key) into
   `src/data/landing/kg-snapshot.json`. Nodes show illustrative mastery states, and the
   section says in plain words that the states are an example learner. Hover and focus
   reveal concept names. Load the `dataviz` skill. Run `security-review` because the script
   touches the service-role key.
5. **For parents** keeps its honest content in the new voice. **Close** keeps one CTA.
6. Keep in-page anchors working from the nav. The five-step "How it works", the capability
   strip and the bento grid are replaced by sections 3 and 4.

**Acceptance:** budgets above met (`/` static, ≤ 135 kB first-load JS, LCP on the poster);
no horizontal overflow at 360 / 768 / 1024 / 1280 / 1440; captions verified against audio;
reduced-motion path verified; `design-taste-frontend` pre-flight passes.

## V8.4 — Classroom UI redesign (`/learn` and `/demo` chrome)

**Model:** **V8.4a `/model opusplan`** (the panel needs a layout decision first). **V8.4b and V8.4c `/model sonnet`**: the design is settled by then and the work is markup. Never Fable; this is the cheapest work to verify by eye.

**Goal:** the lesson experience looks like the future, not a prototype. Presentation only:
props, store reads and handlers stay as they are; diffs should be markup and classes.

Direction from V8.0. Default brief: the 3D room is the lit stage; the UI is quiet ink glass
around it; the current sentence is the hero of the panel.

Split into three sessions:

- **V8.4a Lesson panel and controls.** `LessonView.tsx` (810 lines), `LessonPlayer.tsx`,
  `TeacherControls.tsx`, `MessagePanel.tsx`, `Callouts.tsx`. Caption-first: current sentence
  large, next line dimmed, full transcript in a drawer. A five-phase rail as a brand element.
  Replace the teal phase chip with the system's phase label. Hide `seg N / M` and similar
  debug labels behind a dev flag. "View in 3D" and "Show image" become the system's
  secondary control.
- **V8.4b Quiz and answers.** `src/components/quiz/QuizView.tsx` (719 lines), the desk quiz
  card rendered by `src/components/three/DeskQuiz.tsx` (restyle the HTML card only; do not
  touch probed desk anchors or camera constants), `AnswerInputPanel.tsx`, `InputBox.tsx`.
- **V8.4c Free mode, pickers, loading.** `FreeTopicCard.tsx`, `ModePicker.tsx`,
  `LoadingScreenVisual.tsx`, `SceneLoadingOverlay.tsx`, the demo banner in `DemoClient.tsx`.

Verification uses public routes: `/demo`, `/dev/desk-quiz`, `/dev/free-model`. Capture
before/after for each state (idle, narrating, pointing at an image, 3D model shown, quiz on
the desk, answer panel open, free mode, loading) in both themes.

**Acceptance:** every state restyled; no behavioural diff (walk the full demo lesson and a
free-mode question end to end); `/learn` cold load not regressed.

## V8.5 — Environment art direction (the room)

**Model:** **Opus 5** for art direction and the anchor contract. **Fable 5.1 is justified** for the single session that reconciles a new room against the probed anchors and camera framings if Opus cannot make them agree: constraint-solving in 3D with an expensive failure mode. Blender execution afterwards is **Sonnet 5**.

**Goal:** the room reads as a future learning studio, warm and minimal, instead of a
20th-century classroom. Visual only. **This overrides T08's "do not replace the
environment"**; record the decision. T08's topic-reactive ideas (live blackboard, ambient
life) remain valid later work on top of the new room.

1. **Anchor contract first.** Before changing anything, list every coordinate the code
   depends on: teacher position, `SCENE_*` / `MODEL_*` anchors (shared since 2026-09-10), the
   image-board plane, the probed desk plane for the quiz, camera framings in
   `CameraController.tsx`. The new room must satisfy all of them, or the constants change in
   a reviewed commit with a `/dev` probe screenshot.
2. **Cheapest first:** restyle the existing `classroom_default.glb` in Blender (materials,
   palette, lighting, remove lockers and wall clock, replace the chalkboard with a large
   display surface). Only if that cannot reach the bar, build a new environment from CC0
   sources (Poly Haven through the Blender MCP), then CC-BY with attribution recorded in
   `public/models/LICENSES.md`. No paid assets; generated geometry only with Hmz's approval.
3. **Budget:** ≤ 2 MB compressed (Draco, as T02 established); draw calls not above today's.

**Acceptance:** before/after renders from every camera framing; all anchors verified with
the `/dev/desk-quiz` and `/dev/free-model` probes; fps within 10% of baseline.

## V8.6 — The rest of the app

**Model:** **Sonnet 5**, with **Haiku 4.5** (`/model haiku`) for the admin token pass, which is find-and-replace plus screenshots.

**Goal:** sign-up to dashboard feels like the same brand. Pages: `/sign-in`, `/sign-up`,
`/pending`, `/create-teacher`, the onboarding view (`src/components/onboarding/`), and the
learner views (`DashboardView.tsx`, `CourseMapView.tsx`, `CourseFlow.tsx`, `ReviewView.tsx`).
Presentation only. Admin (`/admin/*`) gets the token pass from V8.2 and nothing more; it is
internal.

**Acceptance:** every page in both themes at 360 / 768 / 1280; no flow change (walk sign-up
→ pending → onboarding → learn with a test account Hmz provides, or review screenshots with him).

## V8.7 — Re-capture, assets, cleanup (last)

**Model:** **Sonnet 5** for captures; **Haiku 4.5** for dead-code removal once Hmz has confirmed it is dead.

After V8.4, V8.5 and V9 have merged:

1. Re-run `scripts/capture-demo-video.mjs` and re-shoot every still in
   `public/images/landing/` on a production build. Clear `.next/cache/images` and use a
   fresh browser profile: on 2026-09-11 a headless capture showed a stale cached image.
2. Final OG image and social assets from the new captures.
3. Remove dead legacy components after confirming with Hmz: `src/components/{Hero,Navbar,
   Team,WhyAristo,GuideToAristo,Footer}` (old JSX landing, imported nowhere; `/aristo` now
   only redirects to `/learn`).
4. Update `CLAUDE.md` (Vision section), `brand-system.md`, `state.md`, and tick this file.

## Model discipline (keeping this cheap without losing quality)

Per-phase choices are stated above. The rules behind them:

1. **Match the model to the failure mode.** Taste work is verified by looking, so use Opus and
   judge the output. Reasoning whose mistakes surface much later (a retarget pipeline, an
   anchor contract) is where a stronger model pays for itself.
2. **Fable 5.1 is 2x Opus 5 ($10/$50 against $5/$25) and always thinks**, so it is reserved for
   V9.2, and as an escalation in V9.1, V8.5 and V8.3's capture pipeline. Nowhere else.
3. **Split the session at the design/grind seam.** Let the expensive model produce the plan or
   crack the hard case, then switch to Sonnet and execute in the same session. Switching mid
   session costs one cache write (about $1 on a 100k context), far less than running the
   expensive model through an hour of mechanical edits.
4. **Escalate on evidence, not nerves.** If a session stalls twice on the same problem, switch
   up. Starting everything on the biggest model grows the bill without moving the quality.
5. **Haiku 4.5 for mechanical passes only** (token sweeps, confirmed dead-code removal, doc
   ticks), never for anything judged by eye.
6. **One sub-task per session.** Cost scales with how much context is re-read each turn, so a
   long wandering session costs more than two focused ones. Write decisions into the brief so
   the next session reads a conclusion instead of re-deriving it.
7. **Send wide searches to subagents** (Explore or general-purpose): they burn their own
   context instead of growing the main session's.
9. **A session cannot change its own model.** Where a phase says "then switch", the session
   must stop and say so in plain words; the human switches. See `MODEL-SWITCHING.md`.
8. **Setting the model:** in the desktop app use the model picker; in a terminal session use
   `/model opus`, `/model sonnet`, `/model haiku`, `/model opusplan`. If no short alias for Fable is offered,
   pick `claude-fable-5-1` from the picker.

## Status checklist

- [ ] V8.0 direction lock (positioning, mark, narrative, classroom UI, casing)
- [ ] V8.0b name decision (keep or change, screened and recorded)
- [ ] V8.1 brand foundation (messaging doc, copy, metadata, mark in 3 places)
- [ ] V8.2 design system v2 (after the token refactor merges)
- [ ] V8.3 landing v3 (hero video pipeline, five-phase story, KG map)
- [ ] V8.4a lesson panel and controls
- [ ] V8.4b quiz and answers
- [ ] V8.4c free mode, pickers, loading
- [ ] V8.5 environment art direction
- [ ] V8.6 app pages
- [ ] V8.7 re-capture, assets, cleanup
