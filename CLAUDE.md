# Aristo AI — Project Brief for Claude

## What This Is

Aristo AI is an immersive, knowledge-graph-driven AI tutoring platform. A 3D avatar teacher delivers structured 5-phase lessons to middle-school students, adapting to each learner's behaviorally-inferred profile and tracking mastery per concept with spaced repetition for long-term retention.

> **For Claude:** Auto-memory at `~/.claude/projects/.../memory/` is the primary context — read `MEMORY.md` (the index) first. The authoritative spec is `AI_TEACHER_APP_SPEC.md` at project root; consult `spec_index.md` to read one section surgically rather than the full file. **The spec supersedes this CLAUDE.md on any conflict.**

---

## Vision (do not redirect from this)

- **Immersive 3D experience.** A teacher avatar (Ryan / Sonia) lives in a real-time R3F scene. When teaching physical/tangible topics, generate a 3D model (FLUX → Tripo3D) into the scene alongside the avatar.
- **Real teaching, not summarization.** Every lesson follows a strict 5-phase protocol: Activate → Explain → Demonstrate → Challenge → Connect.
- **Adaptive to each learner.** No fixed learning-style buckets (FSLSM was rejected). Instead a `DynamicProfile` (expertise / depth / pace / example preference) is inferred from behavioral signals and updated every session.
- **Mastery-based, not time-based.** BKT (Bayesian Knowledge Tracing) per concept. FSRS spaced repetition. The KG decides what to teach next, not a linear playlist.
- **Target user:** middle-school students (grades 6–8).
- **Visual direction:** pastel orange (#F97B2F) + cream/beige, soft glassmorphism, modern, friendly, immersive. Not childish, not corporate.

---

## Tech Stack (finalized)

| Area | Choice |
|------|--------|
| Framework | Next.js 15, TypeScript, App Router (with one Pages Router exception — see below) |
| Auth + DB | Supabase (project ref: `thivgkbxgfchhystlyvh`) — pgvector enabled |
| 3D Rendering | React Three Fiber v8 + Drei v9 + Three.js |
| State | Zustand (`src/store/useAristoStore.ts`) — persisted to sessionStorage |
| UI | shadcn/ui + Tailwind CSS |
| Teaching / Assessment | Anthropic — Sonnet 4.6 (lessons, quiz gen) + Haiku 4.5 (explain-more, review questions, short-answer eval, free-mode chat) |
| RAG embeddings | OpenAI `text-embedding-3-small` (1536 dim, gracefully optional) |
| TTS / STT | Browser Web Speech API (Whisper / OpenAI TTS routes exist as a planned upgrade path — leave them in place) |
| 3D Generation | fal.ai: FLUX Schnell (text→image) → Tripo3D v2.5 (image→GLB) |
| Deployment | Vercel (env vars set in dashboard) |

### Model IDs are centralized

`src/lib/agents/models.ts` exports `MODELS.teaching | assessment | fast`. **Never hardcode model strings elsewhere.**

---

## CRITICAL: Pages Router constraint for `/learn`

Next.js 15 App Router's `(app-pages-browser)` webpack layer aliases `react` to `next/dist/compiled/react` (React 19), which strips internals that `react-reconciler@0.27.0` (R3F's dep) reads at module init — fatal crash.

**Rules — do not violate:**
- `pages/learn.tsx` — Pages Router page with `getServerSideProps` for Supabase auth
- `src/components/learn/LearnClient.tsx` — `"use client"`, statically imports `AristoCanvas`
- `pages/learn.tsx` uses `next/dynamic({ ssr: false })` to load `LearnClient` (the SSR boundary)
- Do **not** move `/learn` into `src/app/learn/` — breaks R3F
- Do **not** add a webpack alias redirecting `react` to real `node_modules/react` — breaks `React.use` in App Router pages

Everything else lives in App Router.

---

## Architecture

### Agents (`src/lib/agents/`)

| File | Exports | Model |
|------|---------|-------|
| `teaching.ts` | `generateLesson()` (5-phase), `explainMore()` | Sonnet / Haiku |
| `assessment.ts` | `generateQuestions`, `generateLessonQuiz`, `generateReviewQuestion`, `evaluateShortAnswer`, `evaluateObjective` (local) | Sonnet / Haiku |
| `curriculum.ts` | `generateCourse`, `flattenCourseConceptIds` | Sonnet |
| `profiler.ts` | `updateDynamicProfile` (rule-based, no LLM), `computeBloomAccuracy` | — |
| `models.ts` | `MODELS` constants | — |

All Anthropic calls use `tool_use` with strict input schemas — no regex JSON parsing.

### Subsystems

- **RAG** (`src/lib/rag/`) — `embed.ts` + `retrieve.ts`. `match_reference_chunks()` RPC, top-4 chunks, similarity ≤ 0.3.
- **SRS** (`src/lib/srs/`) — `scheduler.ts` (FSRS), `queue.ts` (`getDailyReviewQueue`, `getOverdueCount`).
- **Mastery** (`src/lib/mastery/`) — BKT update; SRS scheduling; Bloom-level helpers.
- **KG** (`src/lib/kg/`) — graph types and helpers.

### API Routes (`src/app/api/...`)

**Learning:**
- `GET  /api/learn/lesson/[conceptId]` — full 5-phase lesson (parallel: profile + concept + prereq join + RAG)
- `POST /api/learn/explain-more` — Haiku phase expansion
- `POST /api/learn/challenge` — Haiku challenge eval
- `POST /api/learn/complete` — mark lesson viewed
- `GET  /api/learn/next` — next concept with 70/30 SRS blend (50/50 when ≥10 overdue)
- `GET  /api/learn/overdue-count` — cheap SRS count for the header chip poller

**Quiz:**
- `GET  /api/quiz/lesson/[conceptId]` — 4 mixed questions (Sonnet)
- `GET  /api/quiz/review` — Haiku review questions for SRS-due concepts
- `POST /api/quiz/submit` — eval + BKT update + SRS update + `quiz_attempts` row; `context: "lesson" | "review"`
- `POST /api/quiz/complete` — update `user_course_progress.last_activity`

**Profile / Analytics:**
- `GET  /api/profile` — static + dynamic profile
- `GET  /api/profile/mastery` — per-concept mastery (`?domain` filter)
- `POST /api/profile/session` — flush behavioral signals → run profiler → upsert `learner_profiles`
- `GET  /api/profile/analytics` — student dashboard data (streak, time, mastery counts, weak concepts)

**Courses:**
- `GET  /api/courses` — list published
- `GET  /api/courses/[id]` — course + masteryMap + conceptMeta
- `POST /api/courses/generate` — CurriculumAgent → save course

**Knowledge Graph:**
- `GET  /api/kg/[domain]`, `POST /api/kg/concepts`, `POST /api/kg/generate/[domain]`, `POST /api/kg/validate/[domain]`
- `POST /api/kg/ingest` — admin-only RAG ingest (chunk + embed + insert)

**Other:**
- `POST /api/teach` — free-mode chat companion (single Haiku call, profile-shaped tool_use)
- `POST /api/generate-model` — fal.ai pipeline (FLUX → Tripo3D)
- `GET  /api/auth/callback` — Supabase OAuth callback
- `POST /api/auth/onboarding` — onboarding completion
- Admin: `GET /api/admin/analytics`, `GET/POST/PATCH/DELETE /api/admin/courses`

All Anthropic / fal.ai endpoints require auth.

### Components (`src/components/`)

**Learn:**
- `LearnClient.tsx` — main shell; mode routing; overdue chip; Progress + Map + Sign Out in nav
- `LessonView.tsx` — 5-phase cards (ActivateCard → ConnectCard); ExplainMore; signal tracking
- `CourseMapView.tsx` — visual KG map, mastery-coloured nodes
- `CourseFlow.tsx` — `CourseLoadingBar`, `CourseTakeQuizBar`, `CourseAdvanceBar`
- `ModePicker.tsx` — free explore vs course picker + generate
- `MessagePanel.tsx` — chat history (free mode) / dispatches to LessonView (course mode)
- `InputBox.tsx` — text + mic input; Web Speech TTS
- `TeacherControls.tsx` — avatar switcher, controls
- `DashboardView.tsx` — Progress overlay (streak, time, mastery, weak concepts, profile badges)
- `ReviewView.tsx` — daily SRS review session overlay

**Quiz:**
- `QuizView.tsx` — 8 question type renderers, per-question feedback, signal tracking; `context: "lesson" | "review"` prop

**Onboarding:**
- `OnboardingView.tsx` — 3-question first-login onboarding

**Three (3D scene):**
- `AristoCanvas.tsx` — R3F Canvas + OrbitControls + lighting
- `Experience.tsx` — scene composition
- `Teacher.tsx` — Ryan / Sonia GLB
- `GeneratedModel.tsx` — loads generated GLB, float animation, annotation highlights

### Hooks
- `useSessionFlush.ts` — signals ref pattern; `beforeunload` keepalive flush
- `useCourseAutoTeach.ts` — auto-fetches next lesson when course advances

### Store (`src/store/useAristoStore.ts`)
Key fields: `userId`, `profile` (DynamicProfile), `onboardingDone`, `behavioralSignals`, `mode` (`"course" | "free"`), `course` (CourseState with `structure`), `activeLesson` (LessonPayload), `messages`, `quiz` (legacy MCQ), `activeModelUrl`, `isGeneratingModel`.

---

## Approval gate (placeholder for the future paywall)

Every signup lands in `approval_status='pending'`. Middleware redirects
pending users from `/learn` to `/pending`, and learner API routes call
`requireApproved()` ([src/lib/auth/approval.ts](src/lib/auth/approval.ts))
as defence-in-depth. Admins are auto-approved.

- DB columns on `profiles`: `approval_status`, `approved_at`, `approved_by`, `admin_notified_at` (migration `015_user_approval.sql`).
- Email: [src/lib/email/resend.ts](src/lib/email/resend.ts). `notifyAdminOfNewSignup()` is idempotent via `admin_notified_at`; fired from `/auth/callback` and the `/pending` page.
- Admin UI: `/admin/users` has Approve / Reject buttons + a status filter.
- To swap for a real paywall later, replace the body of `requireApproved()` — call sites stay identical.

---

## Migration State

All run; no pending. `001_initial_schema` → `015_user_approval` (no `007` — quiz_attempts went into `006_mastery`).
- `005_reset_and_graph.sql` — drops FSLSM tables, builds `concepts` / `concept_prerequisites`
- `006_mastery.sql` — `learner_profiles`, `user_concept_mastery` (+ SRS), `user_course_progress`, `user_misconceptions`, `session_logs`, `quiz_attempts`
- `008_courses.sql` — `courses` + `course_id` FK
- `009_quiz_constraints.sql` — `UNIQUE(user_id, concept_id, misconception)`, `increment_misconception()` RPC
- `010_rag.sql` — vector extension, `reference_chunks` + HNSW index, `match_reference_chunks()` RPC
- `015_user_approval.sql` — `profiles.approval_status` + companion columns for the admin approval gate

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY     # Teaching / Assessment / Curriculum / Profiler
OPENAI_API_KEY        # RAG embeddings + planned Whisper / TTS upgrade — gracefully optional
FAL_KEY               # fal.ai 3D generation (NOT FAL_API_KEY)
```

---

## Phase Status — all 9 phases complete

| Phase | Name | Status |
|-------|------|--------|
| 1 | Knowledge Graph Foundation | ✅ |
| 2 | Learner Profile + Mastery | ✅ |
| 3 | Teaching Agent 5-Phase Protocol | ✅ |
| 4 | Quiz Generation + Answer Evaluation | ✅ |
| 5 | Course Builder + Progression | ✅ |
| 6 | Spaced Repetition Engine (FSRS) | ✅ |
| 7 | Behavioral Profiling | ✅ |
| 8 | RAG Pipeline (pgvector + OpenAI embeds) | ✅ |
| 9 | Student Dashboard + Admin Cleanup | ✅ |

---

## What's Next (post-Phase-9 polish)

- **Vercel deploy** — env vars in Vercel dashboard, verify `maxDuration = 60` on lesson route if Sonnet stalls
- **RAG seeding** — admin-only `POST /api/kg/ingest` per domain (needs `OPENAI_API_KEY`)
- **End-to-end 3D test** — fal.ai pipeline works with `FAL_KEY`; verify model appears in scene
- **Phase 10 (planned)** — real-time voice (ElevenLabs / Whisper to replace Web Speech), shared sessions via Supabase Realtime
- **Lesson streaming** — would replace the synchronous `generateLesson()` JSON return with progressive 5-phase render; requires LessonView + lesson route restructure (deferred)

---

## Key Decisions Log

| Decision | Choice | Why |
|----------|--------|-----|
| `/learn` in Pages Router | Permanent | R3F + App Router crashes on react-reconciler internals |
| FSLSM learning styles | **Removed** | Debunked; replaced by behaviorally-inferred DynamicProfile |
| Teaching model | Sonnet 4.6 | Quality on structured 5-phase output |
| Fast paths | Haiku 4.5 | explain-more, review questions, short-answer eval, free-mode |
| LLM JSON | tool_use everywhere | Guaranteed valid JSON; no regex parsing |
| TTS / STT | Web Speech (now), Whisper / TTS routes kept (planned upgrade) | Free for prototype; routes already wired for the swap |
| 3D gen | fal.ai FLUX → Tripo3D | One SDK, one key, ~30–40s end-to-end |
| Quiz UI | dedicated `QuizView`, 8 types | Replaces legacy `quiz` slice in store |

---

## Repo & Tooling

- Git: `master` branch (currently on `build-v2`), user: x-HmZ
- Working dir: `C:\Users\Pc\Desktop\Empire\Artisto\Aristo 2.0\Aristo-AI`
- Skills: `nextjs-turbopack`, `frontend-design`, `claude-api`, `fal-ai-media`, `security-review`, `design-system`, `postgres-patterns`, `database-migrations`
- MCP: `context7`, `vercel`, `magic`, `sequential-thinking` (`.mcp.json`); `supabase`, `github` (`~/.claude.json`)
