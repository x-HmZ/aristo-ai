# T10 — Ops Hardening (CI, email, admin, monitoring)

**Model:** sonnet | **Priority:** 5 | **Depends on:** T01

## Context

The app is deployed (Vercel, prod branch `deploy-prep`, Hobby plan) but several operational
loose ends from the deploy session were never closed, and there is no CI and no tests at all.

Known open items (from `.claude/docs/` + project memory, VERIFY each before acting — some may
have been done since):

1. **Resend not wired**: `RESEND_API_KEY` + `ADMIN_NOTIFY_EMAIL` (+ `APP_URL`) env vars not set
   in Vercel; the helper (`src/lib/email/resend.ts`) silently no-ops, so admin never hears about
   new signups.
2. **Admin bootstrap**: `aitchemmzi@gmail.com` is still `pending` in prod — the promotion SQL is
   in `DEPLOY.md` section 2.2 but was never run against Supabase project `thivgkbxgfchhystlyvh`.
3. **Migration 011** (`custom_teacher`) may not be applied — check `supabase/migrations/` against
   the live DB.
4. **No CI**.
5. **No error monitoring** in prod — client or server.
6. `.env.example` — verify it exists and covers every var the code reads (grep `process.env.`),
   including `ELEVENLABS_API_KEY`, `NEXT_PUBLIC_ADAPTIVE_VISUALS`, `NEXT_PUBLIC_AVATURN_SUBDOMAIN`,
   `GOOGLE_AI_KEY`, Resend vars.

## What to do

1. **CI** — `.github/workflows/ci.yml`: on PR + push to the production branch, run
   `yarn install --frozen-lockfile`, `yarn type-check`, `yarn lint`, `yarn build`
   (provide dummy `NEXT_PUBLIC_*` env vars needed for build; never real secrets).
   Node 20, yarn cache enabled.
2. **Resend**: walk the user through setting the three env vars (they hold the keys — do not
   ask them to paste secrets into chat; have them use the Vercel dashboard or `vercel env add`).
   Then verify: sign up a throwaway account -> admin email arrives, `admin_notified_at` set.
3. **Admin bootstrap**: surface the exact SQL from DEPLOY.md for the user to run (or run via
   Supabase MCP if available and user approves). Verify `/admin` access afterwards.
4. **Migration check**: list applied migrations vs `supabase/migrations/`; apply any missing
   (011 suspected) with user approval.
5. **Error monitoring**: add Sentry (`@sentry/nextjs`) with conservative sample rates
   (traces 0.1, replays off), DSN via env var, source maps on Vercel. Respect the Pages/App
   Router hybrid — Sentry's Next config wraps both; verify `/learn` still boots (R3F is
   sensitive to wrappers; if `next.config` wrapping causes issues, scope Sentry to
   server + App Router only and note it).
6. **Smoke tests** (cheap, high value): add 3-5 Vitest unit tests for pure logic only —
   BKT update (`src/lib/mastery/update.ts`), FSRS scheduler (`src/lib/srs/scheduler.ts`),
   profiler rules (`src/lib/agents/profiler.ts`). No LLM/network mocking rabbit holes.
   Wire `yarn test` into CI.

## Acceptance criteria

- CI green on a test PR; failing type-check blocks it.
- New-signup email verified end-to-end; admin account promoted; migrations reconciled.
- Sentry receiving a test error from prod (client + server) without breaking `/learn`.
- Unit tests pass locally and in CI.

## Do NOT

- Never commit or echo secrets. `.env*` stays untracked.
- Do not add heavy test infrastructure (no e2e framework in this task).

## Status checklist

- [x] CI workflow added (`.github/workflows/ci.yml`) — not yet green on a real PR (no push
      access from this session); runs type-check, lint, test, build on Node 20 with dummy
      build-time env vars.
- [ ] Resend live (email received) — runbook: `.claude/plans/T10-RUNBOOK.md` §1 (needs Vercel
      dashboard access + real Resend key).
- [ ] Admin bootstrapped — runbook: `.claude/plans/T10-RUNBOOK.md` §2 (needs SQL run against
      Supabase; account confirmed still `pending` this session, read-only check).
- [x] Migrations reconciled — read-only check against the live DB this session: all 15
      migration files are fully applied, nothing missing. See runbook §3 for the table.
- [ ] Sentry live — runbook: `.claude/plans/T10-RUNBOOK.md` §4 (deferred, needs a DSN + a
      decision on `/learn` wrapping risk).
- [x] Unit tests in CI — 4 Vitest files, 47 tests, pure-logic only (BKT, FSRS, profiler,
      pricing), wired into `yarn test` and the CI workflow.
