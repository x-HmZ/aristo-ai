# What only the owner can do (state on 2026-11-17)

Everything that could be done without the owner is done: built, merged on `feat/launch-features`, type-checked,
unit-tested, built, and security-reviewed twice. This file lists what is left, in the order to do it.

Already on production (`deploy-prep`): the security fixes (PR 30) and the dependency patch with the dead-code
removal (PR 31). Migrations 018 to 021 are applied and checked (39 behavioural checks passed on 2026-11-16).

## A. To get the new code onto production (about 15 minutes)

Order matters. Doing 024 early silently loses quiz and progress saves; deploying before 025 breaks sign-up.

1. Supabase SQL editor: run `supabase/migrations/023_spend_guard.sql`, then `supabase/migrations/025_account_lifecycle.sql`.
2. Merge the pull request for `feat/launch-features` into `deploy-prep` (or ask for it to be merged once the checks pass). Wait for the deploy.
3. Supabase SQL editor: run `supabase/migrations/024_lock_learner_writes.sql`. Only after step 2 is live.
4. Ask for the behavioural database checks to be re-run (grants, limits, the profile trigger, learner-table writes).

Nothing changes for today's users after these steps: the approval gate stays on, allowances and billing stay off.

## B. Settings only the owner has the values for (Vercel > Project > Environment Variables)

| Variable | Why |
|---|---|
| `APP_URL` | Links in emails (confirm, reset), canonical URLs, sitemap. Set it to the production address. |
| `NEXT_PUBLIC_OPERATOR_NAME`, `NEXT_PUBLIC_OPERATOR_TOWN`, `NEXT_PUBLIC_CONTACT_EMAIL` | The legal pages show "Draft, not yet in force" and stay out of search engines until these are set. Use a role address, not a personal one. `NEXT_PUBLIC_OPERATOR_ADDRESS` is needed in the imprint once the service is commercial. |
| `ELEVENLABS_USD_PER_1K_CHARS` | The real ElevenLabs rate; 0.11 is a placeholder, and the daily spending cut-off counts with it. |
| `DAILY_SPEND_LIMIT_USD`, `USER_DAILY_SPEND_LIMIT_USD` | Defaults 5 and 1. Lower them if 5 USD a day is more than the owner wants to risk. |

All variables are documented in `.env.example`.

## C. Accounts and dashboards

1. **OpenAI has no credit.** Every embedding call fails with "insufficient quota", so no book can be ingested and
   server voice input cannot work. A few dollars cover thousands of pages.
2. **Hard monthly spend limits** in the Anthropic, OpenAI, fal.ai and ElevenLabs dashboards. The in-app cut-off is a
   soft limit (it counts spend after a call finishes); the provider limit is the hard one.
3. **Supabase > Authentication:** "Confirm email" on; Site URL set to the production address; redirect URLs allow
   `/auth/callback`; minimum password length 8; optionally enable CAPTCHA (Cloudflare Turnstile, free) there, then
   set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`.
4. **A second admin account exists** (a personal email address, created 2026-04-19, admin since 2026-05-22, last
   sign-in 2026-09-12). Confirm it is the owner's or belongs to someone they trust. Until 2026-11-16 any signed-in user could have made
   themselves admin; nothing suggests that happened (three users in total), but only the owner can recognise this address.
5. Data-processing terms: accept them with Supabase, Vercel, Anthropic, OpenAI, fal.ai, ElevenLabs (and switch off
   training on the project's data there). Links are in `docs/compliance/processors.md`.
6. Two-factor sign-in for Vercel, GitHub and Supabase.

## D. Things to read and decide

1. **The four legal pages** (`/privacy`, `/terms`, `/imprint`, `/parents`) are drafts written from what the code
   does. About 30 statements need the owner's confirmation; each is marked in a comment at the top of its page file
   (`[P1]`..`[P17]`, `[T1]`..`[T8]`, `[I1]`..`[I4]`, `[K1]`..`[K3]`): retention periods, hosting regions, the
   liability wording, whether to publish a home address. Have someone qualified read the privacy page. Also read
   the five drafts in `docs/compliance/`.
2. **Screens nobody has looked at.** Built with the existing design tokens as plain first passes: the sign-up age
   step, `/account` (plan, parent controls, download, delete), `/pricing`, the legal pages, the AI label and
   first-lesson notice on a phone, the lesson failure panel, the book upload dialog, the recording state of the
   microphone button. They need the owner's review before strangers see them.
3. **Choices made on the owner's behalf that may be changed:**
   - A child who answers "Me" and under 16 blocks sign-up in that browser session, including for the parent after.
   - One checkbox accepts both terms and privacy.
   - Account deletion is refused while a subscription is active.
   - Rate limits per user per hour/day are in `src/lib/guard/limits.ts` (for example 10 fresh lessons an hour).
   - Free-form topics typed by a learner are still allowed for child accounts in course mode.
4. **Prices and the plan table** (`findings/pricing.md`): confirm, then set `NEXT_PUBLIC_PRICES_PROVISIONAL=false`.
5. `fix/classroom-ux` (PR 29) is still open from October, and `LICENSES.md` had uncommitted changes from the owner.

## E. Content (after C1)

Admin > RAG > Upload: choose a PDF, fill in licence and attribution, "Check and estimate", "Confirm and ingest",
then "Draft a course" on the ready source, remove what is not wanted, save, review, publish.
What the live test on 2026-11-17 found (a 25-page NASA maths booklet, real cost 0.11 USD):
- Reading the PDF in the browser, the licence rules, the estimate, duplicate refusal, drafting a course, hiding
  drafts, publishing, the onboarding list and `/credits` all work.
- Never run for real, because OpenAI had no credit: embedding and storing chunks, resuming a stopped ingest, the
  grounding preview, a lesson grounded in a book. Try these first with a short PDF.
- Books without a PDF outline get headings guessed from font size, which is noisy on worksheet-style booklets
  (about a third junk), and the outline cannot be edited in the UI: prefer books with a real table of contents.
- Deleting a source leaves the course drafted from it in place, without credit. Unpublish the course first.
- NASA material was entered as public domain; the booklet itself states no licence. Check NASA's media policy.
Recommended tracks and licences: `findings/content-plan.md`. Add a row per book to `LICENSES.md`.

## F. Opening sign-ups (when A to D are done)

Set `ACCESS_MODE=open` and `NEXT_PUBLIC_ACCESS_MODE=open`, and `ENFORCE_ALLOWANCE=true`. Existing users see a
one-time consent step. From then on an account needs a confirmed email and recorded consents, not the owner's approval;
"approve" in the admin becomes "suspend / restore" in effect (the buttons still say approve).

## G. Before any payment

- Payments stay sandbox-only behind the off flag `BILLING_ENABLED=false` in production.
- A domain; a host plan that allows commercial use (Vercel Pro or another host).
- A Paddle account: sandbox first, on a preview deployment only (sandbox billing is refused on production).
  Steps: create a product with monthly and yearly prices for Plus, a client-side token, an API key with
  `customer_portal_session.write`; a notification destination at `https://<preview-host>/api/billing/webhook` for
  the `subscription.*` events and `transaction.completed`; one `plan_prices` row per price; then
  `BILLING_ENABLED=true`, `PADDLE_ENVIRONMENT=sandbox`, `PADDLE_API_KEY`, `PADDLE_CLIENT_TOKEN`, `PADDLE_WEBHOOK_SECRET`.
- Paddle's written answer on minors, the "exam prep" wording and the domain.

## Known limits of what was built

- The daily spending cut-off can overshoot in a burst: it reads spend after calls finish and caches the sum for a
  minute per server. The per-user rate limits bound the damage; the provider-side limits are the hard stop.
- Admin-only actions that cost money (ingest, draft a course, regenerate a cached lesson) have no cut-off.
- Sign-up rate limiting in the app is per server instance; Supabase's own CAPTCHA and rate limits are the real
  control (C3).
- Checkout attaches a subscription to the account id the browser sends; move that to the server before going live.
- A missed "canceled" webhook leaves a subscription active with no expiry.
- Cached lessons do not pick up newly ingested books until they are regenerated.
- Nothing prunes old `rate_counters` rows yet.
- Narration failures show no notice to the learner (other failures do).
- No organisation UI; one learner per account.
- Voice input through the server was never tried in a real browser; try Chrome, Firefox and Safari before setting
  `NEXT_PUBLIC_STT_ENGINE=server`.
