# Session Handoff — living document

_Updated continuously. If you are a fresh session: read `CLAUDE.md`, then this file, then
`.claude/plans/README.md`. This tells you exactly where work stands and what to do next._

Last updated: 2026-09-10 (session: 3D root cause, heart demo topic, PR #4 merged)

## What this session did (chronological)

1. **Full project audit** (done): read all memory/docs/handoffs + code hot spots. Findings and
   verdicts recorded in `.claude/plans/README.md` ("Audit summary" section).
2. **Maintenance roadmap T01-T11** (done, not yet executed): 11 self-contained briefs in
   `.claude/plans/` for cheaper-model sessions (asset diet, loading UX, landing rebuild, model
   bump to Sonnet 5, persistent gen cache, 3D-gen eval, dynamic classroom, lesson streaming,
   ops hardening, content seeding). None executed yet.
3. **User feedback**: T-tier is housekeeping, not product-transforming. Requested a vision tier
   that substantially improves the product (tech, UX, landing), grounded by subagent
   exploration, cheapest-adequate models per task.
4. **Vision tier** (done): two Explore subagents ran (haiku: full student-facing UX
   inventory; sonnet: barge-in conversational-teaching readiness audit). Their key outputs
   are baked into the briefs. Six vision briefs written: `V1-raise-hand-teacher.md`
   (flagship — push-to-talk interrupt Q&A; echo problem solved by design, integration points
   documented from the audit), `V2-instant-public-demo.md` ($0/visit pre-generated demo,
   fixes the signup funnel), `V3-live-blackboard-worked-examples.md` (step-by-step worked
   math on the board), `V4-teacher-memory.md` (personal continuity from existing data),
   `V5-motivation-loop.md` (server-authoritative XP + in-scene celebration),
   `V6-parent-weekly-digest.md`. Plus `UX-POLISH-BACKLOG.md` (14 small fixes from the UX
   inventory, batchable on haiku/sonnet). README updated with the vision tier + recommended
   order V2 -> V1 -> V5 -> V4 -> V3 -> V6, interleaved with T02/T05/T09.
5. Memory index updated (`roadmap-2026-07-12` memory points here).
6. **Execution wave 1** (done 2026-07-12, user approved):
   - **T01 (main session)**: docs committed; drift fixed (decisions.md TripoSR row, stale
     handoff deleted, plans archived to docs/archive/); `dev/desk-quiz-3d-fixes` pushed and
     merged into `deploy-prep` (pushed -> production deployed, merge commit `22fdbe4`).
     Master promotion still pending (user must switch Vercel prod branch in dashboard first).
   - Work branch **`dev/roadmap-wave-1`** created off deploy-prep; T05/T02/T03 executed on it
     by sonnet subagents; branch pushed (Vercel preview available).
   - **T05 done**: teaching/assessment -> `claude-sonnet-5` (intro pricing $2/$10 encoded in
     pricing.ts with a note re standard $3/$15 from 2026-09-01). Live smoke test: lesson 35 s,
     quiz 14 s, schemas valid. NOTE: usage_events DB write not observable from sandbox
     (Supabase host unreachable there) — glance at admin cost page after next real lesson.
   - **T02 done**: GLBs draco+webp compressed (82.6 -> 30.8 MB on disk), originals in
     git-ignored `assets-src/`, unused FBX deleted, draco decoder self-hosted
     (`src/components/three/dracoDecoder.ts`), preloads now default-only (ryan +
     anims + classroom_default = **3.4 MB cold payload**, was ~78 MB), hover-warm preload on
     avatar switcher. Morphs/visemes/clips verified identical programmatically.
   - **T03 done**: branded loading overlay (`LoadingScreenVisual` + `SceneLoadingOverlay`),
     SSR-rendered 0% state in pages/learn.tsx fallback, real byte progress via useProgress +
     `sceneReady` first-frame flag, 400 ms anti-flash minimum, 20 s stall -> reload hint,
     GLB prefetch on sign-in page.

## Wave-1 verification + merge (done 2026-07-13)

Supabase was paused (cause of the earlier unreachable-host issue) — user resumed it.
Browser verification done via puppeteer on the auth-free dev harnesses:
- All 4 avatars + both classrooms + desk quiz + draco decoding + sign-in prefetch: PASS.
  Priya's pale-at-distance eyes proven pre-existing (texture diff vs pre-compression asset).
  Harness gained dev-only `?avatar=`/`?room=alt` overrides (commit `904eca2`).
- Sonnet-5 cost attribution verified in live `usage_events`: $0.058/lesson, exact match to
  encoded intro pricing (incl. cache-creation).
- **Sonnet-5 adaptive malformation found and fixed**: intermittently stuffed the payload into
  `metadata` leaving phases/segments empty. Fix (commit `46887cf`, teaching.ts): all tool
  schemas now `additionalProperties: false`, structural `validateLessonInput()`, one
  corrective retry (tagged `teach.lesson.retry`), throw on double failure. Retry path
  exercised against a live reproduction — self-healed.
- **Merged to `deploy-prep` (`2b64b4b`) and pushed — in production.**

Remaining human checks (nice-to-have, non-blocking): lipsync playback with real TTS audio
(needs authed session), loading overlay on throttled network, watch `teach.lesson.retry`
frequency in /admin/cost.

## Wave 2 (done 2026-07-13)

- **V2 instant demo**: built + browser-verified on `dev/v2-instant-demo` (pushed, UNMERGED).
  2 frozen lessons, $0 per visitor, 0 API calls verified. Demo narrates via browser
  speechSynthesis because the ElevenLabs key lacks `user_read` (quota unverifiable).
  MERGE BLOCKED on user decision: keep browser voice vs pre-render ElevenLabs mp3s.
- **T10 ops**: MERGED to deploy-prep (`fd81abd`). CI live and first run GREEN on GitHub.
  47 vitest tests. Migrations reconciled: ALL applied incl. 011. Runbook:
  `.claude/plans/T10-RUNBOOK.md`. Latent deferred bug: conditional hooks in
  `src/utils/modelLoader.js` (eslint-warned, R3F-critical, do not blind-refactor).
- **T06 persistent cache**: **DONE 2026-09-09** — see the session section at the bottom of
  this file. (This bullet previously read "MERGE BLOCKED on migration 016"; the migration
  is applied and every acceptance criterion is verified.)
- **V4 teacher memory**: DONE on `dev/v4-teacher-memory` (pushed, UNMERGED — needs authed
  UI pass: greeting banner/chip in ModePicker, quiz celebration, TTS autoplay policy,
  resume_course chip). GreetingAgent (Haiku, ~$0.002/greeting, 1.8 s), learner_history
  back-references, misconception-targeted quiz + resolution (no DDL needed — resolved/
  resolved_at columns already existed). Agent caught + fixed a privacy bug: personalized
  lessons now SKIP the shared cached_lessons write (was about to leak per-user history
  across users with the same profile signature). Own security pass: no findings.
- **T07 3D-gen eval**: DONE — `.claude/plans/T07-REPORT.md`. Verdict: replace TripoSR with
  **Tripo3D v2.5** (`tripo3d/tripo/v2.5/image-to-3d`, $0.30/gen, scored 4/5 vs TripoSR 1.5/5;
  Trellis 2 hallucinates on diagram-style sources, Hunyuan v2 collapses them flat). Swap plan
  is in the report (banana.ts slug/response/timeout, pricing row, remove the -PI/2 Z-up
  rotation in GeneratedModel.tsx). Eval truncated by an exhausted fal balance ($1.53 spent);
  optional ~$0.91 confirmation run after top-up. Swap itself = follow-up task, do after T06
  merges (persistence makes $0.30/concept one-time).


## USER ACTIONS (2026-07-13 wave — all resolved; see the 2026-09-08 section below)

1. Apply migration: paste `supabase/migrations/016_generated_assets.sql` into the Supabase
   SQL Editor -> then T06 verification + merge can proceed.
2. Admin bootstrap SQL (exact SQL in `.claude/plans/T10-RUNBOOK.md`) — aitchemmzi is still
   pending/non-admin in the live DB.
3. Resend env vars in Vercel (runbook section 1) for signup notifications.
4. V2 demo voice decision: browser TTS as-is, or confirm ElevenLabs quota headroom
   (~6-8k chars one-time) for pre-rendered audio. V2 merge + T04 landing rebuild + V1
   raise-hand are queued behind this to avoid conflicts on shared hooks.
5. Optional: production visual pass (lipsync in authed /learn, loading overlay throttled).
6. Later: master promotion (switch Vercel prod branch -> master in dashboard, then
   fast-forward master to deploy-prep).

## Session 2026-09-08 — demo narration + avatar default

Worked on `dev/v2-instant-demo` (merged `deploy-prep` in first, so it now carries T10's CI
and vitest suite). **All of this is uncommitted** — see "Steps still to take".

- **V2's TTS decision reversed, and for a better reason than voice quality.** Demo narration
  is now 30 pre-rendered ElevenLabs mp3s (7,029 chars, one-time, inside the free tier; $0 per
  visitor after). `useTTS` gained `srcUrl`, which points the singleton audio element at a
  static file. That element is what wawa-lipsync analyses — `speechSynthesis` exposes no audio
  buffer — so the demo previously narrated with a completely motionless mouth. Generator:
  `scripts/prerender-demo-tts.mjs` (plain node, no tsx/dotenv, resumable, `--dry-run` first).
- **`DEFAULT_TEACHER` = marcus, on `/learn` too** (user's call). ryan has 0 viseme morphs;
  sonia has no mouth morphs at all — both verified by parsing the GLB JSON chunks, so neither
  can ever lipsync. Trade: cold `/learn` ~3.6 MB -> ~12.7 MB, partly undoing T02.
  `preloadDefaultAvatar()` (was a module-scope side effect in `Teacher.tsx`, which also
  charged `/demo` 2.5 MB for an avatar it discards) is now called by `LearnClient`; sign-in
  prefetch retargeted. **Not yet smoke-tested on authed `/learn`** — worth one look.
- Pricing comment corrected: Sonnet 5 stays at $2/$10, the 2026-09-01 rise was cancelled.
- New brief `V7-alignment-lipsync.md`; sonia's phantom morph is item 0 in the UX backlog.

**Note for any session working through the Cowork device bridge:** git writes from that
sandbox leave `.git/index.lock` behind (it cannot unlink), which then blocks git on the
Windows side. Stale locks were parked in `.git/_stale-locks/` and can be deleted. Run git on
Windows, not through the bridge. `tsc` runs fine through it; vitest and `next build` do not
(node_modules holds win32 native binaries).

## Session 2026-09-08 (later) — V7 alignment lipsync

Demo path is code-complete and unit-tested; `/learn`'s `with-timestamps` swap is untouched.
New `src/lib/lipsync/visemes.ts` + tests, an `--align` pass on the prerender script, and a
timeline-preferring `getCurrentViseme()` in `useTTS`. Full detail in
`.claude/plans/V7-alignment-lipsync.md`.

`/learn` gained the same treatment in the same session — a demo-only version was rightly
called out as pointless. `/api/tts` now uses `/with-timestamps` (timings inline, same
character cost, no extra key scope needed).

**Three things need a human:**

- **Enable `forced_alignment` on the ElevenLabs API key** (dashboard -> API Keys -> edit).
  `--align` currently fails 401 `missing_permissions`. Worth enabling `user_read` at the
  same time — its absence is why the V2 session could not check the quota. This affects the
  demo only; `/learn` needs no new scope.
- `node scripts/prerender-demo-tts.mjs --align` — after the permission is enabled, and from
  a shell with real internet. `api.elevenlabs.io` is blocked by the Cowork session's egress
  policy and the desktop VM has no outbound DNS, so no agent session can make this call.
  Costs ~7.4 min of speech-to-text and **zero TTS characters**.
- **Watch `/learn` narrate once after deploying.** The `with-timestamps` path has never run
  against the live API. If anything looks wrong, set `TTS_TIMESTAMPS=off` in Vercel — that
  reverts to plain audio and FFT lipsync with no code change. Server logs will say
  `with-timestamps unavailable` if it silently fell back.
- **Restart `next dev` before testing.** It wedged during this session — it stopped serving
  the `DemoClient` dynamic chunk entirely (8 resources, no canvas), while the GLBs kept
  returning 200. Not caused by the diff, but it blocked in-motion verification, so nobody
  has yet seen the timeline drive a real mesh.

## Session 2026-09-09 — avatar T-pose + idle drift shipped

Branch `dev/v2-instant-demo`, now **committed and pushed** as `74f105e`.

- **Both avatar bugs fixed, one root cause.** `Teacher.tsx` mounted the globally cached GLTF
  scene via `<primitive object={scene}>` without cloning and mutated it, so every rig shared
  bone objects. Fix: clone per mount with `SkeletonUtils.clone`, key `<Teacher>` by avatar in
  `Experience.tsx` so a switch fully remounts, stop the mixer's actions on unmount. Full
  reasoning and the ruled-out hypotheses are in `.claude/docs/state.md` (2026-09-09 entry).
- **Verified by the user, in motion.** All four avatars animate, none T-pose; Marcus holds
  position when left idle. `state.md` and `UX-POLISH-BACKLOG.md` item 0b updated from
  "verification pending" to verified.
- **`origin/deploy-prep` had moved ahead** (merge commit `fce3aa1`, PR #1 — the earlier
  lipsync work `603a91d` was already merged there). Merged it in first; it was a clean
  fast-forward with an empty content diff, so the branch now sits exactly on deploy-prep
  plus this one commit.
- **All four CI checks green locally before commit:** `yarn type-check`, `yarn lint`
  (warnings only, all pre-existing, none in the changed files), `yarn test` (76 passed /
  5 files), `yarn build`.

**MERGED TO PRODUCTION.** PR #2 (https://github.com/x-HmZ/aristo-ai/pull/2) merged into
`deploy-prep` as `8c03c46` on 2026-09-09, with both GitHub checks green on the PR head
(`type-check, lint, test, build` and `Vercel Preview Comments`). That merge triggers the
production deploy to aristo-ai-ten.vercel.app — confirm the deployment went out and do a
quick avatar smoke-test on prod.

Two notes for future PRs, both learned the hard way this session:

- The repo's **default branch is already `deploy-prep`**, so GitHub does NOT default a new PR
  to `master`. Earlier handoff text warning about that was wrong. `master` is still stale and
  must not be merged into.
- The `github` MCP server authenticates with a static PAT in `~/.claude.json`
  (`GITHUB_PERSONAL_ACCESS_TOKEN`). It returned `Bad credentials` mid-session because the PAT
  had expired; replacing the value and restarting fixed it. There is no `gh` CLI on this
  machine — installing it (`winget install --id GitHub.cli`) would give a fallback path.

## USER ACTIONS — all previously-blocking ones are now DONE (2026-09-08)

1. ~~Migration 016~~ — applied. **T06 verification + merge is now unblocked.**
2. ~~Admin bootstrap SQL~~ — run.
3. ~~Resend env vars~~ — done: `RESEND_API_KEY` (prod + preview), plus `ADMIN_NOTIFY_EMAIL`
   and `APP_URL` added as Config (prod + preview). Takes effect on the next deploy; verify
   per runbook section 1 (signup -> email -> `profiles.admin_notified_at` non-null).
4. ~~V2 demo voice decision~~ — resolved: pre-rendered ElevenLabs. T04 and V1 are unblocked.
5. ~~fal.ai balance~~ — topped up.

Still open:

6. Smoke-test authed `/learn` after the avatar default change (load time + marcus renders).
   Note `/demo` took ~25-40s to reach the topic picker in dev on a warm cache; production
   (CDN + compression) should be far better, but if `/learn` feels slow this is the T02
   trade showing up and it is worth measuring rather than assuming.
7. ~~T06: rerun the cache-hit probe, then merge~~ — done 2026-09-09, PR open into
   `deploy-prep`. Only the merge button is left.
8. ~~Tripo3D v2.5 swap~~ — **implemented 2026-09-09**, same branch/PR. **Unverified against
   fal on purpose** (credit conservation): the first real 3D lesson after merge is the test.
   Two things to eyeball then: the model is upright (Tripo3D is Y-up; the old `-PI/2`
   rotation was removed) and generation completes inside 240 s.
9. ~~Decide on `fal-ai/nano-banana-2` for segment visuals~~ — **DONE and applied
   2026-09-09.** A/B run, NB2 matched Pro on text (3/3 each), 2.1x faster. Segment visuals
   now run on the fast tier with a restraint suffix; Pro kept for the teaching image.
10. Later: master promotion (switch Vercel prod branch -> master in dashboard, then
   fast-forward master to deploy-prep).

## Repo state (as of 2026-09-09, on `deploy-prep`)

- Production = Vercel `deploy-prep` branch at aristo-ai-ten.vercel.app. It is also the repo's
  **GitHub default branch**, so PRs base against it automatically. `master` is stale/ancient
  and must not be merged into.
- `deploy-prep` is at `a26b8ed` (merge of **PR #3**, 2026-09-09): T06 persistent cache,
  Tripo3D v2.5 swap, tiered image models, corrected fal pricing. **Deployed to production
  and verified live** (aristo-ai-ten.vercel.app returns 200). `dev/t06-persistent-cache`
  is fully contained in `deploy-prep` and can be deleted.
- Before that, `8c03c46` (PR #2) brought the V7 alignment lipsync and the avatar clone fix;
  `dev/v2-instant-demo` is likewise fully contained and can be deleted.
- `dev/t04-landing-page` was **merged into `deploy-prep`** on 2026-09-10 as PR #4:
  landing rebuild, Pages Router font fix, 3D texture-coverage root cause + multi-view,
  heart demo topic replacing black holes. The branch is fully contained and can be deleted.
- Older branches still around: `dev/desk-quiz-3d-fixes` (merged into deploy-prep in wave 1),
  `dev/roadmap-wave-1`, `dev/t06-persistent-cache`, `dev/t10-ops-hardening`,
  `dev/v4-teacher-memory`.

## Active work queue

Two tiers, both in `.claude/plans/`:

- **V-tier (product-transforming) — do these to make the product substantially better.**
  Status: briefs being authored this session. See files `V*-*.md` and README "Vision tier".
- **T-tier (maintenance/polish) T01-T11** — still valid; several are prerequisites for V-tier
  (T02 asset diet before mobile/demo perf; T05 model bump trivially first; T09 streaming is
  folded into/related to V1).

## Session 2026-09-09 (later) — T06 shipped

Branch `dev/t06-persistent-cache`, PR into `deploy-prep`.

- **Merged `deploy-prep` in first.** Conflicts in `.claude/docs/state.md`,
  `.claude/plans/README.md` and this file — all resolved keeping both sides
  (`src/hooks/useLessonPlayback.ts` auto-merged cleanly; checked by hand that both the
  demoMode/TTS work and T06's `conceptId` threading survived). The stale 2026-07-13
  "USER ACTIONS NEEDED" block above was retitled rather than deleted: a newer section
  supersedes it and leaving it phrased as blocking would mislead the next session.
- **Bucket decision recorded: PUBLIC** (Hmz). It already existed — created live by the
  earlier T06 session via the Storage Admin API, not by migration 016. Note for future
  sessions: **the bucket is not in version control.** Migration 016 creates the table only,
  so a fresh Supabase project needs the bucket created by hand.
- **All four acceptance criteria verified live**, each probe run in its own process so L1 was
  genuinely cold: cold-instance L2 hit at 300 ms with **no new `usage_events` row** (vs
  3683 ms + a cost row to generate), and a wrong bucket name still let generation succeed
  (warn, no throw, fal URL served). $0.009 of real fal.ai spend; test rows and objects
  deleted afterwards.
- **Found and fixed a silent-breakage defect** the brief's failure-path criterion led
  straight to: a row does not prove the object exists, and `getPublicUrl` never checks, so
  row-present + object-deleted served a URL returning 400 *forever* — the row kept "hitting"
  so generation never re-ran. `lookupPersistedAsset` now confirms a hit with a bounded HEAD
  (1500 ms), drops the row and regenerates on a definitive 400/404, and fails open on
  anything else. ~100 ms per hit against ~3800 ms to regenerate. Reachable in practice:
  admin bucket cleanup is exactly what the previous T06 session did.
- Gates on the merge commit: `yarn type-check`, `yarn lint` (pre-existing warnings only),
  `yarn test` (76/76), `yarn build` — all green.

## Session 2026-09-09 (later) — Tripo3D swap + a 3.75x pricing error

Continues the T06 branch/PR. Hmz asked for a re-eval of the image + 3D pipeline before
committing spend, and explicitly asked for **no test generations** — so everything below is
desk research against fal's live pricing API and model pages, plus code.

- **Swapped `fal-ai/triposr` -> `tripo3d/tripo/v2.5/image-to-3d`** per T07. Code-complete,
  **deliberately unrun.** Cache prefix bumped, Y-up rotation removed, 240 s timeout added.
- **Found the fal pricing table understating the platform's biggest cost line by 3.75x.**
  `fal-ai/nano-banana-pro` was priced at $0.04, which is the *non-Pro* rate; fal charges
  $0.15. Every infographic cost figure in the cost dashboard — and in T07's own analysis —
  was low. Corrected and pinned by tests.
- **Use fal's pricing API, not the docs.** `GET https://api.fal.ai/v1/models/pricing?endpoint_id=<slug>`
  with the `FAL_KEY` returns authoritative live unit prices, costs nothing, and is the only
  source that agreed with itself. The docs pages and third-party comparisons were stale or
  contradictory. Note the returned `unit` varies — "images", "megapixels", "generations",
  "credits", even "compute seconds" — so read it, don't assume per-generation.
- **The re-eval's real conclusion is that the 3D model was never the expensive part.**
  Measured from `usage_events`, a concept costs ~4.5 NB Pro images ($0.68) against one 3D
  model ($0.07 before, $0.30 after). Images are ~70-90% of per-concept spend and had never
  been evaluated. `fal-ai/nano-banana-2` is $0.08, 2-3x faster, and rated better for
  infographic text — switching segment visuals to it saves more than the entire 3D upgrade
  costs. **Not done: it needs a visual A/B, which costs credits.** Queued as user action 10.
- Also surveyed and rejected for now: Tripo P1 ($0.40/$0.50, no evidence in hand vs v2.5),
  Hunyuan3D v3.1 pro, and ByteDance Seed3D v2 — Seed3D bills per *compute second*, which
  breaks the fixed per-concept cost model T06 is built around.

## Session 2026-09-09 (later) — T04 landing page rebuilt

Branch `dev/t04-landing-page` off `deploy-prep` (which was clean at `341ac81`), PR into
`deploy-prep`. **T04 is done** — ticked in `.claude/plans/README.md` and in the brief.

- **Designed before coded.** A multi-artboard design canvas (desktop 1440, mobile 390, and an
  alternate centred hero) was published and reviewed first:
  https://claude.ai/code/artifact/d0d76f20-e5f9-4051-8ee3-ea36eb68a1d5
  Hmz picked the split hero and supplied the footer contact address. Working files for
  re-seeding that canvas live only in the session scratchpad — to change it later, read the
  artifact back and `--extract` it rather than starting over.
- **Screenshots come from `/demo`, on a production build.** Not `/learn`: the demo renders the
  same classroom, avatar and lesson panel, but it is public, needs no session and calls no
  paid API, so it can be re-shot for free. Three stills in `public/images/landing/`. The
  capture rig was a dependency-free CDP driver (Node 22 has a global `WebSocket`, so no
  puppeteer/playwright install) — worth rebuilding if more product shots are ever needed.
  Two things it taught, for whoever needs shots next:
  - `next dev` is unreliable for this. It intermittently stopped serving the `DemoClient`
    dynamic chunk (the same wedge the 2026-09-08 session hit). `next build && next start`
    was stable across every run.
  - Give each Chrome an isolated `--user-data-dir` **and** port. Sharing a profile silently
    reattaches to the previous run's tab, which produced two rounds of confusing results.
- **The 3D shot had to be the black hole.** In the volcano lesson the generated mesh sits
  behind the 400px lesson panel; there is no crop that shows the model whole without cutting
  the panel out. The black-hole model stands clear of it with its labels legible.
- **framer-motion was deliberately not used**, even though the brief offered it:
  `react-intersection-observer` plus a CSS transition gives the same scroll reveal for ~2 kB
  instead of ~38 kB. `/` first-load JS is 120 kB, statically prerendered. Reasoning is in
  `.claude/docs/decisions.md`.
- **A `typescript-reviewer` pass on the diff caught two real things**, both fixed in
  `c18a167` before merge: the hero was wrapped in `Reveal` (start state `opacity: 0`), which
  gates the LCP candidate behind hydration plus the transition; and the observer fallback
  used a one-way module-scoped latch that a single slow load could trip, permanently
  disabling the animation for the rest of the tab. The fallback is now a per-element
  repeating rect check that clears once shown. Worth knowing if you touch `Reveal`: neither
  latch direction is safe, which is why it re-checks instead.
- **Gates all green** on the final tree: `yarn type-check`, `yarn lint` (22 warnings, all
  pre-existing, none in the new files), `yarn test` (83/83), `yarn build`.

**Pre-existing bug found while capturing, left unfixed on purpose:** `pages/_app.tsx` never
applies the Geist font variables (they are set on `<body>` in `src/app/layout.tsx`, which the
Pages Router never renders), so `/demo` and `/learn` fall back to the browser default serif
for bold text. One-line fix, but `/learn` was explicitly out of T04's scope — see the
2026-09-09 (T04) entry in `.claude/docs/state.md`. **It is visible in the shipped landing
screenshots**, so fixing it means re-capturing them.

Two smaller things left open by choice: no FAQ section (offered, not asked for), and
`LEGAL_LINKS` in `SiteFooter.tsx` is an empty array so the privacy/terms footer row renders
nothing until those routes exist.


## Session 2026-09-10 - 3D root cause, fonts, landing rebuild

Same branch, PR #4. Full detail in the 2026-09-10 entry of .claude/docs/state.md. The
short version: the demo models looked bad because Tripo's single-image path only textures
what one view sees; multi-view fixes it and is now wired behind a per-topic decision from
the teaching agent; glow topics opt out of 3D entirely; and the Pages Router finally has
its Geist font variables. The landing page was rebuilt a second time against the
design-taste audit.

**Next session is a visual identity pass**, briefed in
.claude/plans/T04b-landing-visual-identity.md. The structure is settled; the palette
(90% saturation against the skill's 80% ceiling), the wordmark and the missing dark mode
are not.

## Next session: T04b landing visual identity

Briefed in .claude/plans/T04b-landing-visual-identity.md. The page's structure is settled
and passes the design-taste pre-flight; its identity is not. Three decisions: the palette
(90% saturation against the skill's 80% ceiling), the typography (flat, sentence case
throughout), and dark mode (globals.css defines no dark values for any --aristo-* token).

One correction carried into that brief: the wordmark and the typography are INDEPENDENT.
An earlier version treated the logo as a reason to hesitate over restyling the type. It is
not; the logo is out of scope unless Hmz says otherwise.

## Steps still to take (checklist for any resuming session)

- [x] Finish V-tier briefs + update README with the vision tier (done 2026-07-12)
- [ ] User confirms execution order (recommended: T01 -> T05 -> V2+T02 -> V1 (+T09) -> V5 ->
      V4 -> T10 -> V6 -> V3 -> rest) and how to run tasks (separate cheap-model sessions, or
      subagents spawned from a main session — both work; briefs are model-agnostic)
- [ ] Execute T01 (git/docs consolidation — needs user push approval) early; it unblocks clean work
- [ ] Execute V/T tasks per README order; each executing session must tick the brief's checklist
      AND update this file's "What this session did" + queue status
- [ ] Batch UX-POLISH-BACKLOG.md items into any idle cheap session
- [ ] End-of-session rule: update this file + `.claude/docs/state.md` before stopping

## How to resume in a new session

Prompt suggestion:
> Read CLAUDE.md, .claude/plans/SESSION_HANDOFF.md, and .claude/plans/README.md.
> Continue from the "Steps still to take" checklist. Use the model specified in each brief.
