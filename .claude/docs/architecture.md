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
- `Teacher.tsx` — teacher avatar (`AVATAR_ASSETS`; roster Jake / MJ). Each Canino teacher is
  `Teacher_<T>.glb` (mesh + base clips Idle/Talking/Thinking) plus `Teacher_<T>_clips.glb`
  (`clipPacks`: animation-only, meshopt, fetched after `sceneReady`, registered on the same
  mixer). Built by `.claude/eval/2026-09-18-v9-bakeoff/scripts/v9_ship.sh` (V9.2)
- `GeneratedModel.tsx` — loads generated GLB, float animation, annotation highlights

## Teacher avatar subsystem (V9)

Roster: **Jake (the default, `DEFAULT_TEACHER`) and MJ** (`ACTIVE_TEACHERS`, the picker order). Ryan, Sonia, Marcus
and Priya are archived: configured in `AVATAR_ASSETS`, not offered, not tested. `custom` (Avaturn, from
`/create-teacher`) is offered to a learner who has made one. Pure logic lives in `src/lib/avatar/` (three.js-free,
unit-tested); `Teacher.tsx` only renders what it says.

**Config and loading** (`AVATAR_ASSETS` in `Teacher.tsx`): per avatar a scene GLB, an `animFile`, optional `clipPacks`, a
clip set, `standScale` (world height, read by `Experience.tsx`), `morphs` (`visemes`, `eyeClose`, `smileGain`), `credit`.
- Jake and MJ: `Teacher_<T>.glb` = mesh + base clips (Idle, Talking, Thinking, the `MOUNT_CLIP`); `Teacher_<T>_clips.glb` =
  14 animation-only clips (meshopt), mounted by `<ClipPack>` only once `sceneReady`, on the same mixer. A failed pack
  (`ClipPackBoundary`) leaves the base clips playing.
- Eager download is only the default's scene (`preloadDefaultAvatar()`, called by `LearnClient`; `/demo` preloads its own
  `DEMO_TEACHER`; the picker warms a teacher's scene on hover). Packs are never preloaded.
- Fallbacks to the default: a persisted choice that is not offered (store `merge`), `custom` with no GLB URL, an unknown
  key, and a teacher whose GLB fails (`SafeTeacher` swaps in Jake; keyed by avatar so the boundary resets).

**Director** (`director.ts`, `animationManifest.ts`): one pure step per frame from store signals (`gesture`, `isSpeaking`,
`isLoading`, lesson phase, quiz state, `lessonComplete`, `sceneReady`) to four outputs: a looping **base** clip
(crossfaded, no back-to-back repeats, cooldowns), one masked **overlay** (greeting, long wait, nod, shake, quiz reactions),
a **look** target, a **face** hint. The manifest holds every clip's scenarios, layer, cooldown and mask, and the clip
sets per rig (`CANINO`, `AVATURN`, `CUSTOM`, `LEGACY`); adding a clip is a data change.
- **Masks** (`skeletonMasks.ts`): `upper` and `head` track sets found from the skeleton (walk from the hips; names may carry
  a `_<digits>` suffix, as MJ's do). An overlay is a masked copy of the clip on the same mixer, weighted by dominance.
- **Reactions** (nod, shake) are latched from store `gesture` changes and released back to `idle` by the director.

**Look and face** (all applied in `useFrame` after the mixer): `look.ts` turns the head part-way toward camera, board,
model or desk; `gaze.ts` turns both eye bones after it (saccades, drift, averted "thinking"); `face.ts` sets the smile
level (`smileGain` per rig, 0.4 for an untuned rig) and runs the blink scheduler; visemes come from `useTTS`
(alignment timeline, FFT fallback). The Canino rigs have only 14 visemes, `mouthSmile` and two blink shapes, so
expressions are smile levels plus eyes. Rigs without `CC_Base_[LR]_Eye` bones (legacy, custom) get no eye layer.

**Custom teachers** keep `CUSTOM_CLIP_SET`, `smileGain` 0.4 and the flat `LEGACY_STAND_SCALE` (1.5).
**Credit:** `AvatarCredit` renders `AVATAR_ASSETS[*].credit` for both teachers on `/learn` and `/demo`; `LICENSES.md` lists
every shipped asset.
**Tests:** `director`, `manifest` (integrity and the coverage table), `skeletonMasks`, `look`, `face` (with `gaze`).

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
