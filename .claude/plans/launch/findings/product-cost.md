# Aristo AI: product readiness and running cost before public free sign-ups

Audit by reading code only (2026-11-16, branch `fix/classroom-ux`). No project file edited, no server started, no paid call made. The Supabase MCP was down, so nothing here was checked against the live database: where a claim depends on live data (what the production KG holds, whether Supabase email confirmation is on, whether Resend has a verified domain) it is marked UNVERIFIED.

Conventions: `path:line` cites. "Table `cached_lessons`" is the lesson cache (the brief called it `lesson_cache`; that is only the admin page name, `src/app/admin/lesson-cache/page.tsx`). Prices come only from `src/lib/llm/pricing.ts` unless marked ASSUMPTION.

---

## Part 1. The stranger's journey

### 1.1 Step by step

**Landing `/`** (`pages/index.tsx`, static, `SITE_URL` hardcoded at `pages/index.tsx:8`)
- Works: full / lite / stack modes by device (`src/components/landing/stage/gate.ts`), real OG image (`src/app/opengraph-image.tsx`), nav, footer with a contact mailto.
- Broken at launch: the "For parents" block says "Every Account Is Approved by Hand. A new account waits for an administrator to approve it" (`src/components/landing/content.ts:149-150`). That becomes false the day the gate goes and is a public promise to parents. Same file also says "early prototype". The footer's only contact is a personal Gmail (`src/components/landing/SiteFooter.tsx:8`) and its legal row is an empty array (`SiteFooter.tsx:18-22`): no /privacy, no /terms, for a product whose users are 11 to 14 year olds.
- Phone: landing has a lite mode (stills) for phones/weak GPUs. Fine.

**`/demo`** (`pages/demo.tsx`)
- Works and is the best asset: four narrated topics, 61 pre-rendered mp3s, zero API calls, Jake only (`.claude/docs/state.md` 2026-10-15). CTAs to `/sign-up` exist (`DemoClient.tsx:143,279`).
- Gaps: the demo teaches 4 topics, the signed-in product offers a Python course (see 1.3). Nothing tells a demo visitor what the free allowance will be.

**Sign-up `/sign-up`** (`src/app/sign-up/page.tsx`, action `src/app/auth/actions.ts:21-39`)
- Works: name, email, password (min 8, HTML only, `sign-up/page.tsx:71`), server action, error banner.
- Missing: no terms/privacy consent, no age or parent-consent step (users are grades 6 to 8), no CAPTCHA/bot check (with the gate gone, every bot signup would get an allowance), no password-strength hint (UX backlog item 14), no Zod on the form (global rule), `emailRedirectTo` not set (`actions.ts:24-32`) so the confirmation link target depends entirely on the Supabase dashboard "Site URL".
- Confusing: after sign-up the user is sent to `/sign-in?message=Check your email to confirm your account` (`actions.ts:38`) unconditionally. If Supabase "confirm email" is off (the `/pending` comment at `pending/page.tsx:18` implies it may be), nothing arrives and the user is stuck. UNVERIFIED which.

**Email confirmation**
- Callback exists: `src/app/auth/callback/route.ts:5-25` exchanges the code, then goes to `/learn` (or `?next=`; `next` is not validated, `callback/route.ts:8,25` is an open-redirect only to same origin because it is prefixed with `origin`, so low risk).
- Email templates: none in the repo. Confirmation mail is Supabase's default template and default shared SMTP (general knowledge, UNVERIFIED in dashboard: that sender is heavily rate limited, a few mails per hour, which would break a public launch on its own). Branded templates + custom SMTP (Resend) are not set up in code.

**`/pending`** (`src/app/pending/page.tsx`, `PendingView.tsx`)
- Dead end by design: "You'll receive an email as soon as you're cleared" (`PendingView.tsx:~47`), a demo link, Sign out. It goes away with the gate.
- The "you're approved" mail uses `RESEND_FROM` defaulting to `onboarding@resend.dev` (`src/lib/email/resend.ts:44-46`). Resend's sandbox sender only delivers to the account owner (general knowledge), so approved users may never have received it. UNVERIFIED whether a domain is verified; `.env.example:41-44` shows it optional.

**Onboarding** (`src/components/onboarding/OnboardingView.tsx`, `src/app/api/auth/onboarding/route.ts`)
- Works: 3 questions (goal, daily time, subject), step dots, error text, 44px targets.
- Broken/odd: subject choice is hardcoded to two domains, `python_programming` and `middle_school_science` (`OnboardingView.tsx:47-50`; UX backlog item 1). Of those, the only seed in the repo is Python (`supabase/seeds/python_intro.ts`, 38 concepts); `middle_school_science` appears nowhere else in `src`, `scripts` or `supabase` (grep). So a student who picks "Middle School Science" may land on nothing (UNVERIFIED against the live DB). The goal "exam prep / certification" copy is adult-oriented (`OnboardingView.tsx:36`).
- API: no Zod, `domain` is any non-empty string (`onboarding/route.ts:28-30`), not checked against real domains. Not behind approval (fine).
- Python for 11 to 14 year olds is not the product pitch (the landing sells science/maths topics and the demo is volcanoes, brains, hearts, slope). Product and first-run content disagree.

**Picking a subject/course** (`ModePicker.tsx`, `src/app/api/courses/*`)
- Works: Explore freely / Build my course / published courses list, loading dots, empty state ("No courses yet. Build one above", `ModePicker.tsx:174`), generate error banner.
- Cost trap: "Build my course" calls Sonnet (`curriculum.generateCourse`, max_tokens 4096, `agents/curriculum.ts:153`) every click, with no cache, no throttle, and saves a new unpublished course row each time (`api/courses/generate/route.ts:51-65`). `domain` is unvalidated (`route.ts:23`).
- The picker's list shows published courses only (`api/courses`), so a new user depends on an admin having published at least one.

**`/learn` lesson (5 phases)** (`pages/learn.tsx` -> `LearnClient.tsx`, `useCourseAutoTeach.ts`, `useLessonPlayback.ts`)
- Works: SSR auth gate, R3F scene, loading overlay, panel/bottom sheet on phones (state.md 2026-10-26), director, plan-driven TTS, per-segment visuals, widget, quiz on the desk.
- **Dead screen on failure (blocker).** `useCourseAutoTeach.ts:57-65`: if `/api/learn/lesson` is non-OK (Anthropic out of credit, 500, 429, 403) it only `console.error`s and sets `isLoading=false`. Then `LearnClient.tsx:350` renders `CourseLoadingBar` ("Loading your lesson...") whenever `!lessonLoaded`, forever. No message, no retry, no way to tell the student anything. Same for a lesson that takes the whole 60 s `maxDuration` (`lesson/[conceptId]/route.ts:29`) and 504s.
- No lesson streaming (T09 not done): a fresh lesson is a 30 to 60 s blank wait behind a "Loading your lesson..." bar.
- fal credit runs out mid-lesson: segment visuals fail per segment and playback continues without images (`segment-visuals/route.ts:139-158`, `useLessonPlayback.ts:491-493` swallows). Acceptable degradation, but silent. The "View in 3D" click failure is console-only (`Experience.tsx:262-264`): the student clicks, a spinner, nothing.
- ElevenLabs out of credit/429/500: `fetchTts` throws, `useTTS.ts:555-559` logs and calls `onEnd`, so segments race past in silence with captions only. No "voice unavailable" notice, no fallback to the browser voice (the browser fallback exists only for pre-rendered demo audio, `useTTS.ts:523-528`).
- Explain more failures are swallowed (UX backlog 5); mic unsupported falls back silently (backlog 4).
- No WebGL-unsupported fallback anywhere in `/learn` (grep for webgl/getContext found nothing): old/locked-down school devices get a loading screen or a crash. No error boundary for the page; no `error.tsx`/`global-error.tsx` (see 1.2).
- Phone: portrait bottom sheet, landscape drawer, widget large view fit (state.md). Not verified on a real phone; "Mobile /learn: 3D perf budget, touch controls" is still listed as un-audited backlog (`plans/README.md` "Backlog"). Jake scene is 2.4 MB plus clips 0.7 MB plus classroom 1 MB (`public/models`), which is acceptable.

**Quiz** (`handleTakeQuiz`, `LearnClient.tsx:258-272`; `api/quiz/lesson/[conceptId]`)
- Works: 4 mixed questions, local grading for objective types, Haiku for short answer, mastery + SRS update (`api/quiz/submit/route.ts`).
- Failure: if quiz generation fails, `handleTakeQuiz` catches, logs, and nothing happens: the button un-spins and the student sees no error.
- Quiz is generated fresh per attempt per user (Sonnet, `agents/assessment.ts:271-279`, max_tokens 3000), never cached per concept.
- Integrity: `quiz/submit` trusts `correctAnswer` sent by the client (`submit/route.ts:~50-62`), so mastery can be faked. Matters for any future "progress" claims or paid reports, not for cost.

**Review / spaced repetition** (`ReviewView.tsx`, `api/quiz/review`, `srs/*`)
- Works: due chip polled every 5 min (`LearnClient.tsx:145-162`), FSRS, Haiku review questions.
- Gaps: no email/push reminder (V6 parent digest and V5 motivation loop not built), so "coming back tomorrow" depends on the student remembering.

**Coming back next day**
- Works: course progress and mastery are in Supabase (`user_course_progress`, `user_concept_mastery`), `/learn` SSR reads domain (`pages/learn.tsx:94-99`); Zustand persists only to sessionStorage, so a new day starts at the picker, with the due-review chip if anything is overdue.
- A page reload mid-lesson re-fires `GET /api/learn/lesson/:id` (`useCourseAutoTeach` keys on a ref, lost on reload), so any "lessons used" counter must be idempotent per (user, concept, day) or reloads burn allowance.

### 1.2 Checklist the brief asked for

| Item | State | Evidence |
|---|---|---|
| Password reset / forgot password | **Missing** | no `resetPasswordForEmail`, no `/forgot-password`, `/update-password` (grep). Sign-in page has no link. A locked-out student has no recourse except the owner. |
| Email verification | Supabase default only | `actions.ts:21-39`, `callback/route.ts`; templates and SMTP unverified, see above |
| Email templates | Only 2 admin/user Resend mails, both about the approval gate | `lib/email/resend.ts:95-170`. No welcome, no verification, no reset, no lesson reminder. |
| Sign-out | Works | `LearnClient.tsx:99-105`, `auth/actions.ts:41-45`, `PendingView` |
| Account / settings page | **Missing** | no route; only a theme toggle in the top bar |
| Account deletion | **Missing for users** (admin-side only) | `api/admin/users/[id]/route.ts`; no self-service, needed for a children's product (GDPR/COPPA) |
| Profile editing | **Missing** | goal/time/subject asked once at onboarding, no way to change; `/create-teacher` only changes the avatar |
| See progress/mastery | **Exists** | Progress dialog `DashboardView.tsx` (streak, time, mastery, weak concepts), course map with mastery colouring `CourseMapView.tsx`. Failure has no retry (backlog 8). |
| 404 | Minimal | `src/app/not-found.js`: "Page not found :(", no link home; App Router only |
| 500 / error page | **Missing** | no `error.tsx`, `global-error.tsx`, no `pages/404.tsx`/`500.tsx`; `/learn` (Pages Router) gets the framework default |
| SEO basics | Partial | `metadata` + OG + icons in `src/app/layout.tsx:12-27`; `metadataBase`/canonical **hardcoded to `https://aristo-ai-ten.vercel.app`** (`layout.tsx:9`, `pages/index.tsx:8`, also `pages/demo.tsx`). **No `sitemap`, no `robots`** (`src/app` listing has neither; `public/` has no robots.txt). `/learn`, `/admin`, `/pending`, `/sign-*` have no `noindex`. |
| Analytics | **None** | `package.json` has no analytics/PostHog/Plausible/Vercel Analytics dependency |
| Error monitoring | **None** | no Sentry; failures are `console.error` only, so on Vercel they are visible only in function logs. The dead-screen failure above would be invisible. |
| Feedback / contact | Personal Gmail in footer only | `SiteFooter.tsx:8`. No in-app feedback widget, no report-a-wrong-answer button (lessons "can be wrong", `content.ts` PARENTS_COPY). |
| Onboarding emails / Resend | Code wired for 2 mails; sandbox sender; not for users' lifecycle | `resend.ts`; `RESEND_FROM` defaults to sandbox (`resend.ts:44-46`). UNVERIFIED in Vercel env. |
| Legal | **Missing** | `SiteFooter.tsx:18-22` comment: "Legal pages do not exist yet". No terms, privacy policy, cookie notice, age gate. |

### 1.3 What a brand-new user's knowledge graph and content actually are

- Repo seeds: exactly one: `supabase/seeds/python_intro.ts`, 38 concepts (grep count), no seed for science, maths or anything else. Migrations contain no content (`010_rag.sql` only creates `reference_chunks`; there is no content/ folder and no ingest manifest, T11 "content seeding" is unchecked in `plans/README.md`).
- The landing KG snapshot proves the production DB had a published course "Complete Python Programming: From Basics to Advanced" with 20+ concepts and 21 edges (`src/data/landing/kg-snapshot.json`, `taken`/`nodes`). Anything beyond that is UNVERIFIED (Supabase MCP down).
- RAG: table exists, no seed corpus in the repo; per `plans/README.md` audit and T11 "RAG is unseeded". `retrieveContext` failing returns `[]` (`lesson route:112`) so lessons work from model priors. Not fatal, but the "grounded in references" claim is empty.
- Free mode ("Explore freely", `/api/teach`) works for any topic string, which is the only way a non-Python student gets content, and it is the unbounded-cost path (see 1.5).
- Net effect for a stranger who picks "Middle School Science": at best a course an admin generated, at worst an empty picker or a free-form lesson generated on the spot at full price. This is the largest product-readiness gap after legal and error handling.

### 1.4 Unfinished / hidden / embarrassing features, with a recommendation

| Feature | State | Recommendation |
|---|---|---|
| `/create-teacher` custom Avaturn avatar (`src/app/create-teacher/*`, `api/profile/custom-teacher/route.ts`, link in `TeacherControls.tsx`) | Needs `NEXT_PUBLIC_AVATURN_SUBDOMAIN`; custom rigs keep a weaker clip set and 0.4 smile (`CLAUDE.md`); the API stores any `https://` URL as a GLB the scene then loads (`custom-teacher/route.ts:19`), not behind approval | **Hide behind flag.** It is a child-facing upload-a-face flow with no consent text; keep off for launch. |
| `/aristo` | Redirect stub to `/learn` (`src/app/aristo/page.tsx`) | Remove (or leave, harmless). |
| `/hx` | Local-only admin harness, 404 in production (`hx/admin/[[...slug]]/page.tsx:10`), "excluded from git" | Keep local; confirm it is gitignored (comment says so). |
| `/dev/*` Pages Router pages | Gated by `NODE_ENV` (`pages/dev/*.tsx`) | Keep. |
| Admin pages (`src/app/admin/*`: overview, users, courses, KG, lesson cache, RAG, misconceptions, moderation, quiz analytics, cost, audit log, system) | Real and gated by `verifyAdmin`/layout; the Users page's Approve/Reject goes away or turns into plan management | Keep; add per-user spend column to `cost`. |
| Free chat ("Explore freely", `/api/teach`, `InputBox.tsx`) | Works; Haiku; no length caps on `topic`/`history` (`teach/route.ts:111-124`), no per-user cap (UX backlog 10) | **Keep, but cap** (turns per month, topic <= 200 chars). It is the cheap, impressive path; it is also an open prompt box for children (no content-safety layer beyond the system prompt). |
| Voice input (mic, Web Speech) (`InputBox.tsx`) | Chrome/Edge only, silent fallback + `alert()` (backlog 4) | **Hide behind flag** or ship with a proper unsupported state; Permissions-Policy already allows mic. |
| Whisper/TTS routes "planned" | Not present as routes now (`/api/tts` only) | n/a |
| Courses: "Build my course" per user | Uncached Sonnet call per click | **Finish**: one course per domain, shared and published; remove per-user generation for free tier. |
| Interactive widgets (V10) | Off by default, `NEXT_PUBLIC_INTERACTIVE_VISUALS` (`.env.example:60`), already has throttle + `overBudget` (`api/learn/interactive/route.ts:132,166-178`) | **Keep behind the flag**; enable only for cached/curated concepts; best demo of the product. |
| 3D model generation (Tripo, click-only) | Costly ($0.30 to $0.52), failure silent (`Experience.tsx:262`) | **Paid-only** (or catalogue-only pre-generated); surface errors. |
| MJ teacher | Second teacher; no TTS voice entry for key `mj` (`src/lib/tts/voices.json` has marcus/ryan/priya/sonia/custom/jake, default marcus), so MJ speaks with a male voice on `/learn` (confirmed by memory note `mj_demo_narration_todo`) | **Hide MJ** until she has a voice, or add the entry. |
| Teacher archive roster (Ryan, Sonia, Marcus, Priya) | Archived, not offered | Keep archived; `public/models` still ships 4 x 10 MB of unused GLBs (not served unless requested; fine). |
| Landing copy about manual approval | Stale | Rewrite (see 1.1). |
| `POST /api/quiz` (legacy, `src/app/api/quiz/route.ts`) | **No auth at all**; Haiku call per request, `topics` unbounded (`route.ts:34-52`); no caller in `src`/`pages` (grep) | **Delete now.** It is a public free Anthropic proxy (see Part 3). |

### 1.5 What removing the approval gate touches (and the entitlement that replaces it)

Everything that reads approval, with line cites:

**Server gate (replace the body of `requireApproved`; call sites stay)**
`src/lib/auth/approval.ts` (whole file: `verifyApproved`, `requireApproved`, `getUserApprovalStatus`). Call sites, all `requireApproved()`:
`api/learn/lesson/[conceptId]/route.ts:40`, `api/learn/explain-more:18`, `api/learn/challenge:21`, `api/learn/complete:21`, `api/learn/next:22`, `api/learn/interactive:63`, `api/learn/segment-visuals:75`, `api/generate-model:21`, `api/generate-model/3d:28`, `api/teach:122`, `api/tts:63`, `api/quiz/lesson/[conceptId]:24`, `api/quiz/review:20`, `api/quiz/submit:47`, `api/courses:14`, `api/courses/[id]:19`, `api/courses/generate:27`.
Not gated today, only `getUser()`: `api/profile/*`, `api/learn/overdue-count`, `api/quiz/complete`, `api/auth/onboarding`, `api/profile/custom-teacher`. Those are DB-only (free) and can stay on auth only.

**Page gate**: `pages/learn.tsx:82-91` (SSR redirect to `/pending`). `src/middleware.ts:54-57` lists `/pending` as protected, `:65-69` bounces signed-in users off sign-in/up.

**Pending/notification flow**: `src/app/pending/page.tsx` and `PendingView.tsx`; `notifyAdminOfNewSignup` fired from `auth/callback/route.ts:23` and `pending/page.tsx:20`; `sendAdminNewSignupEmail` and `sendUserApprovedEmail` in `lib/email/resend.ts` (the first reads `approval_status !== "pending"` at `:67-71`).

**Database**: `profiles.approval_status` defaults to `'pending'` (`migrations/015_user_approval.sql:7-8`); also `approved_at`, `approved_by`, `admin_notified_at`, index at `:15`.

**Admin**: `api/admin/users/route.ts:22,62,68,144` (select/filter/shape), `api/admin/users/[id]/route.ts:94-145` (PATCH approve/reject + email), `src/app/admin/users/page.tsx` and `_components/UserDetailDrawer.tsx` (buttons, status filter), `src/app/hx/admin/mocks.ts` (local only).

**Public copy**: `landing/content.ts:149-150`; `PendingView` demo teaser "no approval needed".

**The replacement: one `requireEntitlement(feature)`**, same shape as `requireApproved` (returns `{ user, plan, error }`), called at the same 17 sites with a feature/cost class, so the "free now, subscription later" swap is one function:

```
requireEntitlement(feature, { cost: "free" | "llm_small" | "llm_lesson" | "media" | "voice" })
  1. auth user (401)
  2. load entitlement row: plan ('free'|'paid'|'blocked'), period_start, counters
  3. blocked or global kill-switch on -> 403/503 with a human message
  4. feature allowed on this plan? (3D, interactive, voice: paid-only on free)
  5. counter + budget check (lessons_fresh_used < N, voice_chars_used < M, spend_micros < cap)
  6. return a `commit(units)` the route calls only AFTER a cache miss actually generates
```

Rules for the check, learned from the code:
- It must sit on the cache MISS branch, not before the cache lookup: `lesson/[conceptId]/route.ts` returns the cached payload at `:85-90` before generation at `:144`; put the fresh-generation check between them. Same in `interactive/route.ts` (already structured this way at `:129-139`), `segment-visuals` (before `generateInfographic`, which reports `cached`), `generate-model/3d` (before `generate3dModel`).
- Counters must be idempotent per (user, concept, day) because a page reload re-fires the lesson fetch.
- The existing per-user budget pattern is `overBudget()` in `api/learn/interactive/route.ts:166-178` (counts `usage_events`). It cannot be copied as-is for money: lesson, quiz, challenge, explain-more, and curriculum calls are logged with no `userId` (`agents/teaching.ts:761-764`, `assessment.ts:213,279,326,365`, `teaching.ts:832` pass no user), and ElevenLabs is not logged at all (`usage.ts:13` provider union is anthropic/openai/fal; `api/tts/route.ts` has no `logUsage`). So per-user spend from `usage_events` today misses the two biggest lines (lesson generation, voice). Fix = thread `userId` through the agents and log TTS (Part 3, "blocks").
- In-memory throttles (`api/tts/route.ts:42`, `interactive/throttle.ts`) reset per serverless instance; fine as a speed bump, useless as a cap. Caps need a DB counter (Postgres function that increments and returns remaining, atomically).

---

## Part 2. Unit economics

### 2.1 Prices in the code (and what is missing)

From `src/lib/llm/pricing.ts` (USD):
- Sonnet 5 (`claude-sonnet-5`, `agents/models.ts:8-15`): $2 in / $10 out per 1M; cache read $0.20, cache write $2.50 (`pricing.ts:35`).
- Haiku 4.5 (`MODELS.fast`): $1 in / $5 out; cache read $0.10 (`pricing.ts:39`).
- fal: Nano Banana Pro $0.15 per image; Nano Banana 2 $0.08; FLUX Schnell $0.003; Tripo3D v2.5 image-to-3D $0.30 (standard texture + PBR); multiview-to-3D $0.40 (not pinned to the API: "reconcile against the dashboard", `pricing.ts:74-79`); FLUX-Kontext edit $0.04 each (`pricing.ts:65-81`).
- OpenAI embeddings $0.02 per 1M tokens (negligible; one embed per KG-concept lesson miss).
- **ElevenLabs: no price anywhere in the code.** Known from the repo: free tier "10 000 chars/month" (`api/tts/route.ts:31`), turbo model costs 0.5 credit per character (derived: 14,908 chars = 7,490 credits, `state.md` 2026-10-15), multilingual_v2 is the paid Jake voice (`voices.json`). The dollar rate per credit is **missing**, so every TTS dollar figure below is a parameter `r` ($ per 1,000 characters), shown at three ASSUMPTION values: $0.05, $0.11, $0.22. The last two are my back-of-envelope from public plan pricing (about $22 per 100k credits, so $0.11 per 1k chars on a 0.5-credit model and $0.22 on a 1-credit model); not in the code, check your plan or call the ElevenLabs pricing endpoint before relying on it.
- Vercel, Supabase (storage egress for cached assets, DB), Resend, payment fees: not in the code; excluded.

Measured anchors in the repo (`state.md`, `plans/V2-instant-public-demo.md:55-60`, `.claude/docs/state.md` "Real per-concept economics"):
- Narration is about 3,700 characters per lesson: 14,908 chars for the four demo topics (`state.md` 2026-10-15) = 3,727 each. (Earlier demo: 7,029 chars for 2 topics, 30 mp3s: 3,500 each.)
- A lesson's structured payload is about 14 to 15 KB (`src/data/demo/{brain,heart,volcano-eruption}.ts`: 15.0, 14.4, 14.6 KB), roughly 4,000 output tokens at 3.5 chars/token.
- About 4.5 images per concept were measured in `usage_events` in the Pro era ($0.68), 3D $0.07 then $0.30 (`state.md` T07 section). Segment visuals have since moved to the $0.08 tier (`segment-visuals/route.ts:129-140`).
- The only measured Anthropic lesson cost is old: two demo lessons plus one retry cost $0.38 at Sonnet 4.6 pricing ($3/$15), about $0.13 per generation then, about $0.085 at today's $2/$10.

There is no table or query in the repo that shows current per-feature cost per lesson; the admin cost page (`/admin/cost`, `api/admin/cost/summary`) can give it from production `usage_events`: run it before committing to numbers (see Part 3).

### 2.2 (a) One fresh lesson, everything on

Assumptions are in brackets.

| Line | Arithmetic | USD |
|---|---|---|
| Lesson generation, Sonnet 5, adaptive tool | input: system 16.5 KB (about 4.1k tok) + tool schema 5.3 KB (1.3k) + concept/RAG/profile about 1.5k = about 7k tok x $2/M = $0.014 (about $0.006 if the 5.4k static prefix hits the prompt cache); output about 4.2k tok x $10/M = $0.042 | **0.056** (typical band 0.05 to 0.06) |
| ... worst case | 8,192 max_tokens twice (a retry is a full second call, `teaching.ts:743-748`) = 2 x (0.014 + 0.082) | **0.19** |
| Segment visuals, NB2 | the prompt's format example has 4 visuals in 12 segments (`teaching.ts:301`); 4 x $0.08 | **0.32** (cap 8 = 0.64, `segment-visuals/route.ts:62`) |
| Topic teaching image, NB Pro | $0.15, only when `should_generate_model` (physical topics) | 0.15 |
| 3D source, FLUX | $0.003 | 0.003 |
| 3D model, Tripo, **on click only** (`Experience.tsx:240`) | single $0.30; multiview (when the agent asks) 3 x $0.04 + $0.40 = $0.52 | 0.30 to 0.52 |
| Interactive widget, Sonnet 5 | V10 plan: "4 to 6k output tokens" (`plans/V10-interactive-visuals.md:19`); input about 5k: 5k x $2/M + 5k x $10/M = $0.06; worst (10,000 out, retry) about $0.22 | 0.06 |
| Quiz (4 questions), Sonnet 5 | out about 1.5k x $10/M + in about 1.5k x $2/M | 0.018 |
| Narration TTS, 3,700 chars | 3.7 x r | 0.19 at r=$0.05; **0.41** at $0.11; 0.81 at $0.22 |

Design rule from the code: a lesson gets a 3D model **or** a widget, never both (`normalizeInteractive`, `teaching.ts:~699-702`; decisions.md V10). So "everything" is two shapes:

| Shape | Sum excluding TTS | With TTS at r = 0.05 / 0.11 / 0.22 |
|---|---|---|
| Physical topic, teaching image + 4 visuals + 3D (single view) + quiz | 0.056 + 0.15 + 0.003 + 0.32 + 0.30 + 0.018 = **$0.85** (multiview $1.07) | 1.04 / 1.26 / 1.66 |
| Concept topic, 4 visuals + widget + quiz | 0.056 + 0.32 + 0.06 + 0.018 = **$0.45** | 0.64 / 0.86 / 1.26 |
| Hypothetical "all of it" (not reachable by design) | $0.91 | 1.10 / 1.32 / 1.72 |

Image prompts are inside the lesson payload, so regenerating a lesson also regenerates its images (new prompts, new hash keys): lesson cache and asset cache hit or miss together (see 2.3).

Where money goes: visuals (about 55 to 70 percent), then 3D, then TTS. Lesson text is the cheap part (about $0.06).

### 2.3 (b) The same lesson served from the caches

- Lesson: `cached_lessons` hit returns the stored payload for `$0` (`lesson/[conceptId]/route.ts:76-90`). Key is `(concept_id, profile_signature)` and the signature is six profile fields (`moderation-rules.ts:83-94`): expertise, pace, depth, example preference, weakest and strongest Bloom level. New users have null Bloom levels, so they share a signature at first; as `learner_profiles` diverges (the profiler updates every session), signatures fragment and each new signature is a miss that pays the whole table above again. Which signatures exist in practice is UNVERIFIED (needs a `select profile_signature, count(*)` on production). Free-tier lesson: force `profileSignature(null)` to guarantee hits.
- Images and 3D: `generated_assets` L2 keyed by prompt hash (`banana.ts:150-258`, T06), so a hit costs `$0` and writes no `usage_events` row (proven, `plans/T06-persistent-generation-cache.md:87-88`). Hits only occur when the prompt is identical, i.e. when the lesson itself was served from `cached_lessons`.
- Widget: `generated_interactives` keyed by spec hash (`api/learn/interactive/route.ts:117-127`), `$0` on hit. Free-form topics are never cached (`:112-115`).
- Remaining per-user cost on a fully cached lesson: **narration TTS, and the quiz.**
  - TTS is not cached anywhere: `useTTS.ts` caches 4 prefetched items in the browser (`PREFETCH_MAX = 4`) and shares in-flight requests; it explicitly refetches on later playback ("speaking the same text again later fetches again", `useTTS.ts:134-136`), `/api/tts` returns `Cache-Control: no-store` and does no server-side storage (`route.ts:113,141`). So every user, every playback, every replay pays full ElevenLabs price: **per-user unavoidable** today, 3.7 x r per lesson.
  - Quiz is generated per attempt for every user: $0.018 (`agents/assessment.ts:271`).
  - Plus Supabase storage egress for cached images/GLBs (not priced in code).
- So a cache-served lesson costs about **$0.02 + 3.7r** = $0.21 / $0.43 / $0.83 at r = 0.05 / 0.11 / 0.22. At the middle rate the cached lesson is still about half the price of the fresh concept-topic lesson, purely because of uncached TTS.
- Fix that makes the cached lesson nearly free: server-side audio cache. The pattern already exists for `/demo` (`scripts/prerender-demo-tts.mjs`, mp3 + `.align.json`); mirror it into the `generated-assets` bucket keyed by `sha256(voice|model|text)`, written once on first generation, served as a URL to everyone after. Then per-user TTS goes to about $0 for cached lessons and cost becomes one-off per lesson.

### 2.4 (c) Turns

| Turn | Arithmetic | USD |
|---|---|---|
| Explain more (Haiku, 512 max, `teaching.ts:814-832`) | in about 0.5k x $1/M + out about 0.15k x $5/M | **0.0013** (+ TTS of about 400 chars = 0.4 x r, 0.02 at r=0.05) |
| Free chat turn (Haiku, 1,536 max, `teach/route.ts:159-177`) | system cached read about 1.5k x $0.10/M + in 0.1k x $1/M + out about 0.7k x $5/M | **0.0038 to 0.006** (+ narration of about 600 chars = 0.6r: 0.03 to 0.13). If it flags `should_generate_model`: + NB Pro $0.15 + FLUX $0.003, uncached across users, + 3D click $0.30 |
| Short-answer evaluation (Haiku 512 max, `assessment.ts:357-365`) | in about 0.4k x $1/M + out about 0.15k x $5/M | **0.0012** (objective questions are graded locally: $0) |
| Challenge evaluation (Haiku, 256 max) | about 0.3k in + 0.1k out | 0.0008 |
| Review question (Haiku, per due concept, `assessment.ts:318-326`) | about 0.3k in + 0.4k out | 0.0023 |
| Build my course (Sonnet, 4,096 max, `curriculum.ts:150-156`) | in about 3k x $2/M + out about 2.5k x $10/M | **0.03**, uncached, per click |

### 2.5 Per-user-unavoidable vs amortised

| Amortises across users (when the cache hits) | Always per user |
|---|---|
| Lesson text ($0.056), segment visuals ($0.32), teaching image, 3D ($0.30 to 0.52), widget ($0.06): paid once per (concept, signature) | Narration TTS (until audio is cached), quiz generation (until cached per concept), explain-more, free chat, answer evaluation, review questions, course building, database/egress |

The amortised half is the big half ($0.45 to $0.85 of a fresh lesson), but it only amortises if the **signature collapses** (free users share one) and the **catalogue is finite**. Free-form topics (the lesson route accepts any string, `lesson route:135-142`; free chat accepts any topic) are never cached and so are 100 percent per-user.

### 2.6 Proposed free-allowance designs

Worst-case figures assume the abuse-free maximum a user can legitimately reach under the rule, with TTS charged at r = $0.11 (uncached) unless stated, and all misses (nothing amortised). "Typical" is much lower.

**Design 1: catalogue-first (recommended).**
- Free users play unlimited curated catalogue lessons (pre-generated, pre-rendered audio, cached quiz per concept), plus 2 fresh "custom topic" lessons per month in a reduced form (at most 3 segment visuals, no 3D, no widget, browser voice or capped ElevenLabs characters), plus 15 free-chat turns per month (no image/3D generation in free chat).
- Worst case per free user per month: fresh 2 x (0.056 lesson + 3 x 0.08 visuals + 0.018 quiz) = 2 x 0.314 = $0.63; free chat 15 x 0.006 = $0.09; catalogue extras (30 lessons x 3 explain-more 0.0013 + 30 x 2 short-answer evals 0.0012 + 20 review questions 0.0023) = $0.23; **total about $0.95**, of which voice is $0 if catalogue audio is pre-rendered and the 2 fresh lessons use the browser voice (add $0.0 to $0.82 if you allow ElevenLabs on them: so keep them on browser voice or cap characters at 2,000 = $0.22).
- One-off, owner-funded catalogue: 30 lessons x $0.45 to $0.85 = $14 to $26 generation plus TTS prerender 30 x 3.7k chars = 111k chars (about $12 at r = 0.11). Total about $26 to $38 once, shared by every user forever.
- Enforcement: catalogue = lessons whose concept ids are in a `catalogue` flag on `courses`/`concepts`; fresh counter checked on the miss branch of `lesson/[conceptId]/route.ts:144` (and the free-form branch `:135-142`); chat counter in `teach/route.ts:122`; visuals cap in `segment-visuals/route.ts:70-75` (slice the batch by plan); `generate-model*` and interactive: refuse on free; `tts/route.ts:63`: serve cached audio, refuse non-catalogue ElevenLabs on free.

**Design 2: lessons per week.**
- 3 lessons per week of any kind (cached or fresh), 12 per month; voice included.
- Worst case if all 12 are fresh concept-topic lessons with no sharing: 12 x 0.86 (at r = 0.11) = **$10.3**; with 3D shapes $15. Realistic if a signature-free cache covers 80 percent: 12 x (0.2 x 0.86 + 0.8 x 0.43) = $6.2. Too high for a zero-capital launch; only acceptable together with the audio cache and forced shared signature (then about 12 x 0.02 + 20% fresh 2.4 x 0.45 = $1.3).
- Enforcement: weekly counter in the new entitlement row, same points as Design 1.

**Design 3: hard money budget plus separate voice cap (safest by construction).**
- Everything allowed except paid-only 3D and widgets, bounded by a per-user monthly spend budget of $0.50 (sum of the user's logged cost) and a separate voice allowance of 2,000 ElevenLabs characters per month (about half a lesson: $0.22 at r = 0.11); beyond it the app falls back to the browser voice; beyond the budget it serves only cached content.
- Worst case per free user per month: $0.50 + $0.22 = **$0.72, by construction.**
- Needs: per-user cost attribution (thread `userId` into the Anthropic wrappers at `teaching.ts:761`, `assessment.ts:213,279,326,365`, `teaching.ts:832`, `challenge/route.ts:63`; log TTS to `usage_events`), then a `spend_this_month(user)` function. Enforcement: one `requireEntitlement` at all 17 sites (1.5).
- Global circuit breaker on top (any design): a `usage_events` sum for the month versus a configured ceiling; above it, all fresh generation returns the "we are at capacity, catalogue lessons still work" message. Also set provider-side hard limits (Anthropic workspace spend limit, fal prepaid balance, ElevenLabs plan quota), which are the only caps that survive a bug in this app.

Recommendation: Design 1 for the product promise, with Design 3's budget/kill-switch machinery underneath as the safety net. Reject Design 2 unless the audio cache and shared signature ship first.

### 2.7 What a paid tier must cost

Cost model per paying student per month (assumptions: 12 lessons a month, mix of 70 percent catalogue/cached and 30 percent fresh, quiz each lesson, 40 chat turns, 30 explain-more/evals, 3D on 1 in 4 fresh physical lessons; fresh lesson about $0.55 average between the widget shape $0.45 and the 3D shape $0.85 excluding TTS):

| Scenario | Arithmetic | Cost / month |
|---|---|---|
| Optimised (audio cache, catalogue, shared signature): fresh 3.6 x $0.55 + quiz 12 x 0.018 + chat 40 x 0.006 + misc 30 x 0.0013 + fresh-lesson TTS 3.6 x 0.41 | 1.98 + 0.22 + 0.24 + 0.04 + 1.48 | **about $4.0** |
| As today (no audio cache): every lesson pays TTS 12 x 0.41 = 4.92, fresh 1.98, quiz 0.22, chat 0.24, misc 0.04 | | **about $7.4** |
| Heavy user, all fresh, no sharing: 30 x (0.55 + 0.018 + 0.41) | | **about $29** |

Price to keep margin, with payment fees as an assumption (about 3 percent + $0.30 per charge, not in the code):
- Target 70 percent gross margin on the typical user: price = cost / 0.3 + fees. Optimised: 4.0 / 0.3 = $13.3 -> **$13 to $15/month** (family/parent plan). Today's cost structure: 7.4 / 0.3 = $24.7 -> **$25+**, which is too expensive for the market, so the audio cache is a pricing prerequisite, not an optimisation.
- Floor at 50 percent margin: optimised $8 to $10; unoptimised $15.
- Needs per-user fair-use limits (for example 20 fresh lessons per month) so the 5 percent heavy tail ($29) cannot flip the average: at 20 fresh lessons the cap is 20 x 0.98 = $19.6, still above a $15 price, hence the 3D and widget features should stay quota-limited on paid too (for example 3D: 4 per month, +$1.2 to 2.1).
- Annual/school pricing: per-seat cost is lower (teachers repeat the same catalogue lessons): shared cache makes marginal seat cost near the quiz/chat floor of about $0.5 to $1.5/month.

All TTS dollar figures move linearly with `r`; recompute once the actual ElevenLabs plan price is known.

---

## Part 3. Prioritised list

Effort S = under a day, M = 1 to 3 days, L = a week or more. "Cheaper model" = can a Sonnet/Haiku session do it from a short brief.

### A. Blocks a public free launch

| # | Item | Evidence | User / business impact | Effort | Cheaper model? |
|---|---|---|---|---|---|
| A1 | Delete the unauthenticated `POST /api/quiz` | `src/app/api/quiz/route.ts` has no auth check (the only such route; scan of every `route.ts`); `topics` is unbounded; no caller in `src`/`pages` | Anyone on the internet can spend Haiku credit through your key; becomes a target the day the site is public | S | Yes (delete file + confirm no caller) |
| A2 | Spend caps and rate limits on every paid route | `segment-visuals` (up to 8 NB2 images per request, client-supplied prompts), `generate-model` (Pro $0.15), `generate-model/3d` (arbitrary `imageUrl` string, $0.30 to $0.52 per distinct URL), `courses/generate` (Sonnet per click), `teach` (no length cap), `lesson/:id` free-form branch (uncached Sonnet for any string): no throttle except TTS 200/h in memory (`tts/route.ts:42`) and the interactive route | A single signed-up user (or a bot; no CAPTCHA) can run unbounded fal/Anthropic spend; the gate was the only protection | M | Partly: a mid-level model can build the `usage_ledger` + `requireEntitlement` from the design in 1.5; the policy numbers are yours |
| A3 | Entitlement replaces approval (free allowance, kill switch) | 17 call sites, `pages/learn.tsx:82-91`, migration `015`, 1.5 | Without it, removing the gate = open spend | M to L | Yes with the 1.5 spec; security-reviewer pass required (auth/payments rule) |
| A4 | Per-user cost attribution + TTS logging | `teach.lesson`, `quiz.*`, `teach.explain_more`, `learn.challenge` rows have no `userId` (`teaching.ts:761-764`, `assessment.ts:213,279,326,365`); ElevenLabs absent from `usage.ts:13` and `/api/tts` | The caps in A3 cannot be computed or audited; admin cost page cannot show cost per user | S to M | Yes |
| A5 | Lesson/quiz/3D failure surfaces (no dead screens) | `useCourseAutoTeach.ts:57-65` + `LearnClient.tsx:350` infinite "Loading your lesson..."; `handleTakeQuiz` silent (`LearnClient.tsx:267-269`); 3D click silent (`Experience.tsx:262`); TTS failure silent (`useTTS.ts:555-559`) | A student whose lesson fails (credit out, timeout, 429, cap reached) sees a spinner forever; once a cap exists, "you used your free lessons" must be a real screen with next steps | M | Yes (copy and states from a short brief) |
| A6 | Legal and children: terms, privacy policy, age/parent consent, account deletion | `SiteFooter.tsx:18-22` no legal pages; sign-up has no consent or age field; users are grades 6 to 8; no self-service delete (admin only) | Collecting emails, names and quiz data from minors with no consent flow is a legal exposure (COPPA/GDPR-K; get advice) and a trust blocker for parents | M to L (needs a lawyer or template, then code) | Code part yes; policy text no |
| A7 | Real onboarding content + science/maths domain | Onboarding offers 2 domains (`OnboardingView.tsx:47-50`); only Python seeded in repo (38 concepts, `supabase/seeds/python_intro.ts`); T11 unchecked; RAG unseeded | First screen after sign-up is the wrong product (Python for a "grades 6 to 8 science" pitch) or empty | L | Partly: pipeline can be scripted; human review of KG edges needed (T11) |
| A8 | Fix auth email: custom SMTP, branded confirmation, password reset | No reset flow anywhere; default Supabase mailer/limits UNVERIFIED; `RESEND_FROM` sandbox (`resend.ts:44-46`) | Sign-ups beyond a few per hour fail to receive confirmation; locked-out students are lost | M | Yes for code (`/forgot-password`, `/update-password`); the DNS/SMTP setup is yours |
| A9 | Remove public approval copy and the approval pages | `landing/content.ts:149-150`, `/pending`, admin Approve/Reject | Page makes a promise that stops being true | S | Yes |
| A10 | Pre-generated catalogue with pre-rendered audio and cached quiz | Cost model 2.3: uncached TTS + per-user quiz are the unavoidable per-user costs | Without it the free tier cannot be both generous and cheap | M to L | Yes (extend `scripts/prerender-demo-tts.mjs`; generation script exists in `scripts/generate-demo-content.ts`) |
| A11 | Error pages and monitoring | no `error.tsx`/`global-error.tsx`/`pages/500`; no Sentry; `console.error` only | You will not know the site is failing for strangers | S to M | Yes |

### B. Should fix in the first two weeks

| # | Item | Evidence | Impact | Effort | Cheaper? |
|---|---|---|---|---|---|
| B1 | Server-side audio cache for `/api/tts` | 2.3: `no-store`, no persistence | Cuts the largest per-user cost; precondition for paid-tier margin | M | Yes |
| B2 | Cache quizzes per (concept, difficulty band) | quiz generated per user per attempt | Removes $0.018 x attempts per user | S to M | Yes |
| B3 | Force a shared `profile_signature` for free users and measure signature spread | `moderation-rules.ts:83-94`; fragmentation UNVERIFIED | Turns the cache hit rate from hopeful into guaranteed | S | Yes |
| B4 | Account page: change goal/subject, sign-out, delete account, plan/usage ("2 of 3 custom lessons left") | none exists | Required by A6 and by any allowance UI | M | Yes |
| B5 | SEO and canonical: real domain constant (env), sitemap, robots, `noindex` on app routes, per-page titles | `layout.tsx:9`, `pages/index.tsx:8`, `pages/demo.tsx` hardcode vercel.app; no sitemap/robots | Link previews, indexing and Google trust on a vercel.app host | S | Yes |
| B6 | Analytics (privacy-light) + a feedback/report-wrong-answer button + a project mailbox (not personal Gmail) | none; footer uses personal Gmail | You cannot learn from early users; lessons "can be wrong" has no report path | S to M | Yes |
| B7 | Cap `/api/teach` input (topic <= 200 chars, history length), Zod on all external inputs | `teach/route.ts:111-124`, onboarding, courses/generate, `custom-teacher` URL | Cost and prompt-injection hardening; matches the global Zod rule | S | Yes |
| B8 | Welcome + "come back" emails; fix `RESEND_FROM` to a verified domain | `resend.ts` only has admin/approval mails | Retention is the product's loop; V6 parent digest depends on it | M | Yes |
| B9 | WebGL/low-end fallback for `/learn` and a real-phone pass | no WebGL check; phone behaviour unverified (`state.md`) | School Chromebooks and older phones get a dead screen | M | Partly (needs device testing) |
| B10 | Hide MJ until she has a voice, hide custom teacher, mic behind flag | `voices.json` has no `mj`; `create-teacher`; backlog 4 | Avoids the three most embarrassing first impressions | S | Yes |
| B11 | Quiz integrity: grade on the server from stored questions, not client-sent `correctAnswer` | `quiz/submit/route.ts:~50-62` | Mastery/progress numbers are forgeable; matters once progress is shown to parents or paid reports exist | M | Yes (needs storing issued questions) |
| B12 | Provider-side hard limits and a monthly global spend kill switch | none in code | The only cap that survives bugs | S | Dashboard work is yours |

### C. Nice later

| # | Item | Impact | Effort | Cheaper? |
|---|---|---|---|---|
| C1 | Lesson streaming (T09) to remove the 30 to 60 s wait | UX, not cost | L | No (Opus brief exists) |
| C2 | Parent weekly digest (V6), motivation loop (V5), teacher memory (V4) | Retention and the paying persona | M each | Yes (briefs exist) |
| C3 | Stripe subscriptions behind the same `requireEntitlement` | Revenue, after the free tier proves demand | M to L | Yes with a spec; security-reviewer required |
| C4 | NB Pro -> NB2 for the teaching image; consider Tripo "no texture" tier for free previews | Saves $0.07 per physical lesson; $0.10 per model | S | Yes (needs an A/B, costs credits) |
| C5 | Raise-hand teacher (V1), live blackboard (V3) | Product depth | L | No |
| C6 | Real-phone landscape quiz layout, 3D perf budget on phones | Polish | M | Partly |
| C7 | Strict CSP (skipped during deploy hardening, `plans/README.md` backlog) | Defence in depth | M | Partly |
| C8 | Custom domain + promote production branch to `master` | Professional URL, ties to B5 | S | Mostly yours (DNS) |

---

### Open questions the code cannot answer

1. Supabase "confirm email" on or off, and the Site URL configured (changes the sign-up journey).
2. What `cached_lessons` and `profiles` hold in production: signature spread, how many concepts per domain, whether `middle_school_science` exists. Run `/admin/cost` and `/admin/lesson-cache` before fixing the numbers in 2.2 to 2.7.
3. The real ElevenLabs plan and its $ per credit (every TTS dollar above is `r x characters`).
4. Whether Resend has a verified sending domain (the user-facing mails assume it).
