# Owner steps for the features built on 2026-11-16 (branch `feat/launch-features`)

Nothing below has been run against the live database, ElevenLabs, OpenAI or Paddle. Each feature is type-checked,
unit-tested (857 tests) and builds; each degrades safely while its migration is missing. Do them in this order.

## 1. Push and merge (three stacked branches)

`fix/launch-critical` -> `chore/launch-cleanup` -> `feat/launch-features`, each into `deploy-prep` in that order.
Production keeps the old unauthenticated routes until the first one is deployed.

## 2. Migrations (Supabase SQL editor, in order; 018 is already applied)

| File | What it does | Check afterwards |
|---|---|---|
| `019_tts_audio_cache.sql` | lets `generated_assets` hold narration audio | play a lesson twice; the second play makes no ElevenLabs call (`/admin/cost` shows no new elevenlabs row) |
| `020_reference_sources.sql` | source registry, page ranges, draft concepts, the retrieval function | as a signed-in non-admin: `select * from concepts limit 1;` must return rows and not raise "infinite recursion"; `SELECT has_function_privilege('anon','public.match_reference_chunks(vector,int,varchar,uuid,jsonb)','EXECUTE');` must be false |
| `021_accounts_billing.sql` | accounts, members, plans, subscriptions, usage counters | run the check queries at the bottom of the file; every existing user has exactly one family account; `/pricing` shows the plans instead of "could not be loaded" |

Also check once: `SELECT policyname, cmd, roles FROM pg_policies WHERE schemaname='storage' AND tablename='objects';`
There must be no INSERT, UPDATE or DELETE policy for `anon` or `authenticated` on the `generated-assets` bucket.

## 3. Settings (Vercel env vars; all documented in `.env.example`)

- `ELEVENLABS_USD_PER_1K_CHARS`: your real rate (0.11 is a placeholder).
- `NEXT_PUBLIC_STT_ENGINE=server`: only when you want voice input to go through `/api/stt` (OpenAI, about 0.003 USD
  a minute) instead of the browser's recogniser. Try it in Chrome, Firefox and Safari first: recording in a real
  browser has not been tried at all.
- `ENFORCE_ALLOWANCE=true`: starts counting usage per account and refusing at the plan limit. Leave off until
  migration 021 is checked.
- `BILLING_ENABLED`: leave off on production. Sandbox billing is refused on the production deployment by design.

## 4. Add a book (after 020)

Admin > RAG > Upload: choose the PDF, fill in the licence and attribution, "Check and estimate" (free), then
"Confirm and ingest" (embeddings: well under one cent for a 400-page book). On the ready source: "Draft a course"
(about 0.30 to 0.50 USD of Sonnet calls for a 400-page book), remove what you do not want, save, review under
Admin > Knowledge graph and Admin > Courses, publish. Use "Grounding preview" to see what a lesson would be given.
First real run: use a short PDF, because PDF reading, heading detection and batch timing were never run for real.
Allowed licences only (CC BY 4.0, CC0, PSF, MIT, own material; CC BY-SA with a warning). Add a row per book to
`LICENSES.md` under a "Reference corpora" heading.

## 5. Try a sandbox purchase (optional, on a preview deployment only)

1. Create a Paddle sandbox account (yours to create): a product with a monthly and a yearly price for Plus, a
   client-side token, an API key with `customer_portal_session.write`.
2. Notification destination: `https://<preview-host>/api/billing/webhook`, events `subscription.created`, `.updated`,
   `.activated`, `.canceled`, `.past_due`, `.paused`, `.resumed`, `.trialing`, `transaction.completed`. Copy its secret.
3. Supabase: one `plan_prices` row per price (`provider` paddle, `environment` sandbox, the `pri_...` id, plan `plus`,
   interval `month` or `year`).
4. Preview env vars: `BILLING_ENABLED=true`, `PADDLE_ENVIRONMENT=sandbox`, `PADDLE_API_KEY`, `PADDLE_CLIENT_TOKEN`,
   `PADDLE_WEBHOOK_SECRET`.
5. Sign in, open `/account`, Upgrade, pay with Paddle's test card; a `subscriptions` row appears; "Manage billing"
   opens the portal.

## Known gaps in what was built (tracked in README)

- Narration cache trusts the client's "this is lesson text" flag: an approved user could have arbitrary text
  narrated and stored at an unguessable public URL. Fine behind the approval gate; L04 must verify the text
  against the stored lesson before sign-ups open.
- Speech-to-text and narration limits other than the plan allowance are per server instance.
- The checkout attaches a subscription to the account id the browser sends; move transaction creation to the
  server before going live.
- A missed "canceled" webhook leaves a subscription active with no expiry.
- Existing cached lessons do not pick up newly ingested books until they are regenerated.
- `/pricing`, `/account`, the upload dialog and the recording state are plain first passes nobody has looked at.
