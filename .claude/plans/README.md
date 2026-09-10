# Aristo AI — Improvement Roadmap & Delegation Plan (2026-07-12)

Audit performed by Fable 5. Each brief in this directory is **self-contained** and designed
to be executed by a cheaper model in a fresh Claude Code session.

Two tiers:

- **V-tier (`V1`-`V6`) — product-transforming.** These change what the product is. Grounded
  by two code-exploration passes (student-facing UX inventory + conversational-teaching
  readiness audit) run 2026-07-12.
- **T-tier (`T01`-`T11`) — maintenance/polish.** Still necessary (perf, ops, content), and
  several are prerequisites for V-tier.

## Vision tier — what actually makes this a better product

| Brief | One-line thesis | Model | Size |
|-------|-----------------|-------|------|
| V1 raise-hand teacher | Student can interrupt and ask anything mid-lesson; teacher answers in context and resumes. Moves the product from "AI video player" to "AI tutor". Push-to-talk design (echo problem solved by construction). | opus | M-L |
| V2 instant public demo | "Try a live lesson" with zero signup, $0/visit (pre-generated lesson + pre-rendered TTS). Fixes the funnel the approval gate currently kills. | sonnet | M |
| V3 live blackboard | Worked examples written step-by-step on the board in sync with narration (LaTeX-capable). Makes the classroom pedagogically real — and cheaper than image gen for math. | opus | M-L |
| V4 teacher memory | Teacher greets you by name, recalls last session's struggle, targets your recorded misconceptions, celebrates comebacks. Data already exists; one Haiku call/day. | sonnet | M |
| V5 motivation loop | Server-authoritative XP/levels + in-scene celebration (teacher claps, confetti, spoken praise). The retention loop the app has zero of today. | sonnet | M |
| V6 parent weekly digest | Weekly progress email to the parent — the person who will actually pay. All ingredients exist. | sonnet | S-M |
| V7 alignment lipsync | Drive the avatar's mouth from ElevenLabs character timings instead of an FFT guess. Free on /learn (same characters); the demo uses Forced Alignment, billed as STT, so it costs no TTS quota. | sonnet | M |

Recommended V order: **V2 -> V1 -> V5 -> V4 -> V3 -> V6.** (V2 first: it makes everything
else demoable to real people; V1 is the flagship but bigger. V6 waits on T10's Resend wiring.)

Interleave with T-tier: T02 (asset diet) before or with V2; T05 (model bump) anytime early;
T09 (lesson streaming) pairs naturally with V1 since both touch useLessonPlayback — do T09
first or assign both to the same session.

## How to run a task

Open a new Claude Code session in this repo, set the model (`/model sonnet` or `/model opus`
as the brief's header says), then prompt:

> Read `.claude/plans/T##-<name>.md` and execute it exactly. Also read `CLAUDE.md` first.
> When done, update `.claude/docs/state.md` and the checklist at the bottom of the brief.

Rules that apply to EVERY task (repeated in briefs where critical):

1. Read `CLAUDE.md` at repo root before touching anything. The Pages Router constraint on
   `/learn` is inviolable.
2. Package manager is **yarn** (yarn.lock). Never npm/pnpm.
3. No emojis in code, comments, or commits. Small atomic commits, imperative mood, no AI attribution.
4. Model IDs only in `src/lib/agents/models.ts`. All Anthropic calls use `tool_use` with strict schemas.
5. Verify with `yarn type-check` and `yarn build` before declaring done.
6. Do not push to any remote unless the brief explicitly says pushing was pre-approved.
7. Work on the branch named in the brief (default: current working branch, ask user if unclear).

## Audit summary — what the project is and where it stands

**Goal (from spec + docs):** immersive 3D AI tutor for grades 6-8 — avatar teacher, 5-phase
lessons (Activate/Explain/Demonstrate/Challenge/Connect), behaviorally-adaptive profile,
BKT mastery + FSRS spaced repetition, knowledge-graph-driven curriculum, generated visuals
(Nano Banana Pro infographics) and 3D models (FLUX -> TripoSR).

**State:** all 9 build phases complete; deployed to Vercel (`aristo-ai-ten.vercel.app`,
production branch `deploy-prep`); adaptive-visuals pipeline, ElevenLabs TTS + lipsync,
gesture state machine, desk quiz, cost telemetry, lesson cache, approval gate all shipped.
The core learning architecture (BKT, FSRS, RAG, profiler, KG, tool_use everywhere,
local-first answer eval, per-call cost logging) is genuinely well designed — no rework needed.

**Verdict per area the audit covered:**

| Area | Verdict |
|------|---------|
| Teaching/knowledge mechanisms | Keep. BKT + FSRS + RAG + rule-based profiler is the right cost/quality balance. Gap: RAG is unseeded and KG content is thin (T11). |
| LLM models | Upgrade. `claude-sonnet-4-6` -> `claude-sonnet-5` for teaching/assessment (T05). Haiku 4.5 stays for fast paths — still the best cheap option. |
| 3D gen (TripoSR) | Weakest quality link. TripoSR is fast/cheap but produces blobby single-view meshes. Evaluate Trellis / Hunyuan3D on fal (T07) + make results persistent so a pricier model is paid once per concept, not per student (T06). |
| Avatars | Keep Ryan/Sonia/Marcus/Priya — swapping ecosystems (e.g. Ready Player Me) buys little for real migration cost. The problems are size (13.5 MB each, uncompressed) and load strategy, not the avatars themselves (T02). Optional polish: gaze/saccades (T08). |
| 3D environment | Static classroom GLB is a fine base; do not replace it. Add cheap dynamism: live blackboard content, ambient life, idle motion (T08). The 35 MB `classroom_alternative.glb` is the single worst asset (T02). |
| Load performance | Worst finding. `/learn` preloads ~78 MB of GLBs (both classrooms + all 4 avatars + anims), uncompressed, behind a blank-div loading fallback. Fix = compress + conditional preload (T02) + real loading screen (T03). |
| Landing page | **Rebuilt 2026-09-09 (T04)**: hero with a real classroom screenshot, how-it-works, feature grid, parents strip, footer. |
| App flow | Sign-up -> pending -> onboarding -> learn is sound. The killer wait is synchronous lesson generation (30-60 s of nothing). Fix = split-generation streaming (T09). |
| Ops | Branch sprawl (production on `deploy-prep`, `master` stale, current work unpushed), Resend not wired, admin not bootstrapped, no CI, no tests, docs drift (decisions.md says "Tripo3D"; actual model is TripoSR) (T01, T10). |

## Execution order

| Order | Task | Model | Why this order |
|-------|------|-------|----------------|
| 1 | T01 repo + docs consolidation | sonnet | Unblocks everything; needs user push approval |
| 2 | T05 LLM model bump | sonnet | 20-minute task, immediate quality win |
| 3 | T02 3D asset diet | sonnet | Biggest perf win; other 3D tasks build on it |
| 4 | T03 /learn loading experience | sonnet | Pairs with T02 |
| 5 | T10 ops hardening (CI, Resend, admin) | sonnet | CI protects all later work |
| 6 | T09 lesson streaming | **opus** | Flagship UX fix; design included in brief |
| 7 | T06 persistent generation cache | sonnet | Prereq for affording a better 3D model |
| 8 | T07 3D gen model evaluation | sonnet | Produces a decision, not code; report back |
| 9 | T04 landing page rebuild | sonnet | Independent; do anytime |
| 10 | T08 dynamic classroom pass | opus or sonnet | Immersion polish after perf is fixed |
| 11 | T11 content seeding (KG + RAG) | sonnet | Makes the product demonstrable end-to-end |

Tasks 2-5 and 9 are independent of each other and can run in parallel sessions.

## Backlog (not briefed yet — revisit after the above)

- **Payments**: swap `requireApproved()` body for Stripe subscription check (design decision recorded in `.claude/docs/architecture.md`).
- **Mobile**: `/learn` on phones — 3D perf budget, touch controls, layout. Needs its own audit.
- **Strict CSP**: skipped during deploy hardening; R3F + Supabase Realtime need tuning.
- **Custom domain** + promote Vercel production branch to `master` (after T01).
- **Whisper STT / realtime voice** (spec Phase 10): Web Speech works; revisit when ElevenLabs spend or quality complaints justify it.
- **Shared sessions** via Supabase Realtime (spec Phase 10).
- **Per-topic generated environments** (replace classroom per subject): expensive, cool, later.
- **Animation quality rebuild**: current constraint-retargeted `animations_Avaturn.glb` is good; a per-avatar rebuild is optional polish only.

## Task status

- [ ] V1 raise-hand teacher
- [x] V2 instant public demo (2026-07-13 — 2 lessons not 3 per cost/quota gate. TTS revisited
      2026-09-08: narration is now 30 pre-rendered ElevenLabs mp3s under public/demo/, which
      restored lipsync the speechSynthesis path could not do. Demo avatar forced to marcus.
      Still UNMERGED — see SESSION_HANDOFF.md)
- [ ] V3 live blackboard worked examples
- [ ] V4 teacher memory
- [ ] V5 motivation loop
- [ ] V6 parent weekly digest
- [~] V7 alignment-driven lipsync (2026-09-08 — both paths code-complete + unit-tested,
      neither exercised against the live API. /learn needs nothing run. /demo is blocked on
      enabling the key's `forced_alignment` permission, then `--align`.)
- [ ] UX polish backlog (batched — see UX-POLISH-BACKLOG.md)
- [x] T01 repo + docs consolidation (2026-07-12 — master promotion still pending Vercel dashboard switch)
- [x] T02 3D asset diet
- [x] T03 /learn loading experience
- [x] T04 landing page rebuild (2026-09-09)
- [x] T05 LLM model bump
- [x] T06 persistent generation cache (2026-09-09 — DONE: migration 016 applied, public
      `generated-assets` bucket, L1->L2->fal layering; cold-instance hit proven with no new
      `usage_events` row, storage-failure path proven, stale-row self-heal added)
- [x] T07 3D gen model evaluation (2026-07-13 — report in T07-REPORT.md). **Swap implemented
      2026-09-09** on `dev/t06-persistent-cache`: Tripo3D v2.5 live in banana.ts, pricing table
      corrected. Unverified against fal (credit conservation) — confirm on first real lesson.
- [ ] T08 dynamic classroom pass
- [ ] T09 lesson streaming
- [ ] T10 ops hardening (autonomous parts done 2026-07-13 — CI + tests + migration
      reconciliation + .env.example shipped on `dev/t10-ops-hardening`; Resend/admin
      bootstrap/Sentry are user-dependent, see `.claude/plans/T10-RUNBOOK.md`)
- [ ] T11 content seeding
