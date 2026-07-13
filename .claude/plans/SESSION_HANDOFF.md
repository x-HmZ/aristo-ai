# Session Handoff — living document

_Updated continuously. If you are a fresh session: read `CLAUDE.md`, then this file, then
`.claude/plans/README.md`. This tells you exactly where work stands and what to do next._

Last updated: 2026-07-12 (session: full audit + roadmap, then product-vision tier)

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
- **T06 persistent cache**: built on `dev/t06-persistent-cache` (pushed, UNMERGED).
  Bucket `generated-assets` created live (public, immutable cache headers). Code layered
  L1 memory -> L2 generated_assets -> fal, 3 s timeout guards, graceful fallback
  live-tested. MERGE BLOCKED: migration `016_generated_assets.sql` must be applied by hand
  (REST API cannot run DDL), then rerun the cache-hit probe.
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

## ADDITIONAL USER ACTION

7. **fal.ai balance is EXHAUSTED** ("User is locked") — production 3D/image generation will
   fail until topped up. This also blocks the TripoSR->Tripo3D swap confirmation.

## USER ACTIONS NEEDED (everything else is blocked on these)

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

## Repo state (as of this session, branch `dev/desk-quiz-3d-fixes`)

- Production = Vercel `deploy-prep` branch at aristo-ai-ten.vercel.app; `master` is stale/ancient.
- Current branch has 2 unpushed verified commits (desk quiz + camera fixes) + uncommitted:
  modified `CLAUDE.md`, new `.claude/docs/`, `TECHNICAL_SUMMARY.md`, `.claude/plans/`.
- Nothing from this session's plans has been executed as code yet.

## Active work queue

Two tiers, both in `.claude/plans/`:

- **V-tier (product-transforming) — do these to make the product substantially better.**
  Status: briefs being authored this session. See files `V*-*.md` and README "Vision tier".
- **T-tier (maintenance/polish) T01-T11** — still valid; several are prerequisites for V-tier
  (T02 asset diet before mobile/demo perf; T05 model bump trivially first; T09 streaming is
  folded into/related to V1).

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
