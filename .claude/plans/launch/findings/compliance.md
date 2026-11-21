# Aristo AI: data-protection and compliance audit before public sign-up

Date: 2026-11-16. Scope: audit and research only, no project code changed. Not legal advice; the owner should have a lawyer
(or the DSB's published guidance, dsb.gv.at) check the items marked DECISION. Anything not confirmed from a primary
source is marked **[unconfirmed]**.

---

## 1. One-page summary

**Where the app stands.** There is no legal layer at all. No privacy policy, terms, imprint, cookie/storage notice, consent
checkbox, age field, parental flow, self-service deletion or export, retention job, or in-lesson "this is an AI" label exists
(`src/components/landing/SiteFooter.tsx:18-24` says so: `LEGAL_LINKS = []`). The sign-up form (`src/app/sign-up/page.tsx:41-82`)
collects full name, email and password, and nothing else. The product is aimed at grades 6 to 8 (about ages 11 to 14), so it
is child-directed under COPPA and "likely to be accessed by children" under the UK Children's Code; almost every learner is
below the Austrian digital-consent age (14) and every EU one (13 to 16).

**What is good already.** No analytics, no ad or tracking scripts, fonts self-hosted at build (`src/lib/fonts.ts` uses
`next/font/google`, which downloads at build), no third-party origins loaded by the browser except the optional Avaturn iframe on
`/create-teacher`. Per-learner tables have RLS (`006_mastery.sql`). Anthropic calls never include the learner's name
(`userName` is client-only, `pages/learn.tsx:103`, `LearnClient.tsx:414`). The behavioural profile is rule-based, no LLM
(`src/lib/agents/profiler.ts`), and does no emotion or biometric inference. An admin approval gate exists
(`src/lib/auth/approval.ts`). Captions of the spoken sentence exist (`LessonPlayer.tsx:268-282`). The landing "For parents" copy
(`content.ts:143-160`) is honest and a good start for the privacy policy.

**Four things that are bad enough to fix first.**
1. `/api/whisper` and `/api/openai-tts` (`src/app/api/whisper/route.js`, `src/app/api/openai-tts/route.js`) have **no
   authentication**: anyone on the internet can send audio to OpenAI at the operator's cost and have it transcribed. No client calls them
   (grep finds no caller). Delete them.
2. RLS policy `profiles: own update` (`005_reset_and_graph.sql:80-82`) has no column restriction and no later migration revokes
   column privileges, so a signed-in user can probably set their own `is_admin` and `approval_status` through the Supabase anon
   key. Verify on the live project (the Supabase MCP was down in this session) and fix. Any age/consent column added to
   `profiles` would be forgeable the same way.
3. Voice input uses the browser Web Speech API (`InputBox.tsx:214-233`, `AnswerInputPanel.tsx:78`). In Chrome that sends the
   child's audio to Google. The landing copy says "speech to text is the browser's own" (`content.ts:155`); that is true but
   misleading by omission, and an FTC Act s.5 / GDPR Art 5(1)(a) transparency problem if left.
4. Learner free text goes to Anthropic with no input or output moderation (`/api/teach`, `/api/learn/challenge`,
   `assessment.ts:337-344`), the child's typed topic is stored indefinitely in `usage_events.metadata`
   (`src/app/api/teach/route.ts:177`, `013_usage_events.sql:66`), and the admin "moderation" page is not a safety control
   (see 3.4). Anthropic requires age verification, moderation, monitoring and AI disclosure for products minors use directly.

**Recommended model.** Parents own accounts. A child profile has a first name or nickname, a grade band and a birth year, no
email, no credentials. Everyone under 16 is a child profile (16 is the GDPR Art 8 default and the highest common ceiling, so no
country detection is needed); 16 and 17 may self-register but keep the minor safeguards. Voice, free chat and the custom
(selfie) teacher are off for child profiles until the parent opts in. See section 6.

**Legal position in one line each.** GDPR applies in full: a public service run by one person is not household processing
(Art 2(2)(c)), and the operator is the controller personally. A DPIA is needed. Art 22 is not triggered by the profile, because it only
tunes pace and depth. The EU AI Act: Art 50(1) disclosure applies now; Annex III "education" high-risk is, on its wording,
tied to institutions, so a consumer self-study tutor is outside it as long as schools do not use it; emotion recognition is not
done. COPPA applies to an Austrian operator whose service is directed to US children. A parent-owned account is the right shape
but does not by itself satisfy COPPA; verifiable parental consent (VPC) and a direct notice are still required.

---

## 2. Action lists

Effort: S under a day, M 1 to 3 days, L more. Type: C code, D document, O decision for the owner.

### 2.1 Must have before the first public sign-up

| # | Item | Legal source | What to build or write | Effort | Type |
|---|------|--------------|------------------------|--------|------|
| 1 | Delete the unauthenticated `/api/whisper` and `/api/openai-tts` routes | GDPR Art 5(1)(f), 32; also cost abuse | Remove both route files; drop `openai` audio use. OpenAI stays only for embeddings of concept strings (`src/lib/rag/embed.ts`), no personal data | S | C |
| 2 | Lock `profiles` columns | Art 32 | Migration: `REVOKE UPDATE ON profiles FROM authenticated; GRANT UPDATE (full_name, goal, daily_time_minutes) ...`, or a `WITH CHECK` that pins `is_admin`/`approval_status`. Test with an anon-key client. Add the same for any new consent/age columns | S | C |
| 3 | Privacy policy, terms, imprint, parent notice, footer and sign-up links | GDPR Art 12-14; ECG s.5; MedienG s.25; COPPA 16 CFR 312.4 | Write per section 7; fill `LEGAL_LINKS` in `SiteFooter.tsx`; link from `sign-up/page.tsx`; replace the personal email address in the footer (`SiteFooter.tsx:9`) with a role address | M | D + C |
| 4 | Parent-owned account and age model | GDPR Art 8; DSG s.4(4) (Austria, 14); COPPA 312.5 | `learners` table, parent sign-up, profile switcher, age screen (neutral, no "you must be 13" hint), per section 6. This is the biggest change: every table is keyed by `auth.users.id` (`006_mastery.sql`) | L | C + O |
| 5 | Consent record and verifiable parental consent | Art 8(2), 7(1); COPPA 312.5 | `consents` table (parent, learner, policy version, purposes, method, timestamp). VPC method decision in 9.3. Direct notice email to parent before any child data is collected | M | C + O |
| 6 | Stop collecting a child's full name | Art 5(1)(c) minimisation | Replace "Full name" (`sign-up/page.tsx:43-50`, `actions.ts:29`, trigger in `005_reset_and_graph.sql:47-53`) with first name or nickname for the learner; the parent's name is optional | S | C |
| 7 | Self-service account and child-profile deletion, and data export | Art 15, 17, 20; COPPA 312.6 | Authenticated routes: export (JSON of profile, mastery, quiz attempts, misconceptions, session logs), delete (service-role `auth.admin.deleteUser` as in `admin/users/[id]/route.ts:195-232`). Fix leftovers: `admin_audit_log.diff` stores the deleted user's `full_name` (`[id]/route.ts:226`), `usage_events.metadata.topic` survives with `user_id` nulled, audit `ip` and `user_agent` | M | C |
| 8 | Retention schedule and the jobs to enforce it | Art 5(1)(e); COPPA 312.10 (written retention policy, compliance date 2026-04-22) | Table in 3.1; scheduled deletes (pg_cron or a Vercel cron: none exists, grep finds no retention job); stop storing `topic` in `usage_events` | M | D + C |
| 9 | Processor DPAs and region | Art 28, 44-46 | Accept or sign each provider's DPA (table 4); confirm Supabase region is EU (not discoverable from the repo); add `"regions": ["fra1"]` to `vercel.json` (it has none, so functions run in Vercel's default region, which is believed to be US East **[unconfirmed]**) so lesson data is not processed in the US by the host. ElevenLabs: exercise the training opt-out (ToS s.4(i)) | S-M | O + C |
| 10 | Child-safety layer for LLM use | Anthropic "Guidelines for Organizations Serving Minors"; OpenAI under-18 guidance (if used); Art 25 | Input and output moderation on `/api/teach`, challenge and short-answer evaluation (a Haiku classifier pass or a moderation endpoint on text only); safety clauses in system prompts; crisis response text (self-harm etc.); length cap and "do not type your name or address" hint; log flags without content; a "report a problem" link; incident path including Stopline.at for CSAM | M-L | C |
| 11 | "This is an AI" disclosure in the product | AI Act Art 50(1) (applies from 2026-08-02, not deferred by the omnibus per Gibson Dunn **[provisional agreement; check OJ]**); Anthropic AUP "AI Disclosure" | Persistent label in the lesson UI and chat ("Jake is an AI teacher; it can make mistakes"), age-appropriate wording; sign-up page and landing already say AI | S | C |
| 12 | Voice input off for child profiles; fix the claim | Art 5(1)(a), 13; COPPA audio-file rule (FTC FAQ A.3, F.6); FTC Act s.5 | Hide the mic buttons (`InputBox.tsx`, `AnswerInputPanel.tsx`) unless the parent enabled voice; show a one-time notice that Chrome sends audio to its speech provider; change `PARENTS_COPY.promises[2]` | S | C + D |
| 13 | Custom (selfie) teacher off for child profiles | Art 5(1)(c), 25; third-party processing by Avaturn | Gate `/create-teacher` (`TeacherControls.tsx:108`) behind the parent opt-in; name Avaturn in the policy. `custom_teacher_glb_url` accepts any `https://` URL (`custom-teacher/route.ts:18`): restrict to the Avaturn host | S | C |
| 14 | DPIA and records of processing | Art 35, 30 | Internal documents; skeleton in 5.3 and section 3. Art 30(5) exemption does not apply (processing is not occasional) | M | D |
| 15 | Email verification and sign-up abuse controls | Art 32; Art 8(2) "reasonable efforts" | Confirm "Confirm email" is on in the Supabase project (the action text assumes it, `actions.ts:38`; setting not visible); CAPTCHA or rate limit on `/sign-up`; parent email is the only email | S | O + C |
| 16 | Remove unused `@google/generative-ai` and `GOOGLE_AI_KEY` | Art 5(1)(c), processor list accuracy | Not imported anywhere in `src/`, `pages/`, `scripts/`. Drop the dependency and the env example line so Google is not a processor that must be listed | S | C |
| 17 | Breach procedure and contact | GDPR Art 33-34 | One-page runbook: DSB notification within 72 h, who, template. Publish a privacy contact address | S | D |
| 18 | Harden `/auth/callback` redirect | Art 32 | `next` is concatenated to the origin (`callback/route.ts:8,25`); only allow paths starting with a single `/` | S | C |

### 2.2 Must have before the first payment

| # | Item | Legal source | What to build or write | Effort | Type |
|---|------|--------------|------------------------|--------|------|
| 1 | Business status and imprint data | GewO; ECG s.5; MedienG s.25; UStG | Register the trade (Gewerbe) and SVS, get a UID number if applicable, show on the imprint; decide whether a home address is public (a business address or a c/o service) **[unconfirmed: which trade licence class fits]** | M | O + D |
| 2 | Pre-contract information and "button solution" | FAGG s.4, s.8(2) (Directive 2011/83/EU Art 6, 8(2)) | Order summary with price, term, renewal, cancellation; the button labelled "order with obligation to pay" (zahlungspflichtig bestellen) | S-M | C |
| 3 | Withdrawal handling for digital content | FAGG s.11 and the digital-content exemption (Directive 2011/83/EU Art 16(m), requires express consent and acknowledgement of loss at the start) | Consent and acknowledgement checkbox before the first lesson of a paid period; or grant the 14 days and pro-rate | S | C + D |
| 4 | Withdrawal function ("Widerrufsbutton") | Directive (EU) 2023/2673, apply from 2026-06-19; Austrian transposition via VerbRÄG 2026 **[section numbers inconsistent across sources: check RIS]** | Online withdrawal function and confirmation, where a withdrawal right exists | S | C |
| 5 | Easy online cancellation | Good practice; the cancellation-button rule is German (BGB s.312k) and no Austrian equivalent was found **[unconfirmed]** | Self-service cancel in account settings, renewal reminder emails, no dark patterns (also UK AADC nudge standard) | S | C |
| 6 | Contracting party is the parent | ABGB minors rules **[unconfirmed]**; Art 8 | Only the parent account can subscribe; Terms state that | S | C + D |
| 7 | Stronger verifiable parental consent | COPPA 312.5(b) methods; Art 8(2) | The card transaction itself is an accepted COPPA method when the parent is notified; see 9.3 | M | C |
| 8 | Payment processor and tax | Art 28; EU VAT OSS | Prefer a merchant of record (Paddle, Lemon Squeezy) or Stripe plus Stripe Tax: the question is who files VAT for digital services to EU consumers. Add the processor to the policy and its DPA | M | O |
| 9 | Update privacy policy and terms | Art 13 | Payment data, invoicing retention (BAO s.132, 7 years **[unconfirmed]**), subscription terms | S | D |
| 10 | Reassess AI Act classification if any school or teacher use, certificates or "levels" appear | AI Act Annex III point 3 | One-page classification memo (5.4) | S | D |

### 2.3 Can wait

| # | Item | Why it can wait |
|---|------|-----------------|
| 1 | Cookie banner | No non-essential cookies or storage today (3.3). Needed only if analytics or third-party embeds are added (TKG 2021 s.165(3)) |
| 2 | Accessibility statement and a11y audit of the 3D scene | BaFG exempts micro-enterprise services (9.2); still do keyboard and screen-reader passes, and measure the pages the brand doc did not (sign-up, quiz sheet, admin) |
| 3 | DPO appointment | Not required at this scale (Art 37); revisit if monitoring becomes large-scale |
| 4 | UK representative (UK GDPR Art 27) and ICO fee | Decide with the first real UK sign-ups; see open question 5 |
| 5 | Annex III reassessment | Date moved to 2027-12-02 by the omnibus **[provisional agreement 2026-05-06/07; formal adoption unconfirmed]** |
| 6 | Parent weekly digest (plan V6) | Consent and unsubscribe required when built: Austrian TKG s.174 for electronic mail advertising **[unconfirmed]** |
| 7 | Replace Web Speech with an operator-controlled STT | Only if voice is wanted for children; then the Whisper route returns, with auth, ZDR and a parental consent path |
| 8 | Transfer impact assessments on file | Short note per US processor; DPF covers most (4) |
| 9 | Pen test and security review of admin | Admin can read all learner data; no MFA is visible in the code |

---

## 3. Part 1: what the code does

### 3.1 Personal-data inventory

| Data | Source (file:line) | Stored where | Who can read | Retention today |
|------|--------------------|--------------|--------------|-----------------|
| Email, password hash, last-sign-in, IP in auth logs | Supabase Auth via `actions.ts:24-32` | `auth.users` (Supabase-managed) | Owner (dashboard), service role | Until deleted; none automatic |
| Full name | `sign-up/page.tsx:43`, `actions.ts:29`, trigger `005:47-53` | `profiles.full_name` | The user (RLS own read); any admin (`admin/users/*`) | Until deleted |
| Goal, daily minutes | `api/auth/onboarding/route.ts:39-42` | `profiles.goal`, `daily_time_minutes` | User, admin | Until deleted |
| Admin flags, approval status, approver | `015_user_approval.sql` | `profiles` | User (own row), admin | Until deleted |
| Behavioural profile (expertise, pace, depth, example preference, weakest/strongest Bloom) | `api/profile/session/route.ts:102-119`, `profiler.ts` | `learner_profiles` | User (RLS), admin drawer | Overwritten each session; kept until deleted |
| Session behaviour: time on explanations/examples/quizzes, clicks, accuracy, concepts viewed | `profile/session/route.ts:53-69` | `session_logs` | User, admin | Unlimited |
| Mastery, SRS schedule per concept | `quiz/submit` | `user_concept_mastery` | User, admin | Unlimited |
| Quiz history including the **free-text answer**, correct answer, feedback, response time, misconception | `quiz/submit/route.ts:123-134` | `quiz_attempts.user_answer`, `feedback_given`, `misconception_detected` | User; admin sees metadata (drawer excludes the answer text) and aggregate pages | Unlimited |
| Misconception text per learner | `quiz/submit/route.ts:139-155` | `user_misconceptions` | User, admin (also cross-learner aggregate, `admin/misconceptions`) | Unlimited |
| Course progress | onboarding, `quiz/complete` | `user_course_progress` | User, admin | Unlimited |
| Custom teacher avatar URL (GLB made from selfie photos by Avaturn) | `custom-teacher/route.ts:22-27` | `learner_profiles.custom_teacher_glb_url` | User, admin | Unlimited |
| LLM usage, including the **child's typed free-mode topic** | `lib/llm/usage.ts`, `api/teach/route.ts:177` | `usage_events` (`user_id`, `metadata.topic`) | Service role, admin cost page (`admin/cost/events`) | Unlimited; `user_id` set null on delete, topic stays |
| Admin actions with actor email, target user id, IP, user agent, before-values (incl. deleted user's name) | `lib/admin/audit.ts`, `[id]/route.ts:226` | `admin_audit_log` | Admins | Unlimited |
| Learner free text sent to LLMs: chat topic (`/api/teach`), challenge answers (`learn/challenge/route.ts:52`), short answers (`assessment.ts:337-344`), course generation prompts | Routes above | **Not stored** by the app except as above; held by Anthropic per its retention | Anthropic | See table 4 |
| Voice, Web Speech path | `InputBox.tsx:214-233` (`lang en-US`, one result, immediate submit), `AnswerInputPanel.tsx:78` | Audio never reaches our server; goes from the browser to the browser vendor's recognition service (Google in Chrome; **[unconfirmed per browser]**); we receive only the transcript, which is then handled as typed text | n/a | Not under our control |
| Voice, Whisper path | `api/whisper/route.js` | Not called by any client; unauthenticated; would send audio to OpenAI | Anyone | Delete the route |
| IP addresses, request logs | Vercel platform logs; Supabase API/Auth logs; Resend logs | Provider-held | Owner | Provider defaults **[unconfirmed]** |
| Browser storage | 3.3 | Browser | Learner | Session or until cleared |
| Admin email notification content: name, email, user id, signup time | `lib/email/resend.ts:107-125` | Resend and the admin mailbox | Owner | Provider/mailbox |
| Generated lessons, images, models, widgets | `cached_lessons`, `generated_assets`, `generated_interactives` | Shared, concept-keyed content; not personal (course lessons are keyed by `profile_signature`, a hash of the profile bands) | Approved learners read | Not personal |

RLS summary: every per-learner table has `auth.uid() = user_id` own-all policies (`006`), service-only policies on logs and
caches (`012-017`). Admin reads use the service role through `verifyAdmin()`. One gap: the `profiles` update policy (finding 2).
A second: the `profiles: admin read all` policy queries `profiles` from inside a `profiles` policy (`005:85-92`), which can recurse;
unrelated to privacy, but test it.

### 3.2 Third parties that receive personal data

| Processor | What is sent | Name or free text? | Location / DPA status |
|-----------|--------------|--------------------|-----------------------|
| Supabase | Everything in 3.1: auth, DB, storage | Name, email, answers | Region **not discoverable from the repo**; project ref `thivgkbxgfchhystlyvh` (CLAUDE.md). Check the dashboard. DPA: Supabase publishes an online DPA **[unconfirmed, not fetched]** |
| Vercel | All traffic, server logs with IPs, function execution | Everything in transit | Functions region not set in `vercel.json`, default applies **[unconfirmed: US East]**. Vercel offers a DPA with SCCs **[unconfirmed]** |
| Anthropic (API) | Lesson-generation inputs (concept, profile bands, RAG text), free-mode topic and history (`teach/route.ts:154-175`), quiz and challenge answers verbatim, curriculum prompts | Free text from the child yes; name no | US. Commercial terms incorporate a DPA and SCCs **[unconfirmed from a primary source]**; training on API data is off by default; retention window **sources conflict (7 vs 30 days)**: read platform.claude.com "API and data retention" |
| OpenAI | `text-embedding-3-small` input: concept name and lesson query only (`retrieve.ts:49`); the unused Whisper and TTS routes would send audio and text | No (embeddings); yes if the dead routes are used | US. API: abuse-monitoring logs up to 30 days, no training by default, ZDR needs approval (developers.openai.com "Your data"). OpenAI's under-18 guidance says not to process personal data of children under 13 (or the age of digital consent) without ZDR; keep OpenAI free of child data |
| fal.ai | FLUX/Tripo prompts written by the LLM from the lesson or the child's free topic (`generate-model/route.ts:47`, `segment-visuals`) | No name; the child's topic wording can leak through | US. Privacy policy (fal.ai/privacy, updated 2026-07-22) says US servers, SCCs "or a legal derogation", retention not stated in the policy, training use not stated; a DPA link exists in its Legal menu **[unconfirmed]**. Its terms bar under-18 users of fal itself |
| ElevenLabs | Narration text for TTS (`api/tts/route.ts`) | Lesson text; no name. Free-mode text can echo the child's topic | US. EEA terms updated 2024-07-23 **[unconfirmed current]**; DPA governs personal data in inputs (s.2); training opt-out in s.4(i); no zero-retention mention found |
| Resend | Admin notice with the new user's name and email; approval email to the user (`resend.ts`) | Name, email | US; DPA **[unconfirmed]**. Sender is the sandbox domain `onboarding@resend.dev` (`resend.ts:45`): set up a verified domain before launch |
| Google | In Chrome, Web Speech audio goes to Google's recognition service. Browser-side, not our API call | Child's voice | Not our processor; disclose. `@google/generative-ai` is in `package.json` but unused: remove |
| Avaturn | Selfie-based avatar creation in an iframe (`CreateTeacherClient.tsx:29-32`); free tier returns a base64 GLB | Face images, processed by Avaturn | Its terms page 404'd per `LICENSES.md:77`; treat as unreviewed |
| Browser third parties | None found: no analytics SDK in `package.json`; fonts are build-time self-hosted; the only `https://` runtime hosts are the AI APIs, `*.avaturn.dev`, and `models.avaturn.me` (dev harness page only). Generated asset URLs are Supabase Storage public URLs (`banana.ts:319`) | none | Supabase |

### 3.3 Cookies, localStorage, sessionStorage

| Item | Set by | Purpose | Category |
|------|--------|---------|----------|
| Supabase auth cookies (`sb-...-auth-token`, HttpOnly in `pages/learn.tsx`) | `@supabase/ssr` in `middleware.ts`, `lib/supabase/server.ts` | Login session | Strictly necessary |
| `localStorage aristo-theme` (`theme.ts:12`) | `ThemeToggle.tsx` | Theme chosen by the user | User-requested preference; functional |
| `sessionStorage aristo-session` (`useAristoStore.ts:529-545`): userId, onboardingDone, teacher, classroom, mode, course, currentConceptId, customTeacherGlbUrl | Zustand persist | Restore session | Functional; contains a user id and the avatar URL |
| `sessionStorage` landing teacher and intro-played keys (`teacher.ts`, `gate.ts`) | Landing | Remember Jake/MJ and the intro | Functional |
| `localStorage` in `DeskQuizPreview.tsx:57` | Dev page only | n/a | Not shipped to learners |

None is used for tracking, so no consent banner is needed. TKG 2021 s.165(3) requires prior consent for storing or reading
terminal-equipment information except where technically necessary or requested by the user (DSB cookie FAQ; gesetzefinden.at TKG 2021
para 165). Disclose all of the above in the privacy policy. Re-evaluate before adding any analytics.

### 3.4 What exists today, by topic

| Topic | State |
|-------|-------|
| Privacy policy, terms, imprint | None. Footer says so. Only a contact email (a personal address) |
| Cookie notice | None needed today (3.3); nothing to disclose it either |
| Consent at sign-up | None: no checkbox, no policy version stored |
| Age capture | None. The grade band is implied by the product, not collected |
| Parental consent | None. The sign-up flow is a plain individual account; the admin approval gate (`015`) is an access gate, not consent |
| Account deletion | Admin-only (`admin/users/[id]/route.ts:195-232`); cascades through the FKs of `006`; leaves the audit-log name and usage-event topic |
| Data export | None |
| Email verification | Implied by the redirect text (`actions.ts:38`); the Supabase setting is not in the repo |
| Unsubscribe | Only two transactional emails exist (admin notice, approval notice); no marketing or digest emails yet |
| Moderation of LLM output | The admin page `/admin/moderation` manages `cached_lessons` rows only (`api/admin/moderation/queue/route.ts`). `decideModeration()` (`moderation-rules.ts:20-66`) auto-approves new concepts and queues a lesson only if 50% or more of 10 or more recent attempts raised a misconception; it fails open. It is a quality control on shared course lessons, not a safety filter. Free mode (`/api/teach`) and challenge/short-answer evaluation have only a prompt line "Age-appropriate for grades 6-8" (`teach/route.ts:112`); no input check, no output check, no report button |
| Disclosure that the teacher is an AI | Landing ("Your own AI teacher"), sign-up ("Your personal AI teacher"), parents copy ("generated by AI and can be wrong"). No persistent label in the lesson or chat UI (grep of `components/learn`) |
| Approval gate wording | Landing says "Every account is approved by hand". True today (`015`); will stop being true at open sign-up, so the copy must change with the launch |

### 3.5 Accessibility basics

| Check | Finding |
|-------|---------|
| Captions for speech | The caption band shows the current and next sentence (`LessonPlayer.tsx:268-282`), and a caption inside the panel below `lg`. Good. Whether it can be turned off or is always on: always on when a segment plays |
| Keyboard access to the lesson | Playback controls (pause, resume, previous, skip) are DOM buttons (`LessonPlayer.tsx:171-200`), the quiz on the desk is a DOM layer (`DeskQuiz`), widgets live in an iframe with a keyboard path (`InteractiveStage`). The 3D canvas itself is not keyboard-operable; if everything needed is also in the DOM that is acceptable, but a full tab-through has not been tested **[unverified]** |
| Contrast claim | `brand-system.md:337-338` and "Known AA gaps" (463-475): measured 1812 text nodes, minimum 4.71 light and 5.24 dark, for the landing and the lesson panel, quiz buttons and callouts. Not stated as measured: sign-up/sign-in, pending, create-teacher, admin, the quiz sheet text inside the canvas (`state.md` says sheet text is "a little soft"). Do not publish an unqualified "AA" statement |
| Reduced motion | CSS tokens go to 0 ms under `prefers-reduced-motion` (`brand-system.md:182`); the landing falls to a still "stack" mode. Whether the 3D teacher's idle and gesture animation is reduced in the lesson is not documented **[unverified]** (`Experience.tsx:523` has one media query only) |
| Touch targets | 44 px target rule documented and measured |

---

## 4. Processor table with provider terms on minors

| Provider | Minors, as the terms read | Conditions for Aristo | Source |
|----------|---------------------------|-----------------------|--------|
| Anthropic | Usage Policy defines a minor as under 18 anywhere. Products serving minors "must comply with the additional guidelines". Minors may use API-powered products directly only if the product meets the "Guidelines for Organizations Serving Minors": age verification so only intended users get in, content moderation and filtering, monitoring and reporting, educational resources for minors, compliance with child-safety and privacy laws "stated on the organization's website", disclosure that the user is talking to an AI. Anthropic audits; a high violation rate or ignoring a request can end the account. Consumer chatbots must disclose AI "at a minimum at the beginning of each chat session or in the product interface". Education, grading and admissions are "high-risk" use cases in the policy | Items 10, 11 and the website compliance statement | anthropic.com/legal/aup ("Do Not Compromise Children's Safety", "Products Serving Minors", "AI Disclosure"); support.claude.com/en/articles/9307344 (dated 2026-03-16 per search); support.claude.com/en/articles/15591275 |
| OpenAI | Under-18 API guidance: comply with child-safety and privacy law incl. COPPA; ensure content is age-appropriate; content filters; monitoring and escalation; age assurance where appropriate; and do not process personal data of children under 13 (or the digital-consent age) without ZDR | Keep OpenAI to non-personal embedding text; delete the audio routes | developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance. The usage-policy page returned 403 to the fetch |
| ElevenLabs | Terms s.1(a): under 18 may not use the Services; the Services include the API. Learners hear generated audio but do not use ElevenLabs directly; the terms do not address building a service for minors | Ask ElevenLabs in writing that a child-directed product is permitted (and send text only); opt out of training | elevenlabs.io/terms-of-use-eu (EEA, dated 2024-07-23 per search) **[unconfirmed whether superseded]** |
| fal.ai | ToS and Acceptable Use Policy bar users under 18 of fal itself; the privacy policy says no sale, sharing or targeted ads for consumers known to be under 18 | Same position as ElevenLabs: end users are not fal users, but ask; send no personal data; prompts are LLM-written | fal.ai/legal/terms-of-service, fal.ai/legal/acceptable-use-policy (per search), fal.ai/privacy |
| Supabase, Vercel, Resend | General-purpose infrastructure, no age restriction in the product terms known **[unconfirmed]** | DPAs and region | provider legal pages (not fetched) |
| Google (browser speech) | Not a contract of Aristo's | Disclose; default off for children | n/a |

**EU-US transfers.** The EU-US Data Privacy Framework adequacy decision (10 July 2023) stands. The General Court dismissed Latombe's
challenge on 3 September 2025 (T-553/23); the appeal is pending before the Court of Justice as C-703/25 P, with no ruling found by
16 November 2026 (WilmerHale 2025-12-01; Baker McKenzie; ieu-monitoring 2026-06-28). Rely on DPF only for providers that are
certified (check each on dataprivacyframework.gov **[unconfirmed per provider]**) and keep SCCs as a fallback in the DPA. Record
that a plan is needed if the framework falls.

---

## 5. Part 2: legal analysis

### 5.1 GDPR for this operator

- **Does it apply?** Yes. Art 2(2)(c) (household exemption) covers purely personal activity; a public online service offered to
  strangers is not that. The operator is a natural-person controller (Art 4(7)) established in Austria (Art 3(1)); no company shields
  the operator, so liability is personal. The supervisory authority is the Datenschutzbehörde (dsb.gv.at). Regulation (EU) 2016/679 on EUR-Lex.
- **Lawful bases (Art 6)**:
  - Account, lessons, mastery, SRS, quiz scoring, the behavioural profile that tunes pace and depth: Art 6(1)(b) contract with the parent.
    The profile is the core of the service, not an extra.
  - Security, abuse prevention, rate limits, cost accounting (`usage_events`), the admin audit log: Art 6(1)(f); write the balancing
    test; keep periods short.
  - Voice input, the selfie avatar, any marketing or digest email: Art 6(1)(a) consent from the parent, separate, withdrawable.
  - Invoices later: Art 6(1)(c).
  - No special-category data is intended. A learner might type health details into free text, which is a reason for moderation
    and for the no-personal-data hint. A face scan for an avatar is not Art 9 biometric data unless used for unique identification,
    but treat it carefully **[unconfirmed]**.
- **Art 8 age.** Default 16; member states may go down to 13. Austria 14 (DSG s.4(4), per secondary sources **[confirm in RIS]**),
  UK 13 (DPA 2018 s.9), Belgium, Denmark, Estonia, Finland, Latvia, Malta, Portugal, Sweden 13, Cyprus 14, Czechia and France 15,
  Germany 16, Ireland **[sources conflict]** (gdprlocal.com, sota.io summaries; FRA). Art 8 bites when consent is the basis; with
  contract as the basis capacity rules of civil law apply instead **[unconfirmed for Austria]**. A uniform rule of "under 16 means
  parent-owned" removes the country question.
- **"Reasonable efforts" (Art 8(2)).** Efforts proportionate to risk and available technology; EDPB Guidelines 05/2020 on consent
  and the ICO's age-assurance material are the references **[not fetched]**. For a small operator this means: the parent
  signs up with a verified email, confirms they hold parental responsibility, and the account cannot create a child profile without
  that confirmation; a higher-assurance method (card transaction) when payment starts. Do not collect ID documents.
- **DPIA (Art 35).** Needed: children are vulnerable data subjects, systematic evaluation and profiling of learning behaviour, and
  innovative technology (LLMs). Two or more of the WP248 criteria normally mean a DPIA; the DSB also keeps a list **[not fetched]**.
  One short, honest document is enough at this scale.
- **Art 22.** Not triggered: the profile only selects explanation depth and pace and review timing; no legal or similarly
  significant effect and no refusal of access. Keep it that way: no gating of access, no certificates or ranking from the
  profile. Art 13(2)(f) still wants a plain description of the logic ("we adjust pace and depth from your quiz results and
  clicks"); Recital 71 says such decisions should not concern a child. Offer a parent switch to turn personalisation off.
- **Records of processing (Art 30).** Required; the Art 30(5) small-organisation relief fails because processing is not
  occasional and involves children. Table 3.1 and 3.2 are the draft.
- **Representative.** An EU-established controller needs none for the EU. For the UK, Art 27 UK GDPR representative question: open
  question 5.
- **Other duties.** Art 13 transparency in child-readable language (Art 12(1)); Art 25 privacy by default; Art 32 security
  (finding 2 above); Art 33 breach within 72 h.

### 5.2 US COPPA (16 CFR Part 312, amended)

- **Applies?** Yes if the service is directed to US children or it knowingly collects from them. FTC COPPA FAQ B.7: "Foreign-based
  websites and online services must comply with COPPA if they are directed to children in the United States." Grades 6 to 8
  reaches under-13s, and a 3D animated teacher character is a "directed to children" factor; treat as child-directed or mixed
  audience (FAQ D.4: mixed audiences may age-screen neutrally but may not block children).
- **Amended Rule.** Published 22 April 2025 (Federal Register), effective 23 June 2025, compliance date **22 April 2026**
  (already passed) except specific safe-harbour provisions (Federal Register 2025-05904; Davis Polk, Hunton). New or sharpened
  duties relevant here: a written data retention policy (312.10), a written information security program with a named
  coordinator (312.8), separate parental consent for disclosure of children's data to third parties where the disclosure is not
  integral to the service, an expanded notice. FTC policy statement of 25 February 2026 eases age-verification data collection
  (Davis Polk summary); not relevant to this design.
- **Does the parent-owned account solve it?** No, but it is the right structure. Info the parent types about the child is not
  "collected from a child" (FAQ F.4), but the child then supplies answers, free text, possibly voice and persistent identifiers
  (cookies, IP) which are personal information (FAQ A.3, C.5). Still owed: the direct notice to the parent (312.4(c)), VPC before
  collecting from the child (312.5), parental access, deletion and the right to stop further collection (312.6), and no conditioning
  participation on more data than necessary (312.7). Parent enters first name and grade: fine, minimal.
- **Parental consent methods.** FAQ I.3-I.4: "email plus" only where the data is used internally and not disclosed; signed form,
  toll-free call, card transaction, knowledge-based challenge, government ID with face match. Because data is disclosed to AI
  processors, treat email-plus as insufficient **[the FTC treatment of service providers is unconfirmed]** and use the card route
  when payment arrives; before payment see 9.3.
- **Voice.** A child's voice recording is personal information (FAQ A.3). The FTC will not enforce consent where audio is used
  "solely as a replacement for written words" with prompt deletion and notice (FAQ F.6). The Web Speech path never gives the operator the
  audio, so the operator is not the collector of the file, but Google is receiving it from the page for the child; disclose and default
  it off. If a server-side STT is added later, F.6 applies only if you delete immediately and use it for nothing else.

### 5.3 UK Age Appropriate Design Code (ICO)

The Code applies to online services likely to be accessed by under-18s, including a UK-served product. Standards (15) that matter
for defaults, from the ICO code **[ico.org.uk page returned 403; list from memory of the Code, check wording]**: best interests of
the child; DPIA; age-appropriate application; transparency in child-readable form; detrimental use (no use of data against the
child's wellbeing); policies and community standards (the service must follow its own stated rules); **default settings high privacy**;
data minimisation; data sharing; geolocation off by default (none is collected); parental controls with a visible signal to the
child; **profiling off by default unless there is a compelling reason**, with safeguards (the adaptive profile is the service,
so document the compelling reason, keep it rule-based, and let the parent turn it off); nudge techniques (no streak-guilt or
dark patterns in the V5 motivation loop; the plan files mention one); connected toys (n/a); online tools (easy report and delete).
Age 13 is the UK consent age. The Data (Use and Access) Act 2025 adds a children's higher-protection duty **[unconfirmed]**. Whether
free-mode chat is in scope of the Online Safety Act is **[unconfirmed]**.

### 5.4 EU AI Act (Regulation (EU) 2024/1689)

- **Art 50(1)**: providers must ensure AI systems meant to interact directly with people tell them it is an AI, unless obvious from
  the context to a reasonably well-informed person. It applies from 2 August 2026. The "digital omnibus" provisional agreement (political
  agreement 6-7 May 2026, Council confirmed 13 May) leaves 50(1) unchanged and gives a grace period to 2 December 2026 only for 50(2)
  marking of systems already on the market (Gibson Dunn, Hogan Lovells, Simmons & Simmons). Formal adoption and OJ publication were
  "expected" and were not confirmed. For children never rely on the obviousness exception: label it (item 11).
- **Annex III point 3 (education).** The four heads: (a) deciding access or admission or placement in educational institutions,
  (b) evaluating learning outcomes, including when they steer the learning process (c) assessing the appropriate level of education
  a person will receive or access, (d) monitoring prohibited behaviour during tests. Item (b) reads like what BKT mastery scoring
  and "what to teach next" do. The qualifier in the annex text, "of natural persons in educational and vocational training institutions at all
  levels" (reading of the Regulation; verify the wording on EUR-Lex), ties the scope to institutional use. A consumer self-study product
  bought by parents, used outside any school, with scores that no institution sees or uses, is outside the heads. Conclusion for the
  owner: classify as not high-risk on that basis, record the reasoning (an Art 6(3)/(4)-style note), and state in the Terms
  that it is not for formal assessment or placement. Triggers to revisit: any school or teacher dashboard, any export of mastery
  to a school, any "level" certification, any admission test. High-risk dates move to 2 December 2027 under the omnibus
  **[provisional; adoption unconfirmed]**.
- **Art 5(1)(f)** bans inferring emotions of people in education settings from biometric data (in force since 2 February 2025).
  The app uses no camera, no microphone analysis (Web Speech yields a transcript only), no face or gaze reading of the learner, and
  the profile is rule-based from clicks, time and quiz results; the profiler has no emotion or "engagement" inference
  (`profiler.ts`). It does nothing of the kind. Keep it so: no webcam, no voice-affect features. (Jake's own facial animation is
  the avatar, not analysis of the learner.)
- **Art 4 AI literacy** applies since 2 February 2025; a short internal note on how the AI is used and its limits satisfies it for a one-person team.

### 5.5 Austrian and EU consumer specifics

- **Cookies and storage**: TKG 2021 s.165(3), see 3.3.
- **Imprint**: ECG s.5 (service-provider information: name, address, email, trade and chamber details, UID) and MedienG s.25
  (disclosure for websites that go beyond personal presentation: owner's name, residence or seat, the object of the business).
  Neither text could be retrieved with the search tool **[unconfirmed; check RIS]**; WKO's imprint guide lists the fields.
- **Barrierefreiheitsgesetz (BaFG)** in force 28 June 2025 (EU Accessibility Act). It covers e-commerce services to consumers.
  Micro-enterprises (fewer than 10 staff and at most EUR 2m turnover or balance sheet) are exempt for services (WKO FAQ;
  Sozialministerium; the statute is s.6 BaFG **[verify]**). The operator qualifies while it is a micro-enterprise. The Austrian
  Behindertengleichstellungsgesetz discrimination rules remain **[unconfirmed]**. Keep a note recording the exemption status.
- **Consumer law for subscriptions** (2.2 above): FAGG, the Directive 2011/83/EU Art 16(m) digital-content exception, the button
  solution, and the withdrawal function under Directive 2023/2673 applying from 19 June 2026, transposed in Austria via VerbRÄG 2026
  (WKO; Parliament materials; paragraph numbers inconsistent across sources, so verify the final FAGG text).

---

## 6. Recommended account and age model

**Rule.** The parent (or an adult learning for themselves) owns every account. A person under 16 never holds credentials.

1. **Sign-up screen**: "I am a parent or guardian" or "I am 16 or older and learning for myself" (neutral phrasing, no hint
   about being blocked). Email, password, optional name for the parent. Checkbox, unticked: accepts Terms and has read the Privacy
   Policy (link to both). Separate optional checkboxes, unticked: weekly progress email (V6), later.
2. **Email verification** (Supabase "Confirm email" on) before anything else is possible.
3. **Add a learner** (parent area, `/family`): first name or nickname (never full name), grade band (6, 7, 8, other), birth year
   (to decide the under-13 and under-16 branches; store the year only, or just `age_band`: `<13`, `13-15`, `16-17`, `18+`), country
   (for the COPPA and AADC branches; from the parent's declaration, not IP). The parent confirms "I am this child's parent or
   legal guardian" and reads the parent notice. This writes a `consents` row: guardian id, learner id, notice and policy
   versions, purposes accepted, method, UTC timestamp, hashed IP and user agent for evidence only.
4. **VPC step for under-13s** (US-linked, and applied uniformly): before payment exists use email-plus **[weaker; see 9.3]**; the
   first paid period upgrades to the card-transaction method. Until the learner has a valid consent row, the child profile
   cannot start a lesson.
5. **Data model (concrete)**: new `learners (id, guardian_id -> auth.users, display_name, grade_band, age_band, country,
   voice_enabled bool default false, freechat_enabled bool default false, custom_avatar_enabled bool default false,
   personalisation_enabled bool default true, created_at, deleted_at)` and `consents`. Move `learner_profiles`,
   `user_concept_mastery`, `quiz_attempts`, `user_misconceptions`, `session_logs`, `user_course_progress` from `user_id` to
   `learner_id` (migration 006 keys them to `profiles.id`). RLS: `exists (select 1 from learners l where l.id = learner_id and
   l.guardian_id = auth.uid())`. A profile switcher in `/learn` selects the active learner (store field replaces `userId`
   in `useAristoStore`). `profiles` keeps only the parent account.
   Interim alternative if the migration is too large for launch: one auth user per child created by the parent through a
   server action (synthetic address, no password, parent-controlled), keeping the current schema. Cheaper, uglier; it still
   needs the consent table and the parent area.
6. **16 and 17**: self-registered (consent is their own, Art 8 satisfied), but the same safeguards as children for AI moderation,
   voice default off, free chat moderation and the UK AADC defaults.
7. **Under 16, switched off until the parent opts in** (all flags default false):
   - Voice input, with a notice that the browser sends audio to its speech service (Google in Chrome).
   - Free-mode chat: first release course-mode only. When free chat is on, every message passes moderation first; topic length
     cap of 200 characters; nothing the child types is stored in `usage_events`.
   - The custom teacher (selfie via Avaturn).
   - Any email to the child, any leaderboard, any sharing (none exist; keep it so).
   - Personalisation stays on by default **only with** the documented compelling reason; the parent can switch it off, which
     pins the default profile.
8. **Parent controls**: view the data kept for each child (the same as the export), download, delete one child or the whole
   account, change the switches, withdraw consent. The parent-facing page shows the children's mastery summary only, not
   free-text answers.
9. **Learner experience**: first screen "Jake is an AI teacher. He can be wrong. Do not type your full name, address or phone
   number." Same line on the free-chat box.
10. **Approval gate**: while the gate exists it is separate from consent; at open sign-up retire it and the "approved by hand"
    copy, or keep it as an abuse control and reword.

---

## 7. Document outlines

### 7.1 Privacy policy (one policy, with a parents-and-children section and a short child-readable summary)

1. **Who we are**: controller's name and postal address, privacy contact email, Austria; the sole-operator fact; DSB as the supervisory authority; UK and US notes.
2. **What the service is**: AI tutor for grades 6 to 8; lessons are generated by AI models and can be wrong.
3. **Data we collect, by purpose and legal basis**: the table from 3.1 in plain words, each row with the Art 6 basis; what the "behavioural profile" is, the four settings it
   adjusts, that it is rule-based, uses no camera, microphone analysis or location, and has no legal effect.
4. **Children and parents**: the age rule (under 16 parent-owned), what a parent enters, what the child enters, the switches, parental access, correction, deletion and stop (COPPA
   312.6); statement that no behavioural advertising, no sale, no sharing for marketing.
5. **AI processing**: that learner text and answers are sent to Anthropic, that no name is sent, that outputs may be wrong, retention at the provider, no training on this data (cite
   the provider terms), the image and 3D providers receive only lesson-derived prompts.
6. **Voice**: off by default; if on, the browser's recognition service (Google in Chrome) receives audio; we receive text.
7. **Recipients and processors**: the table in section 4 (names, purpose, location, transfer mechanism); link to a live sub-processor page.
8. **International transfers**: US providers; DPF where certified, otherwise SCCs.
9. **Retention**: the schedule below.
10. **Storage on your device**: the table in 3.3, stating no tracking and no banner needed.
11. **Security**: RLS, access limited to the operator, breach handling.
12. **Your rights**: Art 15-22, how to exercise (self-service export and delete, plus email), response time one month, right to complain to dsb.gv.at.
13. **Automated decisions**: none with legal or similar effect; how the profile works; how to turn it off.
14. **Changes** and version history with the dates that `consents` references.

Proposed retention schedule (owner to confirm): active account data until deletion; inactive account (no sign-in for 24 months) deleted after a warning email; `session_logs` 12
months; `quiz_attempts` free-text answer 12 months then blanked; `usage_events` 90 days (no topic text); `admin_audit_log` 12 months with the `diff` name scrubbed on deletion; deleted
accounts removed from backups on expiry of the Supabase backup window **[length unconfirmed]**; invoices 7 years once payments exist.

### 7.2 Terms of use

1. Who offers it (name, address); the parent is the contracting party; minimum 18 for the parent account holder, 16 for self-learners.
2. The service: AI-generated educational content, accuracy disclaimer ("check anything you would cite", `content.ts:146`), not professional or formal educational assessment, not for
   school admission, placement or grading (this supports the AI Act classification).
3. Accounts: one adult per account, children as profiles, parent responsibility, no sharing of credentials.
4. Acceptable use: no personal data about others, no attempts to extract harmful content, no scraping or abuse of the AI; consequences (suspension).
5. Free allowance and its limits (set the numbers when decided); the approval step if retained.
6. Paid terms (add before payment): price, billing period, renewal, cancellation, withdrawal and the digital-content waiver, refunds.
7. Content and licences: lesson content, third-party asset credits (`LICENSES.md`, CC BY 4.0 for the avatars, shown by `AvatarCredit`), the learner's rights in what they type.
8. Liability: as far as Austrian consumer law allows (KSchG limits exclusions; keep to what is enforceable); availability, no warranty of accuracy.
9. Changes to terms, termination by either side, deletion of data on closure.
10. Governing law and venue: Austrian law, consumer's mandatory home-country rights preserved; complaint channels (an out-of-court dispute body notice is required only once consumer contracts exist **[unconfirmed]**).

### 7.3 Imprint (Impressum), under ECG s.5 and MedienG s.25 **[field list unconfirmed against the statute text]**

Full name; a postal address where the operator can be served; email; a second quick contact (phone or form); trade (Gewerbe) description and the competent trade authority; chamber membership
(WKO) if applicable; UID number if one exists; the object of the business (an "AI tutoring app"); supervisory or licence details if any; the MedienG disclosure block
(owner and "basic direction" of the site). A home address here is public: decide on a business address first.

### 7.4 Other short documents

Parent notice (COPPA 312.4(c) content: what is collected, how used, disclosure to processors, how to consent, review and delete; plain and short); sub-processor page; AI transparency
page (what Jake is, models used by category, limits, how to report); DPIA, ROPA, retention schedule, incident runbook, security program, AI classification memo (internal).

---

## 8. Findings outside the compliance brief that affect it

- `/api/whisper`, `/api/openai-tts` unauthenticated: item 1.
- `profiles` self-update risk: item 2.
- `auth/callback` `next` parameter: item 18.
- Sender domain is the Resend sandbox; the admin email to the owner includes a user's name and email: fine, but cover it in the policy.
- `admin` access reads every learner's data with the service role and there is no second factor or access log for reads (the audit log records only mutations,
  `012_audit_log.sql:3`); Art 32 expects more as the user base grows.
- `.claude/` memory says free-tier generation spends money; with open sign-up and a free allowance, per-user spend caps are a cost control and also a data-minimisation one; none is
  enforced for `/api/teach` (only `tts` and `interactive` have throttles).

---

## 9. Open questions for the owner

1. **Trade status.** Register a Gewerbe and operate as a sole trader at launch, or form a company (GmbH or FlexKapG) first? It changes personal liability for GDPR fines, the
   imprint and who contracts with providers. Should a home address be public?
2. **Which age line?** Recommendation: 16 (parent-owned below it). Can 16 and 17 self-register, or should every minor under 18 be parent-owned, which also matches Anthropic's
   definition of a minor?
3. **VPC method before payment.** Email-plus is cheap but weak and arguably unavailable because data goes to processors; a card transaction needs payment infrastructure first.
   Launch with email-plus and a lower free allowance, or delay US under-13 access until a stronger method exists? Alternative: block under-13s in the US at sign-up
   (country declared by the parent), at the cost of a smaller market.
4. **Free chat for children at launch?** Moderation work is L; course-mode-only is S. Which one ships first?
5. **UK.** UK sign-ups at launch (UK GDPR Art 27 representative, AADC defaults, possible ICO registration fee), or EU and US only?
6. **Supabase region and Vercel region.** What region is the Supabase project in? If it is not in the EU, can it be moved before launch (cheaper now than later)?
7. **Approval gate.** Keep it as a launch brake, or retire it? The landing copy depends on the answer.
8. **Provider requests.** Email ElevenLabs and fal.ai to confirm child-directed use, and ask Anthropic for the current retention figure and DPA copy; these could not be confirmed from primary sources.
9. **Selfie teacher.** Drop the custom (Avaturn) teacher entirely for launch? It adds a face-image processor and a parental-consent item for little gain.
10. **Who answers rights requests and incidents?** One person: set a monthly check and a backup contact.
11. **Moderation and safety reporting.** Which hotline and escalation path (Stopline.at for CSAM; a crisis resource for self-harm text)? Anthropic's guidance recommends one and an audit trail.
12. **Reality check on school use.** Will any teacher or school be invited to use it in the first year? That would push the AI Act classification and a school-data-processing role (the
    operator would be a processor, not a controller) into scope.

---

## 10. Sources

Primary: EU 2016/679 (GDPR), 2024/1689 (AI Act) on EUR-Lex; dsb.gv.at DSB cookie FAQ; TKG 2021 s.165 (gesetzefinden.at); FTC COPPA FAQ (ftc.gov); Federal Register 2025-05904 (COPPA
rule, 2025-04-22); Anthropic Usage Policy (anthropic.com/legal/aup) and support.claude.com articles 9307344 and 15591275; OpenAI "Under 18 API guidance" and "Your data"
(developers.openai.com); ElevenLabs EEA terms (elevenlabs.io/terms-of-use-eu); fal.ai privacy policy. Secondary and flagged: Gibson Dunn, Hogan Lovells, Simmons & Simmons on the AI
omnibus; WilmerHale and Baker McKenzie on Latombe; WKO and Sozialministerium on BaFG; WKO and the Austrian Parliament on VerbRÄG 2026; gdprlocal.com and sota.io on Art 8 ages. Not
reachable in this session: ico.org.uk Children's Code page, openai.com usage policies (403), RIS texts for DSG s.4, ECG s.5, MedienG s.25, FAGG; the Supabase MCP (connection closed).
