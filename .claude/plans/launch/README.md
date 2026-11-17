# Launch readiness programme (started 2026-11-16)

Goal: get Aristo from "works behind a manual approval gate" to "strangers can sign up, use a capped free allowance,
and nothing leaks, breaks the law, or drains the owner's credits". Payments are designed and built in a sandbox;
they are switched on only after the owner's legal status is settled.

**Any model can resume from this file.** Read it, then the one brief you are executing, then only the findings
file that brief names. Do not re-audit: the audits are done and recorded under `findings/`.

## Decisions taken with the owner (2026-11-16) - do not re-ask

| Topic | Decision |
|---|---|
| Launch shape | Early access, not "a complete app": open sign-up, small free allowance, hard spend caps, paid plan later. The manual approval gate goes away. |
| Who can sign up | Any learner. Below the age of digital consent the account belongs to a parent, who adds the learner. |
| Legal status | No company. Plan around a merchant of record; **no money is taken until the owner has confirmed in writing that he may sell** (`findings/payments-research.md`, kept local and untracked on purpose). |
| Domain | None yet; will buy one only if needed. Capital is close to zero: nothing in this programme may add a recurring cost without the owner's yes. |
| Out of scope for now | Better animations, voices and 3D models (cost capital). |
| Paid API calls | None for testing without the owner's go-ahead for that run. Verify on free routes (`/demo`, `/dev/*`), every `/api` request aborted. |

## Findings (audits run 2026-11-16)

| File | What it holds |
|---|---|
| `findings/vercel-storage.md` | Why Vercel warned about Function Storage (the portfolio project, not Aristo) and the fix |
| `findings/security.md` | Security and cost-abuse audit, ranked |
| `findings/dead-code.md` | Unused deps, files, assets, branches, docs; removal batches |
| `findings/compliance.md` | Data inventory, processors, GDPR / COPPA / AI Act, age and parent model, legal-page outlines |
| `findings/payments-research.md` | Stripe vs merchant of record for an individual in Austria, tax and permit questions, hosting terms |
| `findings/product-cost.md` | User journey gaps, unfinished features, cost per lesson, free-allowance designs |

## Order of work and status

Three gates. Do not start a gate's "open" step until everything above it is done.

| # | Brief | Gate | Model | Size | Status |
|---|---|---|---|---|---|
| L01 | Close the live holes | now (production is exposed today) | done by Fable | S | code done on `fix/launch-critical`; migration 018 NOT applied to production yet |
| L02 | Dependency patch (Next 15.5.x, openai, anthropic sdk) | now | sonnet | S | open |
| L03 | Dead-code removal in batches | now | sonnet | M | open |
| L04 | Spend guard, attribution, input caps | before sign-ups open | opus plans, sonnet wires | M-L | open |
| L05 | Database write lockdown and Zod on the remaining routes | before sign-ups open | sonnet + security-reviewer | M | open |
| L06 | Accounts: age rule, parent-owned learners, consent, deletion, password reset | before sign-ups open | opus | L | open, needs owner decisions D2, D3 |
| L07 | Entitlements: free allowance replaces the approval gate | before sign-ups open | opus | M-L | open, after L04 |
| L08 | Cost cuts: audio cache, quiz cache, shared lesson signature, catalogue | before sign-ups open | sonnet | M-L | open; catalogue generation needs the owner's go-ahead per run |
| L09 | Legal pages, AI label, voice claim, documents (DPIA, records, retention, breach) | before sign-ups open | opus drafts, owner reviews | M | open |
| L10 | Dead screens, error pages, landing copy, SEO, feedback channel, monitoring | before sign-ups open | sonnet | M | open |
| L11 | Content: what the catalogue offers on day one | before sign-ups open | owner decision D4, then sonnet | L | open |
| L12 | Ops: provider spend limits, regions, DPAs, email sender, branches, PR 29 | owner, mostly dashboards | owner + sonnet | S each | open |
| L13 | Payments in a sandbox behind an off switch | before the first payment | opus | L | blocked on the owner's written clearance to go live; buildable any time after L07 |
| L14 | Before marketing: checklist | after sign-ups open | owner + any | S | open |

### L01 Close the live holes (branch `fix/launch-critical`)
Findings: `security.md` C1, C2, H5, M2. Done in code:
- `supabase/migrations/018_lock_privileged_columns.sql`: trigger that stops end-user roles changing `is_admin`,
  `approval_status`, `approved_at`, `approved_by`, `admin_notified_at`, `id` on their own `profiles` row;
  `increment_misconception()` now refuses another user's id and sets `search_path`.
- `src/app/api/quiz/route.ts` deleted (no sign-in check, no caller, called Haiku).
- `src/app/api/whisper/route.js`, `src/app/api/openai-tts/route.js`: now require an approved user, cap input size,
  return generic errors. Kept because `CLAUDE.md` says to leave them; deleting them is owner decision D1.
- `src/app/auth/callback/route.ts`: `next` goes through `src/lib/auth/safeNextPath.ts` (tested).
Left to do: apply migration 018 in the Supabase SQL editor (project ref in `CLAUDE.md`), run the check at the bottom of
the file with a non-admin account, merge the branch. **Until 018 is applied, any signed-in user can make themselves admin.**

### L02 Dependency patch
Findings: `security.md` H3. `yarn upgrade next@^15.5` to the newest 15.5.x (stay on 15), `openai` to a 4.x with
`form-data >= 4.0.6`, `@anthropic-ai/sdk` latest 0.x. Then `yarn type-check`, `yarn test`, `yarn build`, and drive `/demo`
with the headless scripts in `.claude/eval/2026-10-16-portfolio/scripts/` (R3F breaks first if React aliasing changed).
Check whether `typescript.ignoreBuildErrors` in `next.config.mjs` is still needed on the new version. Add
`yarn audit --level high --groups dependencies` to `.github/workflows/ci.yml` as a non-blocking step first.

### L03 Dead-code removal
Findings: `dead-code.md` (use its 10 batches in order; one commit per batch; `yarn type-check && yarn test && yarn build`
after each). Never delete a branch or a file marked "needs owner" without asking. Safe without a decision: 8 unreferenced
packages (`@google/generative-ai`, `leva`, `react-responsive-carousel`, `react-scroll`, `react-intersection-observer`,
`react-hot-toast`, `@tanstack/react-table`, `@tabler/icons-react`), 12 unreachable shadcn wrappers and the radix
packages only they use, `src/utils/cn.js`, `src/utils/modelLoader.js`, `src/app/admin/GoogleCharts.jsx`, `jsconfig.json`,
dead store members and exports, three unused routes, declaring `uuid` and `three-stdlib` (imported, not in
`package.json`), stale `.vercelignore` lines, the personal email in `.claude/plans/T10-RUNBOOK.md`. Docs: `README.md` is a
placeholder, `DEPLOY.md` and `TECHNICAL_SUMMARY.md` are stale, `spec_index.md` named in `CLAUDE.md` does not exist in the
repo; archive the roughly 35 finished files in `.claude/plans/` and cut `state.md` (1880 lines) to the last few entries.
Needs the owner (D6-D8): archived avatar GLBs (26 MB in `public/`), `/create-teacher` with `@avaturn/sdk`, retiring the
`NEXT_PUBLIC_ADAPTIVE_VISUALS` flag and the legacy lesson path. Disk only, not in git: `.claude/eval` is 11 GB and
`.claude/worktrees` 6.9 GB; list what is in them and ask before deleting.

### L04 Spend guard, attribution, input caps
Findings: `security.md` C3, H1, H2, M1, M6, M7; `product-cost.md` A2, A4. Build one guard, `requireBudget(user, feature)`,
called right after the auth guard on every paid route: per-user counters per feature and a per-user daily budget summed
from `usage_events.cost_usd_micros`, plus a global daily circuit breaker that returns 503. Copy the DB-backed pattern in
`src/app/api/learn/interactive/route.ts`. Thread `userId` into every Anthropic call tag and log ElevenLabs characters as
usage rows (add the provider and a price to `src/lib/llm/pricing.ts`; the owner supplies the real rate). Replace the
in-memory TTS throttle. Lesson and quiz routes accept only a `conceptId` that exists; `generate-model/3d` accepts only
image URLs this app produced; strip query strings before hashing; cap every prompt and history length with Zod (add the
`zod` dependency here). Budget numbers come from L07's allowance design. `security-reviewer` before merge.

### L05 Database write lockdown and Zod everywhere else
Findings: `security.md` H4, H6, M5, M8, L1-L8. Move quiz, mastery, session and misconception writes to server-only
paths and revoke direct writes for `authenticated`; `decideModeration` counts distinct users; server-side quiz grading
(the client must not send `correctAnswer`); Zod on every remaining route and server action; `src/lib/env.ts` parses env
once; `/dev/*` returns 404 in production; the draft CSP from `security.md` in report-only mode first.

### L06 Accounts
Findings: `compliance.md` (account and age model section, items 4-7, 12, 13, 15), `security.md` M3, M4, section 9;
`product-cost.md` A8. Sign-up asks for an age band. Under the threshold (D2) the account is a parent's: new `learners`
table, the parent adds a learner (nickname and grade, not a full name), a consent record with timestamp and policy
version. For child learners voice input, free chat and the custom (selfie) teacher start off. Password reset, confirmed
email required, Cloudflare Turnstile on sign-up (free), self-service delete and export that also scrub
`usage_events.metadata` and the audit log. Plan in plan mode first: it changes the schema every learner table hangs off.

### L07 Entitlements
Findings: `product-cost.md` Part 1 ("what removing the approval gate touches": 17 `requireApproved` call sites,
`pages/learn.tsx:82-91`, migration 015, `/pending`, admin approve UI) and Part 2 (allowance designs).
Recommended design: catalogue-first. Cached catalogue lessons are free to replay; each account gets a small number of
fresh generations and chat turns per month; 3D generation is not in the free allowance. `requireEntitlement()` replaces
`requireApproved()` at the same call sites and is checked on the cache-miss branch only. Tables: `plans`,
`entitlements` (plan, status, period), usage read from `usage_events`. Keep a provider-agnostic `src/lib/billing/`
interface so L13 plugs in. Keep an admin override (the approve UI becomes "grant allowance / suspend").

### L08 Cost cuts
Findings: `product-cost.md` Part 2 and "first two weeks". Server-side audio cache keyed by text, voice and model in the
existing `generated-assets` layering (today every playback pays ElevenLabs again); quiz cache per concept; one shared
`profile_signature` for free users so lessons hit the cache; pre-generate the launch catalogue with audio. Generating
costs credits: list what a run will cost and get the owner's go-ahead before each run.

### L09 Legal pages and documents
Findings: `compliance.md` (outlines for privacy policy, terms, imprint; must-have items 3, 8-11, 14, 17),
`payments-research.md` part E. Pages under `src/app/(legal)/`: `/privacy`, `/terms`, `/imprint`, a parent notice; link
them in `SiteFooter.tsx` (`LEGAL_LINKS` is empty) and at sign-up. Visible "Jake is an AI" label in the lesson UI. Fix the
landing claim that voice input stays in the browser (Chrome sends audio to Google). Replace the personal Gmail address
with a role address. Documents in `docs/compliance/`: DPIA, record of processing, retention schedule, breach runbook.
Drafts are the model's; the owner reads every page before it ships and should have the privacy policy checked by
someone qualified. Imprint needs the owner's name and town (free beta) - never invent these.

### L10 Resilience and first-impression fixes
Findings: `product-cost.md` A5, A9, A11 and "first two weeks". A failed lesson shows an error with Retry instead of
"Loading your lesson..." forever (`useCourseAutoTeach.ts:57-65`); quiz, 3D and TTS failures say what happened and the
lesson continues without that piece; `error.tsx` and `global-error.tsx`; landing copy no longer says accounts are
approved by hand; canonical URL from `APP_URL` not a hardcoded host; `sitemap.ts`, `robots.ts`; a feedback link; WebGL
and small-phone fallback; hide MJ until she has a voice, hide the custom teacher and the mic by default. Error
monitoring: Sentry's free tier or Vercel's built-in logs (owner picks; no paid plan).

### L11 Content
Findings: `product-cost.md` A7, A10. Onboarding offers Python and "science", but only Python is seeded (38 concepts) and
no science domain exists. Decision D4 first, then seed and pre-generate.

### L12 Ops (owner actions, each a few minutes)
1. Set a hard monthly spend limit in the Anthropic, OpenAI, fal.ai and ElevenLabs dashboards. This is the cheapest
   protection there is and does not wait for any code.
2. Apply migration 018 (L01). Bootstrap the admin row (`.claude/plans/T10-RUNBOOK.md` section 2) if not done.
3. Turn on 2FA for Vercel, GitHub and Supabase.
4. Supabase: confirm "Confirm email" is on; note the project region. Then set the Vercel function region next to it.
5. Accept the DPAs (Supabase, Vercel, Anthropic, OpenAI, fal, ElevenLabs, Resend) and switch off training on
   ElevenLabs data (`compliance.md` item 9).
6. Decide on PR 29 (`fix/classroom-ux`), then delete the merged remote branches listed in `dead-code.md`.
7. A domain is needed for a proper email sender and for any payment provider's review; not needed for a free beta.

### L13 Payments (sandbox only)
Findings: `payments-research.md`, `compliance.md` "before first payment". Paddle sandbox behind `BILLING_ENABLED=false`:
checkout redirect, signature-verified webhook, customer portal link, parent-only subscribe, withdrawal and cancellation
buttons, pre-contract information. Nothing here goes live without the owner's written clearance on self-employment,
a host plan that allows commercial use, and Paddle's written answer on minors, exam-prep wording and the domain.

### L14 Before marketing
Analytics that needs no consent banner; a feedback loop the owner actually reads; a 60-second demo clip; pricing tested
with ten real parents before any price is published; a waiting list with explicit consent; the Claude for Startups
programme (knowledge-tree node `claude-for-startups`); Strix or the Cloudflare security-audit skill against a preview
deployment once L04-L06 are in (both cost model tokens: ask first).

## Owner decisions still open

| # | Question | Recommendation |
|---|---|---|
| D1 | Delete the unused Whisper and OpenAI-TTS routes? `CLAUDE.md` says keep; both audits say delete. | Delete; they are 40 lines each and stay in git history. |
| D2 | Age below which a parent must own the account | 16: covers every EU state (Austria is 14, the GDPR maximum is 16) and the US rule (13). |
| D3 | Is a learner's first name or nickname enough (drop "Full name")? | Yes. |
| D4 | Day-one catalogue: Python only, or build a science track first? | Python only; remove "science" from onboarding until it exists. |
| D5 | Free allowance numbers | Catalogue replays free; 2 fresh lessons and 15 chat turns a month; no 3D. About 1 USD worst case per user per month. |
| D6 | Move the four archived teachers' GLBs (26 MB) out of `public/`? `CLAUDE.md` keeps them on purpose. | Move to `assets-src/`, keep the config entries; copying back re-enables them. |
| D7 | `/create-teacher` (selfie avatar via Avaturn): ship, hide or cut? Without its env var it shows developer text to the public. | Cut for launch: it is the riskiest feature for children's data and nobody can reach it properly today. |
| D8 | Retire the `NEXT_PUBLIC_ADAPTIVE_VISUALS` flag and the legacy lesson path it guards? | Yes, after confirming production has it set to `true`. |
| D9 | Delete the 31 remote and 33 local branches already merged into `deploy-prep`, the two old worktrees and the `friend` remote? | Yes; keep `dev/v4-teacher-memory` (5 unmerged commits of finished work). |

## Tools and agents used (nothing new needs installing)

Existing subagents cover the pipeline: `planner` for L04/L06/L07 designs, `security-reviewer` before every merge that
touches auth, data or routes, `typescript-reviewer` and `code-reviewer` after each change, `build-error-resolver` for
broken builds, `code-simplifier` after L03. From the knowledge tree: `security-audit-skill` (Cloudflare) and `strix`
are worth one run against a preview deployment after L06, not before (heavy on tokens; a full audit already exists in
`findings/security.md`); `launch-legal-checklist` is folded into L09 and L10.

## Rules for every brief

1. Read `CLAUDE.md` first. `/learn`, `/`, `/demo`, `/dev/*` stay in the Pages Router.
2. yarn only. No emojis. Small atomic commits, imperative mood, no AI attribution lines.
3. Model IDs only in `src/lib/agents/models.ts`. Zod on every external input. Anthropic calls use `tool_use`.
4. Each brief names its branch. Finish with `yarn type-check`, `yarn test`, `yarn build`; say what was not verified.
5. `security-reviewer` before anything touching auth, learner data or API routes is merged.
6. Update the status table here and `.claude/docs/state.md` when a brief is done.
7. Never delete a branch, a deployment, a database row or a storage object without the owner's yes for that item.
