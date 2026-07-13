# T10 Runbook — user-dependent steps

The autonomous parts of T10 (CI, unit tests, migration reconciliation, `.env.example` audit)
are done on `dev/t10-ops-hardening` — see the checklist in `T10-ops-hardening.md`. The steps
below need Hmz to act (dashboard access, real secrets, or a decision) and were out of scope
for the agent session. Nothing in this file has been executed against Vercel or Supabase.

---

## 1. Wire Resend (admin gets notified of new signups)

`src/lib/email/resend.ts` silently no-ops today because these three vars are unset in Vercel.

**Add in Vercel → Project Settings → Environment Variables** (Production + Preview):

| Name | Value | Source |
|------|-------|--------|
| `RESEND_API_KEY` | your Resend API key | resend.com → API Keys |
| `ADMIN_NOTIFY_EMAIL` | `aitchemmzi@gmail.com` | the inbox that should get "new signup" alerts |
| `APP_URL` | `https://<your-production-domain>` | pins absolute links in emails instead of relying on Vercel's auto `VERCEL_URL` |

Optional: `RESEND_FROM="Aristo AI <noreply@your-verified-domain.com>"` once a sending domain is
verified in Resend; until then the Resend sandbox `onboarding@resend.dev` is fine.

Via CLI instead of the dashboard, from the repo root (requires `vercel login` +
`vercel link` once):

```sh
vercel env add RESEND_API_KEY production
vercel env add RESEND_API_KEY preview
vercel env add ADMIN_NOTIFY_EMAIL production
vercel env add ADMIN_NOTIFY_EMAIL preview
vercel env add APP_URL production
```

Each prompts for the value interactively — never pass secrets as a CLI argument or paste them
into chat.

**Verify end-to-end** (after redeploying so the new env vars take effect):

1. Sign up with a throwaway email on the production URL.
2. Confirm `aitchemmzi@gmail.com` receives the "new signup" email.
3. In Supabase → Table Editor → `profiles`, confirm the new row has `admin_notified_at` set
   (non-null) — that's the code's own confirmation the send succeeded, not just that Resend
   accepted it.

---

## 2. Bootstrap the first admin account

Confirmed via a read-only check against the live DB during this session: `aitchemmzi@gmail.com`
exists in `auth.users` but its `profiles` row is still `is_admin: false`,
`approval_status: 'pending'`. This is the exact SQL from `DEPLOY.md` §2.2 — run it in the
Supabase SQL editor for project `thivgkbxgfchhystlyvh`:

```sql
UPDATE profiles
SET is_admin = true,
    approval_status = 'approved',
    approved_at = NOW()
WHERE id = (SELECT id FROM auth.users WHERE email = 'aitchemmzi@gmail.com');
```

**Verify**: sign in as that account → `/admin/users` should load and show the admin's own
account approved; any other pending signups show Approve/Reject buttons.

---

## 3. Migrations

Read-only reconciliation was run against the live DB this session (project
`thivgkbxgfchhystlyvh`, table/column/function existence probes — no writes). Result: **every
migration file in `supabase/migrations/` is fully applied**, including `011_custom_teacher.sql`
(`learner_profiles.custom_teacher_glb_url` exists) and `015_user_approval.sql` (all four
approval-gate columns exist). The full table is in the session's final report / commit message
context; short version:

| Migration | Status |
|---|---|
| 001–015 (all files) | Applied — confirmed present in live schema |

**Nothing to run.** `.claude/docs/state.md`'s "All run; no pending" note was correct; the
brief's suspicion about 011 was unfounded. No action needed here.

---

## 4. Sentry (deferred — needs a DSN)

Not started this session — needs a decision + a DSN, both outside agent scope. When ready:

1. Create a Sentry project (sentry.io, or self-hosted) → Next.js platform → copy the DSN.
2. `yarn add @sentry/nextjs`.
3. `npx @sentry/wizard@latest -i nextjs` (interactive; sets up `sentry.client.config.ts`,
   `sentry.server.config.ts`, `sentry.edge.config.ts`, wraps `next.config.mjs`).
4. **Watch for the `/learn` Pages Router exception** (see root `CLAUDE.md`): Sentry's Next.js
   config wrapper touches `next.config.mjs`, which is shared by both routers. If wrapping breaks
   the R3F boot on `/learn` (blank canvas / console error about `react-reconciler`), scope Sentry
   to server + App Router only:
   - Keep `sentry.server.config.ts` and `sentry.edge.config.ts`.
   - Skip `sentry.client.config.ts`, or gate its `Sentry.init()` call behind
     `typeof window !== "undefined" && !window.location.pathname.startsWith("/learn")`.
   - Note the scoping decision in `.claude/docs/decisions.md` if you take this path.
5. Conservative sampling: `tracesSampleRate: 0.1`, `replaysSessionSampleRate: 0` (replays off).
6. Env vars: `SENTRY_DSN` (server) / `NEXT_PUBLIC_SENTRY_DSN` (client) in Vercel, Production +
   Preview. Also enable source maps upload (`SENTRY_AUTH_TOKEN`, org/project slugs) so stack
   traces resolve to real source, not the minified bundle.
7. Verify: throw a test error from a server route and from a client component; confirm both
   land in the Sentry dashboard, then confirm `/learn` still boots correctly (this is the one
   regression that matters most here).
8. Add `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` to `.env.example` once wired.

---

## Quick reference

- Vercel project: `aristo-ai-ten.vercel.app`, production branch `deploy-prep`.
- Supabase project ref: `thivgkbxgfchhystlyvh`.
- Full env var list + one-line descriptions: `.env.example` at repo root (refreshed this
  session).
