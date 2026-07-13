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

## NEEDS HUMAN VISUAL CHECK before merging wave-1 -> deploy-prep

Open the Vercel preview for `dev/roadmap-wave-1` (or local dev) and verify:
- [ ] Lipsync + gestures on all 4 avatars (compression kept morph data — confirm rendering)
- [ ] "Alt. Room" classroom switch (biggest structural compression: 269->96 meshes, 1024px textures)
- [ ] Marcus/Priya materials (dedup merged one duplicate texture each)
- [ ] Loading overlay on cold load (throttle network) + no double-flash on fast load
- [ ] One lesson generates end-to-end on Sonnet 5, then check /admin/cost attribution

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
