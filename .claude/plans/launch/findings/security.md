# Security and cost-abuse audit before public sign-ups

Audit date 2026-11-16, branch `fix/classroom-ux`. Read-only audit of the repo; no dev server, no paid call, no live DB or Supabase dashboard access. Anything that depends on live Supabase/Vercel settings is marked UNVERIFIED. Secret values were never printed.

## Summary (10 lines)

1. The approval gate is the only thing between a stranger and paid APIs, and it will be removed. Today it can already be bypassed: the `profiles` self-update RLS policy has no column restriction, so any signed-in user can set their own `is_admin` and `approval_status` through the public Supabase REST API (C1).
2. Four routes spend money with no authentication at all: `/api/whisper`, `/api/openai-tts`, `/api/quiz` (POST), and nothing blocks them at middleware level (C2).
3. There is no per-user quota or budget on any paid route except `/api/learn/interactive`. The TTS throttle is in-memory per serverless instance (C3, H1).
4. `/api/generate-model/3d` forwards a caller-chosen URL to fal.ai/Tripo ($0.30 to $0.52 per call), and the cache key is the raw URL, so `?x=N` forces a paid miss every time (C3).
5. `/api/learn/lesson/[conceptId]`, `/api/quiz/lesson/[conceptId]` and `/api/teach` accept arbitrary strings, run Sonnet/Haiku and cache nothing; most lesson/quiz/challenge/explain-more usage rows have `user_id = NULL`, so usage_events cannot enforce a per-user budget today (H1, H2).
6. Zod is not installed and not used anywhere; no route validates input with a schema (H4).
7. Next.js 15.5.15 is installed; `yarn audit` reports 4 critical and 107 high advisories in total, including middleware-bypass advisories fixed in 15.5.16/15.5.18 and more fixed up to 15.5.28 (H3).
8. The widget sandbox (`sandbox="allow-scripts"`, hash-only CSP, `frame-src 'none'`, source-checked postMessage) is well built; the open issues are around it, not in it.
9. Children's data: no age gate, no parental-consent flow, no self-service account deletion, no password reset, no CAPTCHA; free text typed by children is copied into `usage_events.metadata` (M-section).
10. No real secrets are tracked; `.env.example` is complete enough; headers exist but there is no CSP (recommendation below).

Counts: Critical 3, High 6, Medium 9, Low 8.

---

## Critical

### C1. Any signed-in user can make themselves admin and "approved" (profiles RLS)
- Evidence: `supabase/migrations/005_reset_and_graph.sql:80-83` creates `"profiles: own update"` as `FOR UPDATE USING (auth.uid() = id)` with no `WITH CHECK` and no column restriction. No `REVOKE UPDATE` / column grants anywhere (`grep -ri revoke supabase/` only hits migration 017 for a different table). `is_admin` is defined in `005:38` and `approval_status` in `015_user_approval.sql:6`; both live on the same row. The anon key is public by design (`NEXT_PUBLIC_SUPABASE_ANON_KEY`), so a user can call `supabase.from('profiles').update({is_admin:true, approval_status:'approved'}).eq('id', myId)` from the browser console.
- Impact: bypasses the approval gate today and, more importantly, gives full admin: `/admin/*`, `/api/admin/*` (delete any user, list all emails, rebuild RAG, regenerate lesson cache with Sonnet, KG generation), and every service-role-backed admin path. Also the `courses` write policies (`008_courses.sql:48-66`) key off `profiles.is_admin`, so they inherit the hole.
- Fix: add a `BEFORE UPDATE` trigger on `profiles` that raises if `NEW.is_admin`, `NEW.approval_status`, `NEW.approved_at`, `NEW.approved_by`, `NEW.admin_notified_at` differ from OLD and `auth.uid()` is not null / caller is not `service_role`. Alternatively `REVOKE UPDATE ON public.profiles FROM authenticated; GRANT UPDATE (full_name, goal, daily_time_minutes) ON public.profiles TO authenticated;` and add `WITH CHECK (auth.uid() = id)`. All app writes to those privileged columns already go through the service client (`/api/admin/users/[id]`, `resend.ts`), so nothing breaks. Then verify against the live DB (UNVERIFIED that the live schema matches the migrations; run the console update with a throwaway account before and after).
- Effort: S. Mechanical: no (security-sensitive SQL; have a reviewer read it), but the shape is fixed. Do this before anything else.

### C2. Unauthenticated paid endpoints: `/api/whisper`, `/api/openai-tts`, `/api/quiz`
- Evidence:
  - `src/app/api/whisper/route.js:7-28`: no auth, reads multipart `audio`, calls OpenAI `whisper-1`. No size or duration cap beyond the platform body limit. Returns `error.message` in the 500 body (`:39`).
  - `src/app/api/openai-tts/route.js:9-25`: `GET`, no auth, `text` and `voice` straight from the query string into OpenAI `tts-1` (about $15 per 1M chars; a ~8k-char URL is about $0.12 per call, and a GET is trivially scripted). Error details returned (`:39`).
  - `src/app/api/quiz/route.ts:30-55`: `POST`, no auth, Haiku call with `topics.join(...)` from the body; `topics` is not type-checked (a non-array throws and returns 500 after the parse; a huge array is billed).
  - `src/middleware.ts:54-57,74-78`: the matcher runs on `/api/*` but only redirects `/learn`, `/admin`, `/pending`; API routes are not protected there.
  - No client references: `grep` finds no caller of `/api/whisper` or `/api/openai-tts` in `src/` or `pages/` (they are legacy). `/api/quiz` is the legacy quiz (`feature: "quiz.legacy"`).
- Impact: anyone on the internet, without an account, can spend the owner's OpenAI and Anthropic money. This is exploitable today, independent of the launch.
- Fix: delete all three routes (CLAUDE.md says the Whisper/TTS routes are a "planned upgrade, leave in place": decide; if kept, they need `requireApproved()` replaced by the new quota guard from C3, a Zod body, a size cap, and generic error bodies). `/api/quiz` should simply be removed unless something still calls it.
- Effort: S. Mechanical: deletion yes; keeping them is a design decision (owner).

### C3. No spend ceiling on any paid route; arbitrary-input cache misses on fal.ai
- Evidence (per route, see the Cost-abuse table below): `src/app/api/generate-model/3d/route.ts:36-45` takes any string `imageUrl` and passes it to `generate3dModel` (`src/lib/imagegen/banana.ts:606-633`), which hashes the raw URL (`:607`) and calls Tripo3D ($0.30 single-view, `:628`). `needsMultiview: true` runs 3 FLUX Kontext edits plus an HD Tripo call (`:696-737`, about $0.52). Appending `?n=<counter>` makes every request a cache miss. fal.ai fetches the URL from its own infrastructure (so this is not SSRF against Vercel, but it is an arbitrary-content generator and a way to push arbitrary images into the public bucket, see M5).
  `src/app/api/learn/segment-visuals/route.ts:98-124` allows 8 arbitrary prompts per request ($0.08 each = $0.64 per request), no prompt length cap, no per-user count. `src/app/api/generate-model/route.ts:34-44` takes any `imagePrompt` (Nano Banana Pro, $0.15) and any `model3dPrompt` (FLUX), no length cap, `maxDuration = 300`.
- Impact: this is the largest financial exposure. One account (or one script that creates accounts, see M3) can drive dollars per minute. Order of magnitude if the account runs 10 concurrent requests: segment-visuals about $0.64 x (3600/13 s x 10) = roughly $1,800/hour at the call rate, in practice bounded by fal.ai/Anthropic account rate limits (UNVERIFIED which tier the keys are on). Treat any figure below "provider limit" as a ceiling, not a guarantee.
- Fix: a single guard `requireBudget(user, feature)` called right after `requireApproved()`, with (a) per-user hourly and daily counters per feature, (b) a per-user daily USD budget summed from `usage_events.cost_usd_micros` (the data already exists and `usage_events` has `idx_usage_user`), (c) a global daily circuit breaker (sum over all users; return 503 when exceeded), (d) restrict `generate-model/3d` `imageUrl` to URLs produced by `/api/generate-model` (verify the host is the `generated-assets` public bucket or the fal media host, and that a `generated_assets` row of kind `flux_source` / `infographic` exists for it), (e) cap prompt lengths (about 600 chars) and strip query strings before hashing.
- Effort: M (guard plus per-route wiring), L if per-concept server-side validation of prompts is wanted. Mechanical: the wiring is, the budget numbers and the "what does a free allowance mean" policy are a design decision (owner).

---

## High

### H1. In-memory throttles do not work on serverless, and most usage is unattributed
- Evidence: `src/lib/interactive/throttle.ts:1-6` says "Instance-local and best effort". `src/app/api/tts/route.ts:42,65` uses it for 200 calls/hour; each call allows 4000 chars (`:74`), so 800,000 ElevenLabs characters per hour per learner per instance, and Vercel spins up instances per concurrent request. The free ElevenLabs plan is 10,000 chars/month (`tts/route.ts:31`), so one learner exhausts the shared quota in four calls.
  Attribution gaps (rows in `usage_events` with `user_id` NULL): `generateLesson` tag has no `userId` (`src/lib/agents/teaching.ts:762-765`), `explainMore` (`:832`), `challenge` (`src/app/api/learn/challenge/route.ts:63`), all assessment calls (`src/lib/agents/assessment.ts:213,279,326,365`). Only `teach.chat`, interactive, curriculum, and fal calls carry a user id.
- Impact: usage_events cannot be used to enforce a per-user quota for lessons, quizzes, explain-more or evaluations until the user id is threaded through; the one DB-backed limit (interactive, `src/app/api/learn/interactive/route.ts:166-178`) is the pattern to copy.
- Fix: thread `userId` into every `getAnthropic().messages.create` tag; replace `createThrottle` use in `/api/tts` by a DB or Redis-backed counter (Vercel KV / Upstash, or `usage_events` count as `interactive` does). Add a `usage_events` row for TTS (no row exists today: grep shows no `elevenlabs` provider; the `provider` type is `"anthropic" | "openai" | "fal"`, `src/lib/llm/usage.ts:15`).
- Effort: M. Mechanical: threading `userId` yes; choosing the store and the quotas is a design decision.

### H2. Free-form IDs turn lesson, quiz and chat routes into an unmetered, uncached LLM
- Evidence: `src/app/api/learn/lesson/[conceptId]/route.ts:101-110` ("Free-form fallback — never cached") accepts any `conceptId` (up to the URL length limit, no format check) and runs Sonnet with `max_tokens` 8192 and up to two attempts (`teaching.ts:749`, loop at `:757-775`): about $0.09 to $0.18 per call. `src/app/api/quiz/lesson/[conceptId]/route.ts:41-53` does the same with `generateLessonQuiz` (3000 tokens, nothing cached). `/api/teach` (`src/app/api/teach/route.ts:124-145`) has no length limit on `topic` or `history` (the body is only bounded by the 4.5 MB platform limit, about 200k tokens of Haiku input is about $0.20 per call). `/api/learn/explain-more` (`explain-more/route.ts:24-30`) and `/api/learn/challenge` (`challenge/route.ts:25-42`) pass unbounded caller text to Haiku.
  Cache-miss amplification on the real cache: `profileSignature` has 6 dimensions (`moderation-rules.ts:84-95`) and the user can write `learner_profiles` directly (`006_mastery.sql:28-30` `FOR ALL`), so one account can create about 3x3x3x3x7x7 distinct signatures per concept, each a Sonnet generation, each stored as a new `cached_lessons` row (also M7 for pending rows).
- Impact: a child-facing tutor that is also a free general-purpose Sonnet/Haiku endpoint, and an easy way to burn the budget. Also a content-safety issue (jailbreak text goes straight to the model, e.g. `description: "The topic: ${conceptId}"`).
- Fix: for lesson/quiz, require `conceptId` to exist in `concepts` (reject otherwise, or route free-form through `/api/teach` with the new guard); cap `topic` (200 chars), `history` (10 items x 100 chars), `phaseContent` (4,000 chars), challenge fields; whitelist the profile signature by deriving it only server-side (revoke direct `learner_profiles` writes, or ignore the stored row's signature dims that the user can set freely).
- Effort: M. Mechanical: the length caps and "concept must exist" check yes; free-form policy is a design decision.

### H3. Outdated Next.js with middleware-bypass and other advisories; 194 audit findings total
- Evidence: installed `next` 15.5.15 (`node_modules/next/package.json`), `package.json:47` `"next": "^15.1.0"`. `yarn audit` (yarn 1): 194 vulnerabilities (7 low, 76 moderate, 107 high, 4 critical). For `next`: critical RCE advisories fixed in 15.5.24/15.5.28 (the "windows-hosted" one is not relevant on Vercel's Linux runtime; the Image Optimization AVIF/SVG ones apply if `next/image` remote patterns are enabled, not verified), high "Middleware / Proxy bypass" (App Router segment-prefetch, <15.5.16 and <15.5.18; dynamic route parameter injection <15.5.16), server-action DoS and SSRF advisories fixed in 15.5.21 and 15.5.28. `openai` 4.x pulls `form-data` flagged critical (unsafe random boundary, fixed 4.0.4) and high (CRLF). `@anthropic-ai/sdk` ^0.88 has a moderate advisory (insecure default file permissions in local filesystem memory tool, fixed in 0.91.1; not used here). Everything else (`brace-expansion`, `cross-spawn`, `minimatch`, `picomatch`, `postcss`, `nanoid`, `flatted`, `js-yaml`, `vite`) comes in through dev tooling (`eslint`, `tailwindcss`, `vitest`, `@gltf-transform/cli`) or `sharp`, and is not on the request path.
- Mitigation already present: the middleware is not the only gate (SSR gate in `pages/learn.tsx:72-91`, `src/app/admin/layout.tsx:25-37`, per-route `requireApproved`/`requireAdmin`), so a middleware bypass does not by itself open admin or paid routes. Keep it that way.
- Fix: `yarn upgrade next@^15.5.28` (stay on 15.5.x; do not jump major; re-run `yarn build` and confirm `/learn` still boots because of the Pages Router/R3F constraint), `yarn upgrade openai@^4` to a version with `form-data >=4.0.6` (or move to openai 5+ after a review), `yarn upgrade @anthropic-ai/sdk`. Re-run `yarn audit` and keep CI on `yarn audit --level high --groups dependencies`.
- Effort: S to M. Mechanical: yes, with a build and a manual `/learn` smoke test.

### H4. No schema validation anywhere (project rule says Zod on every external input)
- Evidence: `zod` is absent from `package.json` and no file imports it (`grep -rn "from \"zod\"" src pages` returns nothing). Every route casts `await req.json()` with TypeScript types only, e.g. `src/app/api/quiz/submit/route.ts:31-42`, `learn/challenge/route.ts:25-36`, `profile/session/route.ts:32-36` (`signals.questions_attempted` is dereferenced with no check, so a missing `signals` throws and logs), `courses/generate/route.ts:22`, `admin/users/[id]` PATCH body, `server actions` in `src/app/auth/actions.ts:6-39` (`formData.get(...) as string`). Routes with ad-hoc checks only: `learn/interactive` (decent), `tts`, `segment-visuals`, `generate-model`, `generate-model/3d`.
  Env vars are not validated either (`process.env.X!` in `src/lib/supabase/server.ts`, `middleware.ts:18-19`).
- Impact: type confusion and oversized payloads reach the database and the LLMs (also what makes H2 possible); 500s instead of 400s.
- Fix: add `zod`, one schema per route body with `.max()` on every string and array, a `src/lib/env.ts` that parses the env once; reject unknown keys. Start with the paid routes.
- Effort: M. Mechanical: yes (route by route, tests exist for pure logic).

### H5. A user can write to other users' data through `increment_misconception` (SECURITY DEFINER with a caller-chosen user id)
- Evidence: `supabase/migrations/009_quiz_constraints.sql:34-55`: `increment_misconception(p_user_id UUID, p_concept_id, p_text)` is `SECURITY DEFINER`, granted to `authenticated` (`:55`), and never compares `p_user_id` to `auth.uid()`. Any authenticated user can call `supabase.rpc('increment_misconception', {p_user_id: <victim>, ...})`. It also has no `SET search_path`.
- Impact: cross-user write (IDOR) into `user_misconceptions` of any user whose UUID is known (UUIDs are not secret in admin UIs/URLs); also unbounded row creation (text is unbounded).
- Fix: replace body with `p_user_id := auth.uid()` (drop the parameter) or add `IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION`; add `SET search_path = public`; same `SET search_path` on `handle_new_user`, `handle_new_learner_profile`, `match_reference_chunks`. The app calls it with the user's own id (`quiz/submit/route.ts:144-148`), so behaviour is unchanged.
- Effort: S. Mechanical: yes.

### H6. Unrestricted direct writes to the learner's own tables (self-service data and row flooding), including the moderation inputs
- Evidence: `006_mastery.sql:28-30,73-75,97-99,122-124,153-155,186-188`: `FOR ALL USING (auth.uid() = user_id)` on `learner_profiles`, `user_concept_mastery`, `user_course_progress`, `user_misconceptions`, `session_logs`, `quiz_attempts`, with no `WITH CHECK`, no column limits, no row quotas. The server routes use the user-scoped client (`quiz/submit/route.ts:48`), so these writes are also reachable directly from the browser.
- Impact: (a) a user can insert arbitrary `quiz_attempts` rows with `misconception_detected` set; `decideModeration` (`moderation-rules.ts:41-60`) reads the last 50 rows for the concept across all users, so a crafted set flips new lessons for a concept to `pending`, which are regenerated on every request and never served from cache (cost amplification for everyone, see M7); (b) unlimited rows and jsonb size in `session_logs` / `quiz_attempts` / `user_misconceptions` fill the Supabase database (free tier is small); (c) mastery and SRS can be forged (cosmetic for one learner, but the owner will presumably show progress to parents).
- Fix: move quiz/mastery/session writes to server-only paths with service role and revoke `INSERT/UPDATE/DELETE` from `authenticated` on `quiz_attempts`, `user_concept_mastery`, `session_logs`, `user_misconceptions`; keep `SELECT` own. Make `decideModeration` ignore rows by the same user and count distinct users. Add `WITH CHECK (auth.uid() = user_id)` everywhere as a minimum.
- Effort: M. Mechanical: partially (the SQL is simple, the route changes need a test pass); design decision on which tables stay client-writable.

---

## Medium

### M1. `quiz/submit` trusts the client for the answer key and lets anyone run the Haiku evaluator
- Evidence: `src/app/api/quiz/submit/route.ts:31-72`: `correctAnswer`, `difficulty`, `questionType`, `question` all come from the body; objective questions are graded against the client-supplied `correctAnswer` (`evaluateObjective`), short answers go to Haiku with the client's text (`assessment.ts:335-365`, no `userId` in the usage tag). Quiz questions are not stored server-side, so the server cannot know the real key.
- Impact: forged mastery (one's own), free Haiku evaluator, prompt injection of the evaluator.
- Fix: store generated questions (id, key, concept, user) at generation time and grade by id; cap `userAnswer` length; add the usage tag. Effort: M. Design decision (changes the client protocol).

### M2. Open redirect in the auth callback
- Evidence: `src/app/auth/callback/route.ts:8,23`: `next = searchParams.get("next") ?? "/learn"` then `NextResponse.redirect(\`${origin}${next}\`)`. `next=@evil.example` produces `https://app-host@evil.example`, which browsers treat as userinfo and navigate to `evil.example`. A valid `code` is required, which limits abuse to flows where the attacker can get the victim to complete an auth exchange (email confirmation links, if the redirect target is controllable).
- Fix: accept only paths that match `^/(?!/)[A-Za-z0-9/_-]*$`, else `/learn`. Effort: S. Mechanical: yes.

### M3. Sign-up has no abuse controls; email confirmation state is unverified
- Evidence: `src/app/auth/actions.ts:21-39`: plain `signUp`, no CAPTCHA, no server-side password rule (the 8-char rule is only the HTML `minLength` in `src/app/sign-up/page.tsx`), no `emailRedirectTo`. The action text says "Check your email to confirm", but `src/app/pending/page.tsx:25-27` documents "the no-email-confirm Supabase flow where /auth/callback never runs", which suggests confirmation may be OFF in the dashboard (UNVERIFIED: needs a look at Supabase Auth settings: Confirm email, password minimum length, CAPTCHA provider, rate limits). `notifyAdminOfNewSignup` (`src/lib/email/resend.ts:50-80`) sends one email per sign-up to the owner, so sign-up spam is also an inbox/Resend-quota flood until it is removed.
- Impact: bots farm free allowances (each account multiplies every per-user limit by one), and the owner pays. Per-user quotas (C3/H1) are only as strong as the cost of making an account.
- Fix: turn on Supabase "Confirm email", enable Supabase CAPTCHA (Turnstile/hCaptcha) with `options.captchaToken` in `signUp`/`signIn`, raise the Supabase password minimum, block disposable domains, add an IP-level rate limit on the sign-up action, and add a global daily cap on new accounts. Remove `notifyAdminOfNewSignup` when the gate goes. Effort: M. Design decision (CAPTCHA choice, child-friendly flow).

### M4. Children's accounts: no age gate, parental consent, deletion or reset (COPPA/GDPR-K exposure)
- Evidence: grep finds no date-of-birth, parent, consent, `resetPasswordForEmail`, `updateUser`, or self-service delete anywhere in `src/` (`grep -rniE "resetPasswordForEmail|deleteUser|birth|parent|coppa" src` hits only admin code and the admin `deleteUser` at `src/app/api/admin/users/[id]/route.ts:217`). Admin delete does cascade (`profiles.id ... ON DELETE CASCADE` at `005_reset_and_graph.sql:35` and `006_mastery.sql` FKs) but `usage_events.user_id` is `ON DELETE SET NULL` (`013_usage_events.sql:12`), so the free text a child typed stays in `usage_events.metadata` (`teach/route.ts:157` stores `{topic}`, `challenge` stores `conceptName`, `curriculum.ts:156` stores domain and goal) after the account is deleted. Also `admin_audit_log.actor_email` is denormalized on purpose. `approved_by REFERENCES auth.users(id)` has no `ON DELETE` rule (`015_user_approval.sql:9`), so deleting an admin who approved anyone fails.
- Impact: a legal blocker for an under-13 audience, independent of the code.
- Fix: parent-owned account model (parent signs up, creates learner profiles; learner has no email/free-text profile), consent step with a stored timestamp, self-service "delete my account and data" that also nulls/deletes `usage_events.metadata` and removes custom-teacher URLs, a password reset flow, stop storing raw topics in `usage_events.metadata` (store a hash or length), and fix the `approved_by` FK (`ON DELETE SET NULL`). Effort: L. Design decision (needs the owner and probably legal advice).

### M5. Public `generated-assets` bucket: arbitrary content, hosted on the owner's domain
- Evidence: `src/lib/imagegen/banana.ts:265,367-381`: the server downloads fal output and uploads with `upsert: true` using the service role. Bucket is public (state.md and `.claude/plans/T06-persistent-generation-cache.md:67`: "public, 20 MB file size limit, created live via the Storage Admin"). No storage policies exist in `supabase/migrations/` (the bucket and `storage.objects` policies are not in version control; UNVERIFIED in the live project). Reads: anyone with a URL (paths are `kind/<sha-hash>.ext`, `banana.ts:369`; hashes are not guessable but are returned to every user). Writes/overwrites: only the service role in code, and with default Supabase settings the anon/authenticated roles have no insert policy on `storage.objects`; verify that no permissive policy was added in the dashboard.
  The abuse is indirect: prompts and, for `/api/generate-model/3d`, the source image URL are caller-chosen (C3), so users can make the platform generate and permanently host arbitrary images/meshes (fal's safety checker is the only content filter) under a Supabase URL tied to the product; with a children's brand this is a reputational risk, and the public GLBs also create egress cost.
- Fix: put the storage policy SQL in a migration (public `SELECT` on this bucket only, no `INSERT/UPDATE/DELETE` for anon/authenticated), keep the 20 MB limit and add an allowed-MIME list (`image/png`, `model/gltf-binary`), restrict inputs (C3), and add a moderation or "prompt must come from a stored lesson of this concept" rule like the interactive route does (`learn/interactive/route.ts:87-107`). Effort: M. Partly mechanical (the SQL), the prompt provenance rule is a design decision.

### M6. `learn/challenge` and `explain-more` return free LLM output; challenge parses JSON with a regex
- Evidence: `src/app/api/learn/challenge/route.ts:63-81`: `text.match(/(\{[\s\S]*\})/)` then `JSON.parse` and `NextResponse.json(result)` returns whatever object the model produced (no schema, violates the "tool_use, never regex-parse JSON" rule in CLAUDE.md). Student text, question and "expected answer" are all caller-supplied (`:25-42`), so prompt injection controls the response shape.
- Fix: use a `tool_use` schema as `evaluateShortAnswer` does (`assessment.ts:357-366`), return only `{is_correct, score, feedback}` clamped. Effort: S. Mechanical: yes.

### M7. Lesson cache: pending and rejected rows regenerate on every request, and a rejected row is silently overwritten
- Evidence: `learn/lesson/[conceptId]/route.ts:78-85` serves only `approved/auto_approved` rows; on a miss it always regenerates and upserts with the new decision (`:140-153`, `onConflict: concept_id,profile_signature`). So an admin-`rejected` row is replaced by a fresh `auto_approved` one on the next request (moderation does not stick), and a `pending` row (e.g. `high_misconception_rate`, which H6 lets an attacker trigger) costs a Sonnet call for every learner on every lesson.
- Fix: serve-or-skip logic that treats `rejected` as a block (regenerate into a different row or return a safe fallback) and that serves `pending` rows to the first learner but caches the payload; stop overwriting `rejected`. Effort: S to M. Design decision (moderation policy).

### M8. SSR cookie handling in `pages/learn.tsx` is fragile and weakens the session cookies
- Evidence: `pages/learn.tsx:60-66`: `setAll` calls `res.setHeader("Set-Cookie", ...)` once per cookie, and each call replaces the previous header, so when Supabase refreshes and writes more than one cookie (chunked auth cookies), only the last survives; it also drops `maxAge`/`expires`/`sameSite` from `options` and hard-codes `HttpOnly`, which differs from the browser client's expectation (`@supabase/ssr` browser client reads these cookies from JS). Possible symptom: random sign-outs on `/learn`.
- Fix: append to an array of Set-Cookie values and serialize with the `cookie` package using the supplied options. Effort: S. Mechanical: yes (test refresh on a long session).

### M9. Prompt injection and rendering paths around LLM output (reviewed)
- Evidence and result: LLM output is rendered as React text; the only `dangerouslySetInnerHTML` uses are constant init scripts (`src/app/layout.tsx:40`, `pages/_document.tsx:22-26`); no markdown/HTML renderer is imported in the lesson path (grep). The one place LLM output is executed is the V10 widget, reviewed below. Residual: widget content can still show arbitrary text/imagery inside the card (social-engineering a child: a fake "enter your name/phone" form), and the sandbox cannot stop CPU use up to its 1 s budgets. A learner-controlled free-form topic reaches the generator when `conceptId` is absent (`interactive/route.ts:109-112`: topic is part of the key and the result is never stored, good).
- Fix: none required for the sandbox; add a validator rule that rejects `<input type=text|password|email|tel>` and `<textarea>` in widget markup, and keep the `NEXT_PUBLIC_INTERACTIVE_VISUALS` kill switch off by default until after launch. Effort: S. Mechanical: yes.

---

## Low

### L1. No real CSP and no `frame-ancestors`; X-Frame-Options only
- Evidence: `next.config.mjs:3-16` has XFO, nosniff, referrer, permissions, HSTS; the only CSP is `frame-src 'none'` on `/learn`, `/demo`, `/dev/interactive` (`:26-31`). A workable CSP for this app (R3F, Supabase, ElevenLabs proxied through the server so the browser never talks to it):
  `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://<project-ref>.supabase.co https://*.fal.media; media-src 'self' blob: data:; font-src 'self' data:; connect-src 'self' https://<project-ref>.supabase.co wss://<project-ref>.supabase.co blob: data:; worker-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`.
  Notes: `'unsafe-inline'` scripts are needed for the inline theme/teacher/intro scripts in `pages/_document.tsx:22-26` and Next's bootstrap, so a nonce policy would need the Pages Router pages to become dynamic (not worth it; the widget iframe has its own hash CSP). `/create-teacher` needs `frame-src https://*.avaturn.dev` plus `img-src https://models.avaturn.me`; split the header by path. Draco is self-hosted (`src/components/three/dracoDecoder.ts`), so no gstatic. `<Environment preset="studio">` (`Experience.tsx:595`) makes drei load an HDR from a third-party CDN unless a local `files` path is set (UNVERIFIED; if so add that host to `connect-src` or self-host the HDR). Roll out as `Content-Security-Policy-Report-Only` first, check `/learn`, `/demo`, `/` for violations, then enforce. Effort: S to M. Design decision for the allowlist.

### L2. Dev surfaces ship to production
- Evidence: `pages/dev/*.tsx` render a `<div>404</div>` in production (`app-pages.tsx:17`, `learn-shell.tsx:118`, `quiz-bars.tsx:40`, `avatar-lab.tsx:13`, `desk-quiz.tsx:15`, `free-model.tsx:13`, `interactive.tsx:12`) with HTTP 200, and their bundles (AvatarLab, InteractivePreview) are built. `/hx/admin/*` correctly calls `notFound()` in production (`src/app/hx/admin/[[...slug]]/page.tsx:15`) and is reported as excluded from git. `/aristo` only redirects to `/learn` (`src/app/aristo/page.tsx`). `/create-teacher` requires sign-in (`page.tsx:9`) but not approval, and it stores any `https://` URL as the teacher GLB (`api/profile/custom-teacher/route.ts:18-25`, no host allowlist, no length cap); the URL is loaded only in that user's own browser (`Teacher.tsx` `useGLTF`), so it is not SSRF and affects only the owner of the row.
- Fix: return `notFound: true` from `getServerSideProps` in production (so status 404 and no props), or move them out of `pages/` behind a build flag; allowlist `https://models.avaturn.me` for the custom teacher and cap length. Effort: S. Mechanical: yes.

### L3. Verbose errors and debug output
- Evidence: `/api/tts` returns `details: err.message` (`tts/route.ts:147`), `/api/whisper` and `/api/openai-tts` do the same, `segment-visuals`, `generate-model`, `3d` return raw `error.message` from fal/Anthropic. `console.warn` prints up to 200 chars of ElevenLabs error body (`tts/route.ts:119-124`). No `console.log` of emails/tokens was found.
- Fix: log server-side, return a generic message and a request id. Effort: S. Mechanical.

### L4. `courses` rows are readable by id by any approved user, and user-generated courses accumulate
- Evidence: `src/app/api/courses/[id]/route.ts:27-34` reads with the service client "so unpublished user-generated courses are accessible"; ids are `course_${domain}_${Date.now()}` (`curriculum.ts:188`) and the table has no owner column (`008_courses.sql:15-37`). Content is KG structure only (no personal data), so impact is low. Every `/api/courses/generate` call inserts a new unpublished row and a Sonnet call, unmetered (see C3 table).
- Fix: add `created_by`, filter by it for unpublished courses, dedupe per user+domain. Effort: S. Design decision.

### L5. Middleware calls Supabase Auth on every request including `/api/*` and static-ish routes
- Evidence: `src/middleware.ts:43` `supabase.auth.getUser()` for every request matching `:75-77` (everything except static assets/images), including `/demo` audio under `public/demo` (`.mp3` not excluded), `/api/*`, and `/`. This is a network call to Supabase Auth per request and can be used to burn the Supabase Auth rate limit.
- Fix: narrow the matcher to `/learn`, `/admin`, `/pending`, `/sign-in`, `/sign-up`. Effort: S. Mechanical: yes.

### L6. No CSRF/Origin check on cookie-authenticated JSON routes
- Evidence: routes call `req.json()` regardless of `Content-Type`; Supabase auth cookies default to `SameSite=Lax` (cross-site POST does not carry them), so this is closed in practice. Server actions have Next's built-in origin check.
- Fix: optional: reject non-`application/json` bodies and mismatched `Origin` in the shared guard. Effort: S.

### L7. Cosmetic error reflection
- Evidence: `src/app/sign-up/page.tsx:36-38` renders `decodeURIComponent(params.error)`; `searchParams` is already decoded, so a `%` in an error message throws `URIError` (500). React escapes the text, so no XSS, but the message is attacker-chosen (phishing text).
- Fix: show a fixed message per error code. Effort: S.

### L8. Housekeeping
- Migration numbering skips 007 (`supabase/migrations/`), the bucket and storage policies are not in migrations, and `/api/kg/ingest` does its admin check and its insert with the user-scoped client (`kg/ingest/route.ts:30-42,88-91`) while `reference_chunks` is service-role-write only (`010_rag.sql:60-67`), so that route likely always fails on insert (functional, not security; the admin UI uses `/api/admin/rag/upload` instead). `docs/architecture.md:59` says the callback is `/api/auth/callback`; the real path is `/auth/callback`. `.claude/settings.local.json` is tracked (`git ls-files`); it contains command allowlists only (no secrets found) but should be untracked. `profiles: admin read all` (`005:85-91`) selects from `profiles` inside a policy on `profiles`, which usually raises "infinite recursion detected in policy" when evaluated; the app works today, so the live DB probably differs from the migrations (UNVERIFIED), another reason to diff the live schema against `supabase/migrations/` before launch.

---

## 1. AuthN/AuthZ route table

All paths under `src/app/api`. "Approved" = `requireApproved()` (`src/lib/auth/approval.ts:51-80`, admin counts as approved). "Admin" = `verifyAdmin()`/`requireAdmin()` (`src/lib/admin/auth.ts:28-45`).

| Route | Check | Notes |
|---|---|---|
| `admin/**` (all 26 files) | Admin | every file contains `verifyAdmin`/`requireAdmin` (`grep -L` returned none); gated only by `profiles.is_admin`, which C1 makes self-writable |
| `kg/[domain]`, `kg/concepts`, `kg/generate/[domain]`, `kg/validate/[domain]` | Admin | `kg/generate` is a Sonnet call (admin only) |
| `kg/ingest` | session + admin via user client | see L8 |
| `learn/lesson/[conceptId]`, `learn/explain-more`, `learn/challenge`, `learn/complete`, `learn/next`, `learn/interactive`, `learn/segment-visuals` | Approved | `learn/overdue-count` is session-only (`overdue-count/route.ts:17`, a cheap read, fine) |
| `quiz/lesson/[conceptId]`, `quiz/review`, `quiz/submit` | Approved | `quiz/complete` session-only (`quiz/complete/route.ts:23`) |
| `teach`, `tts`, `generate-model`, `generate-model/3d`, `courses`, `courses/[id]`, `courses/generate` | Approved | `courses/generate` parses the body before the auth check (`generate/route.ts:22-31`, harmless but reorder) |
| `profile`, `profile/analytics`, `profile/mastery`, `profile/session`, `profile/custom-teacher`, `auth/onboarding` | Session only (unapproved users reach them) | all scope by `user.id`; `profile/session` dereferences body fields unvalidated |
| `quiz` (POST) | NONE | C2 |
| `whisper`, `openai-tts` | NONE | C2 |

Pages: `/learn` SSR gate (`pages/learn.tsx:72-91`) checks user, then `is_admin || approval_status === "approved"`; good. `/admin/**` layout checks `is_admin` with the service client (`src/app/admin/layout.tsx:25-37`); good, plus middleware. `/pending` requires a session. `/create-teacher` requires a session only. `/demo` and `/` are intentionally public; `/demo` makes no authed calls (stated in `pages/demo.tsx`, not re-verified end to end).

IDOR review: every learner route filters by `user.id` from the verified session and writes `user_id: user.id` (quiz/submit, profile/*, learn/complete, onboarding, session). No route takes a user id from the request except the admin ones. The two cross-user paths found are the SQL function in H5 and the unowned `courses` read in L4. `/api/learn/complete` updates all of the caller's `in_progress` rows (no ownership issue). `profile/custom-teacher` and `onboarding` accept free `domain`/URL strings (onboarding `domain` is not checked against `concepts`; harmless but creates arbitrary `user_course_progress.domain`).

Service-role usage (all server-side; `createServiceClient` in `src/lib/supabase/server.ts:34-39`, key never in a `NEXT_PUBLIC_` var): `approval.ts` and `admin/auth.ts` (profile lookup after the session is verified, correct); `learn/lesson` (cache read/write, correct, filtered by status), `learn/interactive` (cache and the stored-lesson provenance check, correct), `courses/[id]` and `courses/generate` (reads any course by id; inserts unpublished course, see L4), `banana.ts` (storage and `generated_assets`), `logUsage`, `resend.ts`, and the admin routes. None bypasses a check it should keep except `courses/[id]` (L4).

## 2. RLS table by table (migrations 001..017)

Migration 005 drops and rebuilds `profiles`, `quiz_attempts`, `courses` and the earlier tables, so only the later definitions count. 007 does not exist.

| Table | RLS | Policies | Verdict |
|---|---|---|---|
| `profiles` | yes (`005:77`) | own read; own update (no WITH CHECK, all columns); admin read all (self-referential) | C1; recursion UNVERIFIED |
| `concepts`, `concept_prerequisites` | yes | `SELECT USING (TRUE)` for everyone including anon; no write policy | OK (KG is non-sensitive); writes service-role only |
| `learner_profiles` | yes | own `FOR ALL`, no WITH CHECK | H2/H6 (self-set signature, free URL column) |
| `user_concept_mastery`, `user_course_progress`, `user_misconceptions`, `session_logs`, `quiz_attempts` | yes | own `FOR ALL`, no WITH CHECK | H6 |
| `courses` | yes (`008`) | read published or admin; insert/update admin via `profiles.is_admin` subquery | inherits C1; no delete policy (fine); no owner column (L4) |
| `reference_chunks` | yes | authenticated SELECT all; service write | OK; every signed-in user can read the full corpus and embeddings through REST (low) |
| `admin_audit_log` | yes | service role only | good |
| `usage_events` | yes | service role only | good, but no client could write; fine |
| `cached_lessons` | yes | authenticated SELECT approved/auto_approved; service write | good |
| `generated_assets` | yes | authenticated SELECT all; service write | good |
| `generated_interactives` | yes | `REVOKE ALL FROM anon, authenticated`; service role only (`017:36-43`) | good; the pattern to copy |
| Functions | `increment_misconception` (H5, DEFINER, no auth.uid check); `match_reference_chunks` (DEFINER, granted to authenticated; reveals only already-readable chunks); `increment_cached_lesson_usage` (INVOKER, default PUBLIC execute, no effect for non-service callers); `handle_new_user`, `handle_new_learner_profile` (DEFINER, no `search_path`) | | fix `search_path` |
| Storage `generated-assets` | not in migrations | UNVERIFIED | see M5 |

## 3. Cost-abuse table

Prices from `src/lib/llm/pricing.ts` and the comments in `banana.ts` (Sonnet 5 $2/$10 per 1M, Haiku 4.5 $1/$5, Nano Banana Pro $0.15, NB2 $0.08, Tripo $0.30, multiview about $0.52). Ceilings are per call; sustained rates are bounded only by provider account limits (UNVERIFIED which tiers the keys are on).

| Route | Auth | Per-user limit | Max input | Cache-miss forceable? | Worst cost per call |
|---|---|---|---|---|---|
| `learn/lesson/[id]` | Approved | none | id length only | yes: free-form id, or vary profile signature | about $0.09 to $0.18 (Sonnet, 8192 out, 2 tries) |
| `learn/segment-visuals` | Approved | none | 8 segments, no prompt cap | yes: any new prompt | about $0.64 |
| `learn/interactive` | Approved, flag-gated | 8 generations/10 min, in-memory plus `usage_events` check (`:52-56,132,166-178`) | topic 200, spec parsed, KG spec must come from a stored lesson | free-form topic: yes (not stored, but billed) | about $0.10 to $0.20 per generation (2 calls), capped at 48 generations/hour by the DB check; fails open on DB error (`:173-176`) |
| `generate-model` | Approved | none | no length caps | yes: any prompt | about $0.15 to $0.16 |
| `generate-model/3d` | Approved | none | any URL string | yes: `?n=` | $0.30 (multiview $0.52) |
| `teach` | Approved | none | body only (about 4.5 MB) | n/a (never cached) | up to about $0.20 input, plus 1536 output |
| `explain-more`, `challenge` | Approved | none | unbounded | n/a | Haiku, small to about $0.20 |
| `quiz/lesson/[id]`, `quiz/review` | Approved | none | id | yes (nothing cached) | Sonnet 3000 out about $0.03; review up to 5 Haiku calls |
| `quiz/submit` (short answer) | Approved | none | unbounded text | n/a | Haiku, small |
| `courses/generate` | Approved | none | `domain` must have concepts (`curriculum.ts` throws first), `goal` free | yes (new row per call) | Sonnet 4096 out about $0.04 |
| `tts` | Approved | 200/hour/instance in memory | 4000 chars | n/a (no cache) | ElevenLabs, up to 4000 chars; 800k chars/hour per learner per instance |
| `openai-tts`, `whisper`, `quiz` POST | NONE | none | URL length / body | n/a | C2 |
| `admin/rag/*`, `kg/*` | Admin | none | admin only | n/a | OpenAI embeddings, Sonnet; only reachable by admins (and by anyone while C1 is open) |

What a single signed-up account could spend in an hour today, realistically: the interactive route is capped (about 48 generations, under $10); everything else is uncapped, so the answer is "whatever the provider rate limit allows", likely in the low hundreds of dollars per hour with a 10-way parallel script against segment-visuals + 3D + lessons (assumption, not measured). Do not rely on the in-memory TTS limit.

Hooks that already exist: `usage_events` (`cost_usd_micros`, `user_id`, `feature`, index on user and created_at, `013_usage_events.sql`), `logUsage` (`src/lib/llm/usage.ts`), the cost model in `pricing.ts`, the DB-backed counter pattern in `learn/interactive/route.ts:166-178`, the single guard function `requireApproved` (`approval.ts:51`) which every learner route already calls (make it return the budget decision), the lesson cache (`cached_lessons` unique key) and `generated_assets` / `generated_interactives` caches (reuse as the "free" path). Missing: user attribution for Anthropic calls (H1), any ElevenLabs/OpenAI whisper usage rows, failed-call rows (usage is logged only after success, so a burst of concurrent calls passes any check), and a global breaker.

## 4. Input validation (Zod)

No route uses Zod (H4). Routes with hand-rolled validation that is reasonable: `learn/interactive`, `tts`, `learn/segment-visuals`, `generate-model`, `generate-model/3d`, `auth/onboarding` (goal enum only), `profile/custom-teacher` (prefix check only). Routes with none: `teach`, `quiz` (POST), `quiz/submit`, `quiz/complete`, `learn/challenge`, `learn/explain-more`, `learn/complete`, `profile/session`, `courses/generate`, `kg/*`, `admin/*` bodies (admin PATCH takes `is_admin`/`approval_status` with typeof checks only), `whisper`, `openai-tts`, and the server actions in `src/app/auth/actions.ts`. Env vars are not validated either.

## 5. SSRF, injection, widgets, XSS, redirects

- SSRF: no server-side fetch of a user-supplied URL was found in our code. `persistAsset` fetches fal's output URL (`banana.ts:367`), a URL we receive from fal, not from the user. `/api/generate-model/3d` passes a user URL to fal (C3), which is fal's server fetching it, not ours. `profile/custom-teacher` stores a URL used only in the owner's browser (L2). Supabase storage HEAD check (`banana.ts:326`) uses a URL built from a stored path, fine.
- Prompt injection: user text reaches Sonnet/Haiku in lesson, quiz, teach, challenge, explain-more, short-answer evaluation, and (topic only) the widget generator (H2, M1, M6). The only executed output is the widget. Everything else is rendered as React text.
- V10 widget sandbox (reviewed `src/components/learn/InteractiveFrame.tsx`, `src/lib/interactive/shell.ts`): `sandbox="allow-scripts"` only (`shell.ts:42`, opaque origin: no cookies, storage, parent access), `allow=` list with every powerful feature off (`InteractiveFrame.tsx:44-46`), `referrerPolicy="no-referrer"`, inner CSP `default-src 'none'; script-src 'sha256-...'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'` (`shell.ts:53-56`), host-page `frame-src 'none'` header on `/learn`, `/demo`, `/dev/interactive` (`next.config.mjs:26-31`) which stops navigation, double-`load` detection (`InteractiveFrame.tsx:116-123`), static validator (`validate.ts`) plus acorn loop guard plus a 1 s run budget, and the bridge accepts only `e.source === frameRef.current?.contentWindow` (`:84`) with a parsed message shape (`parseWidgetMessage`). For an opaque-origin sandboxed frame an `origin` string check is not possible (origin is `"null"`), so the source-window check is the correct control. Generated code is also re-validated on every cached row (`learn/interactive/route.ts:123-124`), is never stored for free-form topics, has a size check constraint (`017:30`), a `disabled` kill switch, and a spec-provenance check for KG concepts. I did not run the probe scripts (`scripts/frame.cjs`, `nav.cjs`); their results are documented in `architecture.md` and are UNVERIFIED by me. Residual risks: M9 (social engineering inside the card) and CPU use inside the budget.
- XSS: no user or LLM content is injected as HTML. `dangerouslySetInnerHTML` appears only for constant scripts. React escapes everything else.
- Open redirects: M2 (callback `next`); `signIn`/`signUp` errors redirect to fixed paths with an encoded message (fine). The admin layout redirects to `/sign-in?next=/admin/overview` but `signIn` ignores `next` (no open redirect, but the param is dead).

## 6. Secrets and config

- Tracked secrets: none found. `git ls-files` shows only `.env.example`; `.gitignore:29` ignores `.env*.local` (note: it does NOT ignore a plain `.env` or `.env.production`; add `.env` and `.env.*` with `!.env.example`). A regex scan of tracked files for `sk-`, `sk-ant-`, JWT-looking strings, fal/eleven/resend key shapes found nothing real (CI uses placeholders, `.github/workflows/ci.yml:23`). History scan for added `.env*` files found only `.env.example`. The Supabase project ref appears in docs and CLAUDE.md (not a secret). A personal email address of the owner appears in tracked plan docs (`.claude/plans/T10-ops-hardening.md`); remove it if the repo ever becomes public.
- `NEXT_PUBLIC_*` in code: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (public by design; RLS is therefore the real security boundary, see C1/H5/H6), `AVATURN_SUBDOMAIN`, `ADAPTIVE_VISUALS`, `INTERACTIVE_VISUALS`, `TTS`. No secret is prefixed `NEXT_PUBLIC_`. Note `NEXT_PUBLIC_INTERACTIVE_VISUALS` is inlined at build, so the "kill switch" needs a redeploy (as documented).
- `.env.example` completeness: lists Supabase, Anthropic, OpenAI, Google AI, ElevenLabs (+ `ELEVENLABS_PLAN` commented), FAL_KEY, Resend vars, APP_URL, feature flags. Missing from the file but read by code: `TTS_TIMESTAMPS` (`tts/route.ts:58`), and `VERCEL_URL` (auto). New vars the launch will need (CAPTCHA keys, KV/Upstash URL/token, budget limits) must be added when introduced. `GOOGLE_AI_KEY` is listed but unused (remove along with the unused `@google/generative-ai` dependency).
- Security headers (`next.config.mjs:3-16`): present: XFO DENY, nosniff, referrer policy, permissions policy (mic self), HSTS 2 years with preload (only add the domain to the preload list if every subdomain is HTTPS), `poweredByHeader: false`. Absent: CSP (L1), COOP/CORP (not needed). `typescript.ignoreBuildErrors: true` (`next.config.mjs:41`) means type errors do not fail the build; CI runs `yarn type-check` per the comment, keep that mandatory.
- Cookies/session: Supabase `@supabase/ssr` defaults (Lax, Secure on HTTPS, not HttpOnly for the browser client). `pages/learn.tsx` overrides this with its own writer (M8). JWT expiry, refresh-token reuse interval, and password policy are dashboard settings (UNVERIFIED).

## 7. Dev surfaces

Covered in L2 and C2. `/hx` and `pages/dev/*` are gated by `NODE_ENV`, the legacy `.js` routes `api/whisper` and `api/openai-tts` are live and unauthenticated (C2). Debug logging of personal data: no email/token logging found; user text is stored in `usage_events.metadata` (M4).

## 8. Dependencies

`yarn audit`: 194 findings (4 critical, 107 high, 76 moderate, 7 low), summarised in H3. On the request path and fixable now: `next` (to >=15.5.28), `openai` (form-data). Dev-only and low priority: `eslint`, `eslint-config-next`, `tailwindcss`, `vitest`, `@gltf-transform/cli`, `autoprefixer` chains (`brace-expansion`, `minimatch`, `picomatch`, `cross-spawn`, `postcss`, `nanoid`, `flatted`, `js-yaml`, `vite`); `sharp` 0.34.5 is pinned and has a high advisory fixed in >=0.35.0 (it is used by `next/image` and scripts; check before upgrading because of the pin). `@react-three/drei` 9.117.3 and `@react-three/fiber` 8.18.0 are intentionally pinned for the React 18 / Pages Router constraint, so their transitive `cross-spawn` advisory is accepted. `@google/generative-ai` is installed and unused (remove). `react-responsive-carousel`, `react-scroll`, `react-hot-toast` and `wawa-lipsync` 0.0.2 are small/low-maintenance packages with no known advisories in this audit; I did not check their maintenance status online (UNVERIFIED).

## 9. Account lifecycle

- Sign-up: M3 (no CAPTCHA, server-side password rule not enforced in code, email confirmation unverified).
- Password reset: not implemented (no `resetPasswordForEmail`), so a locked-out child or parent cannot recover the account.
- Account deletion: admin only (`api/admin/users/[id]` DELETE, `auth.admin.deleteUser`, cascades through `profiles` FKs). No self-service. Data NOT removed on deletion: `usage_events` rows (user id nulled, metadata retained), `admin_audit_log` rows (denormalized email), assets in the public bucket (not user-linked), and anything copied into `cached_lessons` (not personal). `approved_by` FK blocks deleting an admin who approved users (M4).
- Admin routes use `auth.admin.listUsers({perPage:1000})` (`admin/users/route.ts:52,101`, `admin/cost/summary/route.ts:138`): fine at today's scale, will silently truncate past 1,000 users, which matters after launch.

---

## What is already good, do not touch

- Admin authorisation is consistent: every `src/app/api/admin/**` file calls `verifyAdmin`/`requireAdmin`, plus the layout and middleware (defence in depth). Keep the service-client profile lookup pattern; only the RLS hole (C1) needs closing.
- The approval-at-SSR design (`pages/learn.tsx`, `src/app/admin/layout.tsx`) and its comment about Edge Runtime and `@supabase/ssr`: do not move it into middleware.
- `learn/interactive` route as a model for the rest: auth, bounded inputs, provenance check against stored lessons, hash cache keyed on every spec field, in-flight de-duplication, two-layer throttle, no storing of free-form output, `disabled` kill switch. Copy its budget check (`:166-178`) for the others.
- The V10 widget boundary: opaque-origin sandbox, hash-only inner CSP, `frame-src 'none'` header, source-window message check, re-validation of cached rows, run-budget guard. Do not loosen `WIDGET_SANDBOX` (never add `allow-same-origin`) and keep `frame-src 'none'` on every page that hosts widgets.
- RLS patterns of migrations 012, 013, 014, 016, 017 (service-role-only policies, `REVOKE ALL` in 017): reuse for new tables.
- Service-role key is only read server-side (`src/lib/supabase/server.ts:34-39`) and is not in any `NEXT_PUBLIC_*` variable; `.env.example` has placeholders only; `.env*.local` is ignored.
- `lesson`/`interactive` caches (`cached_lessons`, `generated_interactives`, `generated_assets`) and the usage logging wrapper (`src/lib/llm/anthropic.ts`): they are the base of the quota system, keep their shape (add `userId` to tags rather than redesigning).
- Pages Router constraint for `/learn` (R3F): do not move it; none of the fixes above require it.
- `/api/tts` input handling (type check, 4000-char cap, voice picked from a table via `pickVoice`, key never reaches the client) and `/api/learn/segment-visuals` style whitelist and 8-segment cap: good building blocks, they only lack a per-user budget.
- Draco decoder self-hosted (no third-party CDN on `/learn`), `X-Frame-Options`, HSTS, nosniff, referrer policy, `poweredByHeader: false`.
