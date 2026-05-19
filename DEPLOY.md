# Deploying Aristo AI to Vercel

This is the operator runbook for the first production deploy. Everything
in here is one-time setup; routine deploys are just `git push` of a
new commit on the production branch.

---

## 1. Environment variables

Every value below goes into **Vercel → Project Settings → Environment
Variables**. Tick **Production** and **Preview** for everything (some
should only be in Production — noted where it matters).

| Name | Scope | Source |
|------|-------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Prod + Preview | Supabase dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Prod + Preview | Supabase dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Prod + Preview | Supabase dashboard → Settings → API (server-only — bypasses RLS) |
| `ANTHROPIC_API_KEY` | Prod + Preview | console.anthropic.com → API keys |
| `OPENAI_API_KEY` | Prod + Preview | platform.openai.com → API keys (used by RAG embeddings + Whisper STT) |
| `GOOGLE_AI_KEY` | Prod + Preview | aistudio.google.com → API keys |
| `ELEVENLABS_API_KEY` | Prod + Preview | elevenlabs.io → Settings → API |
| `FAL_KEY` | Prod + Preview | fal.ai → Dashboard → Keys (note: `FAL_KEY`, NOT `FAL_API_KEY`) |
| `RESEND_API_KEY` | Prod + Preview | resend.com → API keys |
| `ADMIN_NOTIFY_EMAIL` | Prod + Preview | aitchemmzi@gmail.com (or whichever inbox should get "new signup" alerts) |
| `RESEND_FROM` | optional | `Aristo AI <noreply@your-verified-domain.com>`. Skip on first deploy — defaults to Resend's sandbox `onboarding@resend.dev`. |
| `APP_URL` | Prod only | The canonical URL, e.g. `https://aristo.vercel.app`. Used to build admin links in emails. Vercel auto-supplies `VERCEL_URL` for previews if this is unset. |
| `NEXT_PUBLIC_AVATURN_SUBDOMAIN` | Prod + Preview | Avaturn iframe subdomain. Public — safe in the client bundle. |
| `NEXT_PUBLIC_ADAPTIVE_VISUALS` | Prod + Preview | `true` to enable per-segment adaptive visuals (Phase E). |

⚠️ **Never** prefix server secrets with `NEXT_PUBLIC_`. That makes them
visible in the browser bundle.

---

## 2. Supabase one-off setup

### 2.1 Run the new migration

In the Supabase SQL editor, run [`supabase/migrations/015_user_approval.sql`](supabase/migrations/015_user_approval.sql).
This adds the approval gate columns (`approval_status`, `approved_at`,
`approved_by`, `admin_notified_at`) on `profiles`.

### 2.2 Bootstrap the first admin

After your own account exists in `auth.users` (sign up at least once on
the deployed app, or do it locally against the production Supabase
project), promote it:

```sql
UPDATE profiles
SET is_admin = true,
    approval_status = 'approved',
    approved_at = NOW()
WHERE id = (SELECT id FROM auth.users WHERE email = 'aitchemmzi@gmail.com');
```

From this point on, every other signup will land in `pending` and you
approve them via `/admin/users`.

### 2.3 Site URL + redirect URL

Supabase → Authentication → URL Configuration:

- **Site URL**: `https://<your-vercel-domain>`
- **Redirect URLs**: add `https://<your-vercel-domain>/auth/callback` and
  the Vercel preview wildcard `https://*-x-hmz-projects.vercel.app/auth/callback`.

Without this, the email confirmation link sends users to localhost.

---

## 3. Resend setup

1. Create an account at resend.com.
2. Generate an API key → paste as `RESEND_API_KEY` in Vercel.
3. Set `ADMIN_NOTIFY_EMAIL=aitchemmzi@gmail.com`.
4. **Optional**: verify a sending domain to remove the Resend sandbox
   notice on outbound emails. Until then, Resend's sandbox domain is fine
   for the volume of admin notifications we expect.

---

## 4. First deploy

1. Push the `deploy-prep` branch to GitHub.
2. In Vercel → Add New Project → import the repo. Framework should
   auto-detect Next.js.
3. Add every env var from §1 before the first build.
4. Click Deploy. The first build pulls all deps and bundles the avatar
   GLBs (~86 MB total in `public/models/`) — give it ~5 minutes.

When the deploy is green, the preview URL is your QA target.

---

## 4a. Pre-push verification (run locally)

Before pushing to Vercel:

```sh
yarn type-check     # tsc --noEmit — must be clean (this is the real type gate)
yarn build          # next build — must succeed
```

`next.config.mjs` sets `typescript.ignoreBuildErrors: true` as a workaround
for [vercel/next.js#82877](https://github.com/vercel/next.js/issues/82877)
(the Next 15.5 page-export validator drops `src/` from generated import
paths). `yarn type-check` is the authoritative type gate; remove the
workaround when the upstream fix lands.

---

## 5. Smoke test the preview

Before promoting to production:

- [ ] Sign up with a fresh email → land on `/pending`. Confirm the page renders.
- [ ] Confirm `aitchemmzi@gmail.com` receives the "new signup" Resend email.
- [ ] Try to hit `/learn` directly — should bounce to `/pending`.
- [ ] Try `GET /api/learn/next` with the pending user's cookie — 403.
- [ ] Sign in as the bootstrap admin → `/admin/users` shows the new user
      with status **pending** and Approve / Reject buttons.
- [ ] Approve them → confirm the user receives a "you're in" email and
      can now reach `/learn`.
- [ ] Run one full lesson + quiz + 3D-model generation through the UI to
      verify all paid APIs (Anthropic, OpenAI, fal.ai) connect.
- [ ] `curl -sI https://<preview-url>/` — confirm `X-Frame-Options`,
      `Strict-Transport-Security`, `Referrer-Policy` headers are present,
      `X-Powered-By` is absent.

Then promote to production in Vercel.

---

## 6. Rollback

If the deploy goes wrong:

- **Code**: revert to the checkpoint commit on `adaptive-visuals`:
  `git checkout adaptive-visuals && git push origin adaptive-visuals --force-with-lease`
  *(only if you've already pushed; the local-only commit `a7ca7ca` is
  the safety net)*.
- **DB migration**: `015_user_approval.sql` is additive only (new
  columns with defaults). To undo:
  ```sql
  ALTER TABLE profiles
    DROP COLUMN IF EXISTS approval_status,
    DROP COLUMN IF EXISTS approved_at,
    DROP COLUMN IF EXISTS approved_by,
    DROP COLUMN IF EXISTS admin_notified_at;
  ```
- **Vercel**: use the Deployments tab to instantly roll back to the
  previous green deploy. No code change needed.

---

## 7. Replacing the approval gate later

When you wire up Stripe / subscriptions, the simplest swap is:

1. Replace `requireApproved()` in `src/lib/auth/approval.ts` with a
   subscription check.
2. Remove the `/pending` page (or repurpose it as the "subscribe" page).
3. Keep the middleware redirect — it becomes the paywall.

The DB columns can stay (or be dropped) — they're invisible once the
gate logic moves to a billing check.
