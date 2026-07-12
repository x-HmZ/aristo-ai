# Aristo AI — Architecture

## Agents (`src/lib/agents/`)

| File | Exports | Model |
|------|---------|-------|
| `teaching.ts` | `generateLesson()` (5-phase), `explainMore()` | Sonnet / Haiku |
| `assessment.ts` | `generateQuestions`, `generateLessonQuiz`, `generateReviewQuestion`, `evaluateShortAnswer`, `evaluateObjective` (local) | Sonnet / Haiku |
| `curriculum.ts` | `generateCourse`, `flattenCourseConceptIds` | Sonnet |
| `profiler.ts` | `updateDynamicProfile` (rule-based, no LLM), `computeBloomAccuracy` | — |
| `models.ts` | `MODELS` constants | — |

All Anthropic calls use `tool_use` with strict input schemas — no regex JSON parsing.

## Subsystems

- **RAG** (`src/lib/rag/`) — `embed.ts` + `retrieve.ts`. `match_reference_chunks()` RPC, top-4 chunks, similarity ≤ 0.3.
- **SRS** (`src/lib/srs/`) — `scheduler.ts` (FSRS), `queue.ts` (`getDailyReviewQueue`, `getOverdueCount`).
- **Mastery** (`src/lib/mastery/`) — BKT update; SRS scheduling; Bloom-level helpers.
- **KG** (`src/lib/kg/`) — graph types and helpers.

## API Routes (`src/app/api/...`)

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

## Components (`src/components/`)

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

## Hooks
- `useSessionFlush.ts` — signals ref pattern; `beforeunload` keepalive flush
- `useCourseAutoTeach.ts` — auto-fetches next lesson when course advances

## Store (`src/store/useAristoStore.ts`)
Key fields: `userId`, `profile` (DynamicProfile), `onboardingDone`, `behavioralSignals`, `mode` (`"course" | "free"`), `course` (CourseState with `structure`), `activeLesson` (LessonPayload), `messages`, `quiz` (legacy MCQ), `activeModelUrl`, `isGeneratingModel`.

## Approval gate (placeholder for the future paywall)

Every signup lands in `approval_status='pending'`. Middleware redirects pending users from `/learn` to `/pending`, and learner API routes call `requireApproved()` ([src/lib/auth/approval.ts](src/lib/auth/approval.ts)) as defence-in-depth. Admins are auto-approved.

- DB columns on `profiles`: `approval_status`, `approved_at`, `approved_by`, `admin_notified_at` (migration `015_user_approval.sql`).
- Email: [src/lib/email/resend.ts](src/lib/email/resend.ts). `notifyAdminOfNewSignup()` is idempotent via `admin_notified_at`; fired from `/auth/callback` and the `/pending` page.
- Admin UI: `/admin/users` has Approve / Reject buttons + a status filter.
- To swap for a real paywall later, replace the body of `requireApproved()` — call sites stay identical.
