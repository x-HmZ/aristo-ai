# Aristo AI — Current State & Next Steps

_Update this at the end of every significant session: done / next / blockers, compact._

## 2026-09-11 — T04b landing visual identity ("Night Class")

Branch `dev/t04b-visual-identity` off `deploy-prep`, PR into `deploy-prep`.

- **Audit first, measured.** The shipped primary button put cream text on `#F59047` at
  **2.2:1**, failing WCAG AA. That token rendered at 90% saturation while its comment claimed
  `#F97B2F`. Orange carried every job on the page (gradient headline, glow shadows, two
  blobs, tinted cells, 9 icon chips, pills, a full-orange band). The hero headline ran to 3
  lines at 1440. No `--aristo-*` token had a dark value.
- **Three directions on a canvas** (https://claude.ai/code/artifact/faee56f8-fe76-499b-9ee2-4e19f5fcf3dc):
  A Ember (keep orange, calmer), B Night Class (dark-first), C Cobalt (move the accent). Hmz
  picked **B**, **landing-only scope**, **follow the OS with a toggle**.
- **Scoped, not global:** `--lp-*` tokens under `.landing`. `/learn` + `/demo` hardcode
  `#F97B2F` ~87 times, so global tokens would have half-migrated the app. The system is
  written down in `.claude/docs/landing-design-system.md`.
- **Theme:** stored choice mirrored to `html[data-landing-theme]` by an inline pre-paint
  script; otherwise `prefers-color-scheme`. Choosing the OS's own mode clears the choice.
  Toggle in the nav at sm+, in the footer below sm (at 360px it wrapped the nav actions).
- **Type:** Archivo `wdth` 125 caps for display only, loaded from a landing-only module so it
  never preloads on `/learn`. Headline measured to 2 lines at lg/xl.
- **Gates:** type-check, lint (same 22 pre-existing warnings, none in landing), tests 85/85,
  build. `/` still static, first-load JS 120 -> 122 kB (the toggle). Checked on a production
  build in both themes; no horizontal overflow at 360/768/1024/1280/1440.
- **Red herring worth knowing:** a local capture showed the old black-hole shot in step 3.
  The server was sending the committed heart byte-for-byte; the headless browser had cached
  the old `/_next/image` response from an earlier session on the same port.

### Open

- Product-wide migration of the palette (a sweep of the ~87 hardcoded hex values) is its own task.
- The wordmark was not touched. Whether it should change now the page around it has is Hmz's call.
- Screenshots did not need re-shooting: the product did not change.

## 2026-09-10 (later) — heart demo topic, three playback bugs, PR #4 merged

- **Black holes retired, heart added, $0 of fal spend.** A black hole is light, not a
  surface: rendered through the app's own loader stack its model measured
  `0.08 x 0.85 x 1.00`, a paper-thin sliver. The heart's model and labelled teaching image
  were already paid for by the 2026-09-09 eval and were sitting in `public/demo/heart/`
  (I had wrongly reported that model as lost, having checked only the persistent cache and
  the tracked GLBs). `scripts/generate-demo-heart.ts` makes **zero fal calls**.
- **No segment visuals were generated either.** `useLessonPlayback` holds the last visible
  image when a segment supplies none, so one teaching image on `seg_005` carries the whole
  lesson. Adding real segment visuals later is ~$0.08 each and does not touch narration.
- **3,321 ElevenLabs characters**, taken from the script's `--dry-run` before spending, not
  estimated after. Alignment sidecars cost **zero** TTS credits: forced alignment bills as
  speech-to-text, and the `forced_alignment` key permission now works.

### Three bugs, all found by playing it rather than by testing

1. **Demo audio is addressed by `concept_id`, not by slug.** `useLessonPlayback` resolves
   `/demo/<lesson.concept_id>/<segment>.mp3`, so the concept id names the asset folder. The
   original two topics satisfied `slug === concept_id` by coincidence, which hid the coupling
   until a topic arrived with concept id `human-heart` and folder `heart`. Every mp3 404d, so
   every segment "ended" instantly and playback raced to segment 15 *during the loading
   screen* — which presents as "the lesson starts halfway through". `src/data/demo/index.ts`
   now asserts the invariant at module load, and the generator derives the id from `SLUG`.
2. **Missing alignment sidecars degrade lipsync silently.** 15 mp3s and 0 `.align.json` meant
   the heart fell back to the FFT guess while the volcano used real character timings. Both
   topics now have 15/15.
3. **The 3D model sat at a stale anchor.** `SCENE_*` was moved to head height so pointing
   gestures land on the diagram; `MODEL_*` was left at the old `(1.1, -0.4)` behind a comment
   arguing head height would crowd the avatar's face, while the comment above `SCENE_*` still
   claimed both shared the anchor. They share it again.

### Landing page

The last stale asset is replaced: `classroom-3d-model.webp` is now Hmz's own capture of the
heart at the shared anchor. It was cropped from the left rather than squashed, because the
source frame was 1.96:1 against the 1.78:1 the other two shots use and a mismatched intrinsic
aspect makes `next/image` reserve the wrong space.

**PR #4 merged into `deploy-prep`** with both checks green, which deploys to production.

### Still open

- **T04b visual identity** (`.claude/plans/T04b-landing-visual-identity.md`) — its own
  session. Palette at 90% saturation, flat typography, no dark mode. Note the brief was
  corrected: the wordmark is NOT a blocker on the typography work, they are independent.
- **Multiview pricing is the one unpinned row** in `pricing.ts`, because fal reports that
  endpoint in credits rather than per generation. Reconcile against the dashboard after the
  first real production run.
- Optional, ~$0.16: two real segment visuals for the heart if one static board across fifteen
  segments reads thin next to the volcano's two.
- ElevenLabs: ~2,879 credits left after this session.

## 2026-09-10 — 3D root-caused and fixed, landing rebuilt twice

Continues the T04 branch (`dev/t04-landing-page`, PR #4 into `deploy-prep`).

**The demo 3D models were bad for a reason nobody had measured.** Not the mesh, not the
generator: **texture coverage**. Tripo's single-image path paints only the surface its one
source view can see and fills the rest with flat pale grey. Unpacking the volcano's albedo
atlas showed roughly half of it as featureless filler, and under the classroom's
`<Environment preset="studio">` a large pale surface at roughness 0.37 reads as chrome. The
metalness theory was tested and rejected (measured 0.011).

`scripts/eval-multiview-3d.mjs` proved the fix for $0.67: one strong three-quarter front view
(nano-banana-pro), three rotations of it by *editing* that view (flux-pro/kontext), then
`tripo3d/tripo/v2.5/multiview-to-3d` at texture HD. Editing rather than regenerating is what
keeps the four inputs the same object. The new atlas carries basalt across the whole surface.
The volcano in `/demo` is that model: **658 KB**, against 1.65 MB single-view and 4.0 MB for
the TripoSR original. Better and smaller each time.

Wired into production behind a per-topic decision: the teaching agent now returns
`model_needs_multiview`, reasoning about whether the sides and back differ meaningfully from
the front. Four views cost ~$0.67 against $0.303, so a planet does not pay the price of a
heart. `generate3dModelMultiview` falls back to single-view if any view edit fails.

**Glow topics now opt out of 3D entirely.** A black hole is light, not matter, so image-to-mesh
returns torn shards. `teaching.ts` guidance previously excluded only "abstract concepts, code,
processes"; it now also excludes fire, plasma, gas, fields, forces, waves, explosions, and
anything whose appearance is its glow.

**Also fixed: the Pages Router never had the Geist font variables.** They were declared inline
in the App Router root layout and set on its `<body>`, so `/demo`, `/learn` and `/dev/*` fell
back to the browser's default serif. An undefined `var()` does not fall through to the next
family; the whole declaration is dropped. Both fonts now come from `src/lib/fonts.ts`, and the
Pages Router side defines the properties on `:root` from `_app.tsx`. Two dead ends recorded in
the commit: a wrapper in `_app.tsx` leaves body-level Radix portals serif, and `_document.tsx`
cannot do it at all because next/font is only wired up from `_app` or a page.

**The landing page was rebuilt a second time** against the `design-taste-frontend` skill's
audit, which failed the first version on seven mechanical counts: 8 em-dashes in rendered copy
(now 0), 8 eyebrow labels against a budget of 3 (now 2), 12 corner radii (now 4, documented in
`shape.ts`), four consecutive zigzag splits (now four distinct layouts), three-equal-cards
twice (now a six-cell bento), a five-element hero with 28-word subtext (now four and 17), and
no press feedback on any control.

### Open

- **Visual identity is NOT done** and Hmz has called it: the orange is 90% saturation against
  the skill's 80% ceiling, the lowercase wordmark undersells, and he wants a dark mode.
  Brief written: `.claude/plans/T04b-landing-visual-identity.md`, to run as its own session.
- **The two landing images that show a 3D model are stale** (they show the old rejected one).
  Re-shoot after confirming the new volcano looks right.
- **The black-hole demo topic should be swapped** for something with real geometry. A full
  topic swap is roughly $0.80-1.00 plus TTS quota; the model is the cheap part.
- The heart model from the earlier eval **does not exist**: those scripts called fal directly
  and never persisted. The cache has only the two models from this session's regen.
- Multiview pricing is the one row in `pricing.ts` not pinned to a fal API reading, because
  the API reports that endpoint in credits. Reconcile against the dashboard after a real run.

## 2026-09-09 (T04) — landing page rebuilt

Branch `dev/t04-landing-page` off `deploy-prep`. `src/app/page.tsx` went from a hero plus
three emoji cards to a full page in `src/components/landing/`: nav, split hero, capability
strip, four-step how-it-works, six-card feature grid, a parents strip, a closing CTA and a
footer. Design canvas approved before any code was written
(https://claude.ai/code/artifact/d0d76f20-e5f9-4051-8ee3-ea36eb68a1d5).

- **The product visuals are real, and they come from `/demo`, not `/learn`.** Three stills
  captured from a **production build** with a dependency-free CDP driver: the volcano lesson
  with its generated cross-section, the generated black-hole model standing in the room with
  its labels, and the desk quiz. `/demo` renders the same classroom, avatar and lesson panel
  but is public, session-free and calls no paid API, so re-shooting costs nothing. Exported
  as WebP at 1760px into `public/images/landing/` (80-133 kB each), served through
  `next/image`.
- **The 3D shot is the black hole, not the volcano, and that was forced.** In the volcano
  lesson the generated mesh sits behind the lesson panel and cannot be framed without
  cropping the panel out. The black-hole model stands clear of it, with its accretion disk,
  event horizon and bent-light-ring labels legible.
- **Motion is `react-intersection-observer` + a CSS transition, not framer-motion.** Same
  reveal, ~2 kB instead of ~38 kB: `/` first-load JS is **120 kB** (146 kB with
  framer-motion), statically prerendered. `prefers-reduced-motion` is honoured by a media
  query in `globals.css` rather than a JS branch, so there is no first-paint animation to
  undo.
- **The hero is deliberately NOT wrapped in `Reveal`.** Its start state is `opacity: 0` and
  Chrome does not credit a transparent element as painted, so wrapping the classroom
  screenshot (the LCP candidate, preloaded with `priority`) pushed LCP out by hydration plus
  the transition. Above the fold there is nothing to reveal anyway.
- **The reveal cannot leave the page hidden.** A `<noscript>` rule unhides everything when
  JS never runs, and an element that is still hidden re-checks its own rect on a 1200 ms
  interval, clearing the interval once shown. That second net is not theoretical:
  IntersectionObserver delivered no callbacks at all in the CDP-driven Chrome used for
  verification. It is a repeating check rather than a one-shot timer because any one-shot
  latch has to guess once whether the observer is healthy, and both guesses fail — giving up
  eagerly kills the animation for the whole tab after one slow load, and trusting a single
  callback leaves everything already stood down permanently hidden if delivery stops. Both
  were written and both were caught in review; the repeating check needs no guess. Verified
  by scrolling a production build: 1 of 15 revealed at rest, then 4, 6, 13, 15 on the way
  down.
- **One new token**: `--aristo-orange-deep` (`23 75% 43%` — the #C05A1C already hardcoded
  around the learn/demo components) plus its `aristo.orange-deep` Tailwind colour. Nothing
  else in the palette changed.
- Copy is honest by construction: no testimonials, no user counts, no logos. The parents
  strip says what is tracked (mastery, answers, session length), that access is
  approval-gated, and that lessons are AI-generated and can be wrong.
- **Not done, on purpose**: no FAQ (offered, not requested); `LEGAL_LINKS` in
  `SiteFooter.tsx` is an empty array, so the privacy/terms row renders nothing rather than
  shipping dead links.
- Gates: `yarn type-check`, `yarn lint` (22 warnings, all pre-existing, none in the new
  files), `yarn test` (83/83), `yarn build` — all green. No horizontal overflow at 360, 768,
  1024, 1280 or 1440, verified by measuring `scrollWidth` against `innerWidth`.

**Found while capturing, NOT fixed (out of T04 scope):** `pages/_app.tsx` never applies the
`--font-geist-sans` / `--font-geist-mono` variables — those are set on `<body>` in
`src/app/layout.tsx`, which the Pages Router never renders. So on `/demo` and `/learn` the
`font-sans` declaration resolves to `var(--font-geist-sans), system-ui, sans-serif` with an
undefined custom property, which invalidates the whole declaration and drops bold text to
the default serif. It is visible in the landing screenshots. One-line fix in `pages/_app.tsx`;
touching `/learn` was explicitly out of scope here.

## 2026-09-09 (final) — tiered image models applied

**Eval artifacts kept:** `.claude/eval/2026-09-09-pipeline/` (README + 16 comparison images
+ 4 reference GLBs, Draco-compressed, 7.6 MB) is the evidence behind every choice below, and
the thing to point a fresh session at. The good heart model is demo-ready at
`public/demo/heart/model.glb` (1.88 MB).

Acting on the eval above. `generateInfographic` gained a `tier` option:

- **"pro"** (`fal-ai/nano-banana-pro`, $0.15) — topic teaching image only, because
  `visual_walkthrough` narration cites its labels by name.
- **"fast"** (`fal-ai/nano-banana-2`, $0.08) — segment visuals. Measured equal to Pro on
  text accuracy, 2.1x faster.

Two details that matter:

1. **The model is part of the cache key** (`cacheKey(prompt, style, model)`). Without it the
   two tiers would serve each other's images out of L1/L2 for the same prompt+style. This
   re-keys every existing infographic entry — free right now, since `generated_assets` was
   emptied after the T06 probe.
2. **`RESTRAINT_SUFFIX` is appended on the fast tier only.** NB2 renders text as well as Pro
   but volunteers titles, explanatory paragraphs, "RESULT:" boxes and callouts labelling
   styling rather than content — an image that explains itself talks over the teacher who is
   narrating. Verified with one more generation ($0.08): the same flow prompt that produced
   a cluttered poster came back as a clean numbered chevron diagram, correct labels, no
   title, no paragraphs. Not applied to Pro, which is already restrained.

Per concept now **$0.77** (1 Pro teaching image + 4 NB2 segment visuals + FLUX + Tripo3D),
against $0.82 before for a worse 3D model — the whole quality upgrade lands cheaper than the
status quo, and lessons render faster.

Total eval spend across the session: **$2.43** of the $3 Hmz authorised.

## 2026-09-09 (latest) — pipeline eval run, $2.35 spent, three findings

Hmz authorised up to $3 for one round of real generations. Spent **$2.352**. Eval called fal
**directly**, not through `banana.ts`, so `usage_events` stays clean (verified: still 57 rows,
unchanged) — same precedent T07 set.

**1. Nano Banana 2 matches Pro on text. My earlier assumption was wrong.**
Tested on three *real* segment prompts pulled from `cached_lessons` — all text-heavy Python
material (code snippets with quotes and line numbers, `python3 --version` / `Python 3.12.0`,
labelled flow boxes). This is the hardest text workload the product has. **NB2 garbled nothing
in 3/3.** Pro also 3/3. Text fidelity is a tie, so the premise for keeping Pro on segment
visuals ("NB2 is worse at labels") does not survive contact with the actual prompts.

The real difference is **design restraint**, and it cuts both ways:
- Pro is disciplined and glanceable; on the flow prompt it was *too* sparse (three boxes in a
  sea of white).
- NB2 is richer and more engaging — its flow diagram is the better teaching visual — but it
  over-annotates, adding explanatory paragraphs and useless callouts ("Terminal Background
  (Dark)"). That competes with the teacher's narration, which is the thing narrating.

Latency, measured: **Pro avg 27.6 s** (19.2 / 34.9 / 28.6) vs **NB2 avg 12.9 s** (16.1 / 9.8 /
12.9) — NB2 is **2.1x faster**, matching the vendor claim.

**2. The FLUX source step must stay — proven, not assumed.**
Fed the labelled NB Pro teaching infographic to Tripo3D as an alternative source: it extruded
the label text and leader lines into the geometry, producing garbled 3D lettering and arrows
sticking out of the heart. Unusable. The clean, unlabelled, single-object FLUX source is
load-bearing, and that architectural split is now justified by evidence.

**3. T07's suggested FLUX prompt tweak is harmful — do NOT apply it.**
Tested "solid opaque forms, thick volumetric shapes, no transparency, no thin membranes" on
the exact case T07 flagged (animal cell). It **backfired**: FLUX rendered the membrane as a
glassy petri dish, so Tripo3D reconstructed only the loose contents and returned disconnected
floating blobs. The unmodified prompt produced a coherent solid disc. T07's hypothesis is
refuted; the current prompt stays.

**Tripo3D v2.5 confirmed good in production shape.** Heart from a FLUX source came out
volumetric, anatomically plausible, with coronary vessels and clean PBR — the "flat coin"
failure that made TripoSR unusable is gone. Latency 63-82 s, well inside the new 240 s
timeout. Response fields confirmed as `task_id, model_mesh, base_model, pbr_model,
rendered_image`, so the shipped `pbr_model ?? model_mesh` fallback is correct.
One caveat: Tripo's own `rendered_image` preview came back blank on one of five calls even
though the mesh was fine (14.9 MB) — treat that preview as unreliable, never as a health check.

## 2026-09-09 (later) — Tripo3D v2.5 swap + fal pricing correction

Same branch `dev/t06-persistent-cache`, on top of T06. **Not yet run against fal** — the
swap is code-complete but deliberately unverified to preserve credits (Hmz's call).

- **`fal-ai/triposr` -> `tripo3d/tripo/v2.5/image-to-3d`** (`texture: "standard"`,
  `pbr: true`, $0.30/gen). T07 scored it 4/5 vs TripoSR's 1.5/5 and it is faster
  (78 s vs ~100 s). Cache prefix `triposr|` -> `tripo25|` so old meshes are unreachable;
  `GeneratedModel.tsx` drops the `-PI/2` X rotation (Tripo3D is Y-up glTF); 240 s timeout
  added around `fal.subscribe`, which has none of its own and hung once in the eval.
- **The fal pricing table was wrong on its biggest line.** `fal-ai/nano-banana-pro` was
  set to $0.04 — that is the **non-Pro** rate ($0.0398) — while fal charges **$0.15**. The
  cost dashboard has understated infographic spend **3.75x**. Corrected against fal's own
  pricing API (`GET https://api.fal.ai/v1/models/pricing?endpoint_id=<slug>`), which is
  authoritative and free to query — the docs pages disagree with each other. Now pinned by
  `pricing.test.ts` so the next drift fails CI.
- **Real per-concept economics, one-time, post-T06** (~4.5 NB Pro images per concept,
  measured from `usage_events`):

  | | images | FLUX | 3D | total |
  |---|---|---|---|---|
  | before (as billed) | $0.68 | $0.003 | $0.07 | **$0.75** |
  | after this swap | $0.68 | $0.003 | $0.30 | **$0.98** |
  | if segment visuals move to nano-banana-2 | $0.36 | $0.003 | $0.30 | **$0.66** |

  So the 3D upgrade is +31%, not the 4.3x that a 3D-only comparison implies — and switching
  the image model would more than pay for it.
- **Open recommendation, not done:** `fal-ai/nano-banana-2` (Gemini 3.1 Flash Image) is
  $0.08 vs Pro's $0.15, 2-3x faster (4-8 s vs 10-20 s), and fal's own comparison rates it
  *better* for infographic text spacing/readability; Pro's edge is print-grade typography,
  which Aristo does not need. Worth an A/B on real segment prompts before switching — that
  costs credits, so it is queued, not done. Would also cut lesson latency, which is the
  other half of the `/learn` loading complaint.

## 2026-09-09 (later) — T06 persistent generation cache COMPLETE

Branch `dev/t06-persistent-cache`, merged up from `deploy-prep` first (so it carries the
lipsync, demo and avatar-clone work). Closes the last open T06 item.

- **`src/lib/imagegen/banana.ts` has a real L2 layer** under the existing L1 memory cache:
  lookup `(kind, prompt_hash)` in `generated_assets` -> generate via fal -> download ->
  upload to the public `generated-assets` bucket -> upsert row -> serve the durable Supabase
  URL from then on. `concept_id` threaded through `/api/generate-model`,
  `/api/generate-model/3d`, `/api/learn/segment-visuals` and their call sites.
- **Migration 016 is applied** to the live DB (was the blocker; done by hand in the SQL
  Editor — PostgREST has no arbitrary-SQL endpoint, so agent sessions cannot run DDL).
- **Bucket decision: PUBLIC** (Hmz, 2026-09-09). Generated educational images, no learner
  data, content-addressed unguessable paths, CDN-cacheable, no signing round trip — so the
  URLs stay safe to hold in the L1 cache and in lesson payloads. Verified live:
  `cache-control: public, max-age=31536000`.
- **Acceptance criteria proven live**, each run in its own process so L1 was truly cold:
  run 1 generated in 3683 ms and wrote one `usage_events` row ($0.003); run 2 served the
  identical URL in 300 ms with **no new cost row**; with the bucket renamed to a wrong name,
  generation still succeeded (warn, no throw, fal URL served, no row written for an
  unstorable object). Total verification spend $0.009; all test rows/objects deleted after.
- **Defect found and fixed while verifying.** A row does not prove the object exists —
  `getPublicUrl` never checks — so row-present + object-deleted returned a URL that 400s,
  and because the row kept "hitting", generation never re-ran: a silent, permanent broken
  image. `lookupPersistedAsset` now confirms a hit with a bounded `HEAD` (1500 ms); a
  definitive 400/404 drops the stale row and regenerates (self-healing), anything else
  fails open and serves the URL. Costs ~100 ms per hit vs ~3800 ms to regenerate.
- Gates: `yarn type-check`, `yarn lint` (pre-existing warnings only), `yarn test` (76/76),
  `yarn build` — all green.

## 2026-09-09 — avatar T-pose + idle drift (one root cause)

Two reported bugs, one cause. `Teacher.tsx` mounted the **globally cached** GLTF scene
directly (`<primitive object={scene} />`, no clone) and mutated it via `scene.traverse`
(materials, per-frame morph influences). Every Teacher instance therefore drove the *same*
bone objects.

- **T-pose on every avatar except the default.** Marcus and Priya share
  `animations_Avaturn.glb`, so `useGLTF` returns the same `animations` array for both.
  drei memoises actions on that array, so switching between them never rebuilt the actions —
  they stayed bound to the previous rig's bones and the new avatar was driven by nothing.
- **Marcus slowly twisting out of position when idle.** A mixer from an earlier mount kept
  animating those shared bones alongside the live one; two mixers crossfading the same Hips
  on each 20s idle cycle reads as small weird turns accumulating.

Ruled out on the way, with measurements rather than guesses:
- Missing animation files — all present.
- Bone-name mismatch — Priya's clip targets resolve 100% against her mesh (Ryan/Sonia miss
  only 13 `_end` leaf tips out of ~79, which cannot cause a T-pose).
- A "turn to the blackboard" idle clip — parsed the GLB accessors: root yaw across
  Idle/Idle2/Idle3/Idle4 stays within ±6° and translation is ~0. No clip turns him.
- `rotationY` — a static prop (0.3), never animated.

Fix: clone per mount (`SkeletonUtils.clone`, memoised on the cached scene) so each rig owns
its skeleton and edits stay local; key `<Teacher>` by avatar in `Experience.tsx` so a switch
fully remounts (new group, mixer, actions); stop the mixer's actions on unmount.

**Verified running 2026-09-09.** Loaded `/learn` and switched through Ryan / Sonia / Priya /
Marcus: all four animate, none T-pose. Left Marcus idle for several minutes — he holds
position, no drift or turning. Typecheck, lint, tests and build all pass.

## 2026-09-08 (later) — V7 alignment lipsync, demo path built

Same branch `dev/v2-instant-demo`, still uncommitted.

- **New `src/lib/lipsync/visemes.ts`** turns ElevenLabs character timings into a merged
  viseme timeline. 26 unit assertions in `visemes.test.ts`, including a 60fps playback
  simulation (mouth active >70% of a clip, 3-25 shape changes/sec, never frozen >0.6s) —
  the failure modes that only show up in motion.
- **`prerender-demo-tts.mjs --align`** sends existing mp3s to `/v1/forced-alignment` and
  writes `<seg>.align.json` beside each. Resumable; treats an alignment as stale when the
  mp3's byte count stops matching the `audioBytes` recorded in it.
- **`useTTS` prefers timings over the FFT.** `getCurrentViseme()` reads the timeline when
  one is loaded, else falls through to wawa-lipsync unchanged. The sidecar fetch is
  fire-and-forget (playback never waits) and generation-guarded (a late sidecar cannot
  attach to a later segment). Teacher.tsx needed no changes — it already consumed
  `getCurrentViseme()`, which is why that was the seam to pick.
- **BLOCKED on one command.** `api.elevenlabs.io` is denied by this session's egress policy
  and the desktop VM has no outbound DNS, so no alignment file exists yet. Run
  `node scripts/prerender-demo-tts.mjs --align` from a normal shell: 30 segments, ~7.4 min
  of audio, **0 TTS characters** (Forced Alignment bills as speech-to-text).
- **Not verified in motion.** The demo playthrough could not be re-run: the dev server
  stopped serving the `DemoClient` dynamic chunk after repeated recompiles (only 8
  resources loaded, no canvas ever mounted, GLBs themselves fine at 200). Restart
  `next dev`. What was verified live: the sidecar 404s and the mp3 still serves 200 — the
  intended degrade path.
- Safety net worth keeping: `parseAlignment` rejects payloads whose `generator` is not an
  ElevenLabs run, so a hand-made placeholder degrades to the FFT rather than driving the
  mouth from invented timings.
- **`/learn` now gets alignment too** (same day, after the demo-only version was rightly
  called out as pointless on its own). `/api/tts` calls `/with-timestamps`, which returns
  character timings with the audio **at the same character cost and with no extra key
  scope** — unlike Forced Alignment, which needs `forced_alignment` enabled on the key and
  is what the demo's `--align` pass hit a 401 on. Response is JSON (base64 audio +
  alignment); `useTTS` sniffs the content type, so the plain-audio fallback still works.
  `parseAlignment` now normalises both ElevenLabs shapes — the parallel arrays
  `with-timestamps` returns and the array-of-objects Forced Alignment returns.
- Three independent ways this degrades rather than breaks, because none of it could be run
  against the live API from here: upstream failure falls back to the plain endpoint;
  a missing or malformed alignment leaves lipsync on the FFT; `TTS_TIMESTAMPS=off` disables
  the timestamped call without a code deploy.

### Shared-audio race found and fixed while debugging the above

Reported symptoms on `/learn`: audio lagging, narration not playing the whole segment, and
the avatar never returning to idle. All three were **one pre-existing bug**, not the
alignment work. Instrumenting the audio element during a live free-topic answer showed
three `/api/tts` calls starting within 13ms of each other and three different blobs loading
within 60ms, each `abort`+`emptied`-ing the previous.

Cause: one `<audio>` singleton, four independent narrators — `FreeTopicCard.tsx:122`,
`InputBox.tsx:91`, `LessonView.tsx:256/263/281/614/645`, `useLessonPlayback.ts:470` — and
nothing arbitrating between them. Overlapping `speak()` calls both completed their fetches
and both set `audio.src`. `speak()`'s internal `stop()` never set the previous call's
`cancelled` flag (only `controller.stop()` did), so a superseded fetch happily clobbered
whatever was playing.

Why it produced each symptom: the loser's audio was killed ~50ms in (**"didn't run the
whole part"**); three full-price generations ran concurrently and slowed each other from
~1.3s to ~4.2s (**"lagging"**); and `abort`/`emptied` do **not** fire `ended`, so the losing
caller's `onEnd` never ran and any component waiting on it — the lesson engine — hung
forever with `gesture` stuck (**"not coming back to idle"**). That last one is the direct
answer to "does the audio have an ending mark": it does, but only the winner ever gets it.

Fix in `useTTS`: speech is explicitly owned (`_speechSeq` / `_activeSpeech`). Only the
holder may touch the element, and a superseded caller gets its `onEnd` so it is released
rather than left waiting. Verified live — abort count went 3 -> 0 and a 34.6s clip played
through cleanly.

**Fixed (2026-09-08).** Corrected diagnosis after reading the call sites: it was not three
components narrating different slices. In FREE mode two components narrated *the same
answer*:

- `InputBox.tsx:91` speaks `data.definition + data.explanation` imperatively the moment
  `/api/teach` returns.
- `FreeTopicCard.tsx:122` speaks `parsed.definition + parsed.explanation` from a mount
  effect when it is the latest card — the same content, re-parsed out of the markdown
  summary InputBox built, which is why the two clips were near-identical but not equal
  (32.93s vs 32.04s).

The third call is `reactStrictMode: true` (next.config) double-invoking FreeTopicCard's
effect in dev. So production duplicates 2x, dev 3x.

`LessonView` and `useLessonPlayback` are course-mode narrators and are mutually exclusive
with free mode (`MessagePanel.tsx:64-67` returns early), so they never overlap with these —
they are separate owners, not part of this race.

Cost: a ~32s answer is roughly 500 characters, so each free-topic question billed ~1,000
(prod) or ~1,500 (dev) instead of ~500 — against a 10,000/month tier.

Two changes, both on Hmz's call:

1. **`FreeTopicCard` owns free-topic narration**; the `speak()` call is gone from
   `InputBox`. The card renders the answer, speaks the parsed text that matches what is on
   screen, and already handled the explaining/idle gesture and unmount cleanup — none of
   which InputBox did (it only toggled `isSpeaking`, which is why the avatar's gesture
   handling was unreliable on this path).
2. **`useTTS` shares one in-flight request per (voice, text)** (`_inflight` +
   `fetchTtsShared`). Concurrent duplicate calls now wait on the first request rather than
   opening their own, which kills the StrictMode double-fire in dev and protects against any
   future component narrating something already being fetched. Entries clear as soon as the
   request settles, so speaking the same text again later still refetches.

Verified live on `/learn`: one free-topic question went from **3 `/api/tts` calls to 1**,
request time from ~2.7-4.2s to **1.69s**, and aborts from 3 to **0**.

## 2026-09-08 — demo narration, avatar default, ops unblocked

Branch `dev/v2-instant-demo` (merged up from `deploy-prep` first, so it now carries T10's
CI/tests). **Uncommitted at time of writing.**

- **Demo narration is pre-rendered ElevenLabs audio**, not browser speechSynthesis.
  `scripts/prerender-demo-tts.mjs` (dependency-free node, reads `.env.local`, resumable,
  `--dry-run`) wrote 30 mp3s / 7,029 chars into `public/demo/<slug>/`. `useTTS` gained a
  `srcUrl` option that points the singleton audio element at a static file; that element is
  what wawa-lipsync analyses, so **this is what made lipsync work on the demo at all** —
  speechSynthesis exposes no audio buffer. Per-segment fallback to speechSynthesis if a file
  fails to load. Verified in-browser: 0 `/api/` requests across a full lesson.
- **DEFAULT_TEACHER is now `marcus`** (`useAristoStore.ts`), on `/learn` as well as `/demo`.
  Reason: ryan has 0 viseme morphs and sonia has no mouth morphs at all, verified by parsing
  the GLB JSON chunks — neither can ever lipsync. Cost: cold `/learn` goes ~3.6 MB -> ~12.7 MB,
  partly undoing T02. Accepted deliberately: a teacher whose mouth does not move undercuts the
  product's main visual claim. `Teacher.tsx`'s module-scope preload became
  `preloadDefaultAvatar()` called from `LearnClient` — at module scope it also charged `/demo`
  2.5 MB for an avatar it discards. Sign-in prefetch retargeted to marcus.
- **Pricing note corrected**: Sonnet 5's $2/$10 is now standard; the scheduled 2026-09-01 rise
  to $3/$15 was cancelled. The old comment told a future session to bump the row, which would
  have overstated every lesson cost by ~50%. Rates were and are correct.
- **User actions cleared**: migration 016 applied, admin bootstrap SQL run, fal.ai topped up,
  Resend fully wired in Vercel (RESEND_API_KEY prod+preview, ADMIN_NOTIFY_EMAIL and APP_URL
  added as Config, prod+preview) — takes effect on next deploy.
- **New brief**: `V7-alignment-lipsync.md`. Current lipsync is an FFT guess; ElevenLabs
  character timings would make it real. Free on `/learn` (`with-timestamps` bills the same
  characters); the demo can use Forced Alignment on the existing mp3s, billed as STT, so it
  costs no TTS quota.
- Backlog: sonia's phantom `mouthSmile` morph added to `UX-POLISH-BACKLOG.md` as item 0.

## 2026-07-13 — T10 ops hardening (autonomous parts)

- Branch `dev/t10-ops-hardening` (off `deploy-prep`), not pushed. CI (`.github/workflows/ci.yml`),
  Vitest unit tests (4 files / 47 tests: BKT, FSRS, profiler, pricing — all pure logic, no
  network mocking), `.env.example` refreshed, and a read-only live-DB migration reconciliation
  (all 15 migrations confirmed applied) are done. Resend env vars, admin bootstrap SQL, and
  Sentry are user-dependent — runbook at `.claude/plans/T10-RUNBOOK.md`.

## 2026-07-12 — Roadmap era

- Desk quiz + head-turn camera + free-mode 3D hardening shipped (was branch
  `dev/desk-quiz-3d-fixes`, merged to `deploy-prep`).
- Full project audit done. **Active work queue: `.claude/plans/README.md`** (vision tier
  V1–V6 + maintenance tier T01–T11 + UX polish backlog). Session continuity:
  `.claude/plans/SESSION_HANDOFF.md`.
- Production = Vercel `deploy-prep` branch. `master` promotion still pending (needs Vercel
  dashboard branch switch).

## Phase Status — all 9 phases complete

| Phase | Name | Status |
|-------|------|--------|
| 1 | Knowledge Graph Foundation | ✅ |
| 2 | Learner Profile + Mastery | ✅ |
| 3 | Teaching Agent 5-Phase Protocol | ✅ |
| 4 | Quiz Generation + Answer Evaluation | ✅ |
| 5 | Course Builder + Progression | ✅ |
| 6 | Spaced Repetition Engine (FSRS) | ✅ |
| 7 | Behavioral Profiling | ✅ |
| 8 | RAG Pipeline (pgvector + OpenAI embeds) | ✅ |
| 9 | Student Dashboard + Admin Cleanup | ✅ |

## What's Next (post-Phase-9 polish)

- **Vercel deploy** — env vars in Vercel dashboard, verify `maxDuration = 60` on lesson route if Sonnet stalls
- **RAG seeding** — admin-only `POST /api/kg/ingest` per domain (needs `OPENAI_API_KEY`)
- **End-to-end 3D test** — fal.ai pipeline works with `FAL_KEY`; verify model appears in scene
- **Phase 10 (planned)** — real-time voice (ElevenLabs / Whisper to replace Web Speech), shared sessions via Supabase Realtime
- **Lesson streaming** — would replace the synchronous `generateLesson()` JSON return with progressive 5-phase render; requires LessonView + lesson route restructure (deferred)

## Migration State

All run; no pending. `001_initial_schema` → `016_generated_assets` (no `007` — quiz_attempts went into `006_mastery`).
- `005_reset_and_graph.sql` — drops FSLSM tables, builds `concepts` / `concept_prerequisites`
- `006_mastery.sql` — `learner_profiles`, `user_concept_mastery` (+ SRS), `user_course_progress`, `user_misconceptions`, `session_logs`, `quiz_attempts`
- `008_courses.sql` — `courses` + `course_id` FK
- `009_quiz_constraints.sql` — `UNIQUE(user_id, concept_id, misconception)`, `increment_misconception()` RPC
- `010_rag.sql` — vector extension, `reference_chunks` + HNSW index, `match_reference_chunks()` RPC
- `015_user_approval.sql` — `profiles.approval_status` + companion columns for the admin approval gate
- `016_generated_assets.sql` — persistent generation cache (T06): `generated_assets` keyed
  `UNIQUE (kind, prompt_hash)`, RLS read-for-authenticated / write-via-service-role; pairs
  with the public `generated-assets` Storage bucket. Applied 2026-09-09.
