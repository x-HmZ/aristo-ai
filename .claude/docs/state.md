# Aristo AI — Current State & Next Steps

_Update this at the end of every significant session: done / next / blockers, compact._

## 2026-09-08 (later) — V7 alignment lipsync, demo path built

Same branch `dev/v2-instant-demo`, still uncommitted.

- **New `src/lib/lipsync/visemes.ts`** turns ElevenLabs character timings into a merged
  viseme timeline. 26 unit assertions in `visemes.test.ts`, including a 60fps playback
  simulation (mouth active >70% of a clip, 3-25 shape changes/sec, never frozen >0.6s) —
  the failure modes that only show up in motion.
- **`prerender-demo-tts.mjs --align`** sends existing mp3s to `/v1/forced-alignment` and
  writes `<seg>.align.json` beside each. Resumable; treats an alignment as stale when the
  mp3's byte count stops matching the `audioBytes` recorded in it.
- **`useTTS` prefers timings over the FFT.** `getCurrentViseme()` reads the timeline when
  one is loaded, else falls through to wawa-lipsync unchanged. The sidecar fetch is
  fire-and-forget (playback never waits) and generation-guarded (a late sidecar cannot
  attach to a later segment). Teacher.tsx needed no changes — it already consumed
  `getCurrentViseme()`, which is why that was the seam to pick.
- **BLOCKED on one command.** `api.elevenlabs.io` is denied by this session's egress policy
  and the desktop VM has no outbound DNS, so no alignment file exists yet. Run
  `node scripts/prerender-demo-tts.mjs --align` from a normal shell: 30 segments, ~7.4 min
  of audio, **0 TTS characters** (Forced Alignment bills as speech-to-text).
- **Not verified in motion.** The demo playthrough could not be re-run: the dev server
  stopped serving the `DemoClient` dynamic chunk after repeated recompiles (only 8
  resources loaded, no canvas ever mounted, GLBs themselves fine at 200). Restart
  `next dev`. What was verified live: the sidecar 404s and the mp3 still serves 200 — the
  intended degrade path.
- Safety net worth keeping: `parseAlignment` rejects payloads whose `generator` is not an
  ElevenLabs run, so a hand-made placeholder degrades to the FFT rather than driving the
  mouth from invented timings.
- **`/learn` now gets alignment too** (same day, after the demo-only version was rightly
  called out as pointless on its own). `/api/tts` calls `/with-timestamps`, which returns
  character timings with the audio **at the same character cost and with no extra key
  scope** — unlike Forced Alignment, which needs `forced_alignment` enabled on the key and
  is what the demo's `--align` pass hit a 401 on. Response is JSON (base64 audio +
  alignment); `useTTS` sniffs the content type, so the plain-audio fallback still works.
  `parseAlignment` now normalises both ElevenLabs shapes — the parallel arrays
  `with-timestamps` returns and the array-of-objects Forced Alignment returns.
- Three independent ways this degrades rather than breaks, because none of it could be run
  against the live API from here: upstream failure falls back to the plain endpoint;
  a missing or malformed alignment leaves lipsync on the FFT; `TTS_TIMESTAMPS=off` disables
  the timestamped call without a code deploy.

### Shared-audio race found and fixed while debugging the above

Reported symptoms on `/learn`: audio lagging, narration not playing the whole segment, and
the avatar never returning to idle. All three were **one pre-existing bug**, not the
alignment work. Instrumenting the audio element during a live free-topic answer showed
three `/api/tts` calls starting within 13ms of each other and three different blobs loading
within 60ms, each `abort`+`emptied`-ing the previous.

Cause: one `<audio>` singleton, four independent narrators — `FreeTopicCard.tsx:122`,
`InputBox.tsx:91`, `LessonView.tsx:256/263/281/614/645`, `useLessonPlayback.ts:470` — and
nothing arbitrating between them. Overlapping `speak()` calls both completed their fetches
and both set `audio.src`. `speak()`'s internal `stop()` never set the previous call's
`cancelled` flag (only `controller.stop()` did), so a superseded fetch happily clobbered
whatever was playing.

Why it produced each symptom: the loser's audio was killed ~50ms in (**"didn't run the
whole part"**); three full-price generations ran concurrently and slowed each other from
~1.3s to ~4.2s (**"lagging"**); and `abort`/`emptied` do **not** fire `ended`, so the losing
caller's `onEnd` never ran and any component waiting on it — the lesson engine — hung
forever with `gesture` stuck (**"not coming back to idle"**). That last one is the direct
answer to "does the audio have an ending mark": it does, but only the winner ever gets it.

Fix in `useTTS`: speech is explicitly owned (`_speechSeq` / `_activeSpeech`). Only the
holder may touch the element, and a superseded caller gets its `onEnd` so it is released
rather than left waiting. Verified live — abort count went 3 -> 0 and a 34.6s clip played
through cleanly.

**Fixed (2026-09-08).** Corrected diagnosis after reading the call sites: it was not three
components narrating different slices. In FREE mode two components narrated *the same
answer*:

- `InputBox.tsx:91` speaks `data.definition + data.explanation` imperatively the moment
  `/api/teach` returns.
- `FreeTopicCard.tsx:122` speaks `parsed.definition + parsed.explanation` from a mount
  effect when it is the latest card — the same content, re-parsed out of the markdown
  summary InputBox built, which is why the two clips were near-identical but not equal
  (32.93s vs 32.04s).

The third call is `reactStrictMode: true` (next.config) double-invoking FreeTopicCard's
effect in dev. So production duplicates 2x, dev 3x.

`LessonView` and `useLessonPlayback` are course-mode narrators and are mutually exclusive
with free mode (`MessagePanel.tsx:64-67` returns early), so they never overlap with these —
they are separate owners, not part of this race.

Cost: a ~32s answer is roughly 500 characters, so each free-topic question billed ~1,000
(prod) or ~1,500 (dev) instead of ~500 — against a 10,000/month tier.

Two changes, both on Hmz's call:

1. **`FreeTopicCard` owns free-topic narration**; the `speak()` call is gone from
   `InputBox`. The card renders the answer, speaks the parsed text that matches what is on
   screen, and already handled the explaining/idle gesture and unmount cleanup — none of
   which InputBox did (it only toggled `isSpeaking`, which is why the avatar's gesture
   handling was unreliable on this path).
2. **`useTTS` shares one in-flight request per (voice, text)** (`_inflight` +
   `fetchTtsShared`). Concurrent duplicate calls now wait on the first request rather than
   opening their own, which kills the StrictMode double-fire in dev and protects against any
   future component narrating something already being fetched. Entries clear as soon as the
   request settles, so speaking the same text again later still refetches.

Verified live on `/learn`: one free-topic question went from **3 `/api/tts` calls to 1**,
request time from ~2.7-4.2s to **1.69s**, and aborts from 3 to **0**.

## 2026-09-08 — demo narration, avatar default, ops unblocked

Branch `dev/v2-instant-demo` (merged up from `deploy-prep` first, so it now carries T10's
CI/tests). **Uncommitted at time of writing.**

- **Demo narration is pre-rendered ElevenLabs audio**, not browser speechSynthesis.
  `scripts/prerender-demo-tts.mjs` (dependency-free node, reads `.env.local`, resumable,
  `--dry-run`) wrote 30 mp3s / 7,029 chars into `public/demo/<slug>/`. `useTTS` gained a
  `srcUrl` option that points the singleton audio element at a static file; that element is
  what wawa-lipsync analyses, so **this is what made lipsync work on the demo at all** —
  speechSynthesis exposes no audio buffer. Per-segment fallback to speechSynthesis if a file
  fails to load. Verified in-browser: 0 `/api/` requests across a full lesson.
- **DEFAULT_TEACHER is now `marcus`** (`useAristoStore.ts`), on `/learn` as well as `/demo`.
  Reason: ryan has 0 viseme morphs and sonia has no mouth morphs at all, verified by parsing
  the GLB JSON chunks — neither can ever lipsync. Cost: cold `/learn` goes ~3.6 MB -> ~12.7 MB,
  partly undoing T02. Accepted deliberately: a teacher whose mouth does not move undercuts the
  product's main visual claim. `Teacher.tsx`'s module-scope preload became
  `preloadDefaultAvatar()` called from `LearnClient` — at module scope it also charged `/demo`
  2.5 MB for an avatar it discards. Sign-in prefetch retargeted to marcus.
- **Pricing note corrected**: Sonnet 5's $2/$10 is now standard; the scheduled 2026-09-01 rise
  to $3/$15 was cancelled. The old comment told a future session to bump the row, which would
  have overstated every lesson cost by ~50%. Rates were and are correct.
- **User actions cleared**: migration 016 applied, admin bootstrap SQL run, fal.ai topped up,
  Resend fully wired in Vercel (RESEND_API_KEY prod+preview, ADMIN_NOTIFY_EMAIL and APP_URL
  added as Config, prod+preview) — takes effect on next deploy.
- **New brief**: `V7-alignment-lipsync.md`. Current lipsync is an FFT guess; ElevenLabs
  character timings would make it real. Free on `/learn` (`with-timestamps` bills the same
  characters); the demo can use Forced Alignment on the existing mp3s, billed as STT, so it
  costs no TTS quota.
- Backlog: sonia's phantom `mouthSmile` morph added to `UX-POLISH-BACKLOG.md` as item 0.

## 2026-07-13 — T10 ops hardening (autonomous parts)

- Branch `dev/t10-ops-hardening` (off `deploy-prep`), not pushed. CI (`.github/workflows/ci.yml`),
  Vitest unit tests (4 files / 47 tests: BKT, FSRS, profiler, pricing — all pure logic, no
  network mocking), `.env.example` refreshed, and a read-only live-DB migration reconciliation
  (all 15 migrations confirmed applied) are done. Resend env vars, admin bootstrap SQL, and
  Sentry are user-dependent — runbook at `.claude/plans/T10-RUNBOOK.md`.

## 2026-07-12 — Roadmap era

- Desk quiz + head-turn camera + free-mode 3D hardening shipped (was branch
  `dev/desk-quiz-3d-fixes`, merged to `deploy-prep`).
- Full project audit done. **Active work queue: `.claude/plans/README.md`** (vision tier
  V1–V6 + maintenance tier T01–T11 + UX polish backlog). Session continuity:
  `.claude/plans/SESSION_HANDOFF.md`.
- Production = Vercel `deploy-prep` branch. `master` promotion still pending (needs Vercel
  dashboard branch switch).

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

## What's Next (post-Phase-9 polish)

- **Vercel deploy** — env vars in Vercel dashboard, verify `maxDuration = 60` on lesson route if Sonnet stalls
- **RAG seeding** — admin-only `POST /api/kg/ingest` per domain (needs `OPENAI_API_KEY`)
- **End-to-end 3D test** — fal.ai pipeline works with `FAL_KEY`; verify model appears in scene
- **Phase 10 (planned)** — real-time voice (ElevenLabs / Whisper to replace Web Speech), shared sessions via Supabase Realtime
- **Lesson streaming** — would replace the synchronous `generateLesson()` JSON return with progressive 5-phase render; requires LessonView + lesson route restructure (deferred)

## Migration State

All run; no pending. `001_initial_schema` → `015_user_approval` (no `007` — quiz_attempts went into `006_mastery`).
- `005_reset_and_graph.sql` — drops FSLSM tables, builds `concepts` / `concept_prerequisites`
- `006_mastery.sql` — `learner_profiles`, `user_concept_mastery` (+ SRS), `user_course_progress`, `user_misconceptions`, `session_logs`, `quiz_attempts`
- `008_courses.sql` — `courses` + `course_id` FK
- `009_quiz_constraints.sql` — `UNIQUE(user_id, concept_id, misconception)`, `increment_misconception()` RPC
- `010_rag.sql` — vector extension, `reference_chunks` + HNSW index, `match_reference_chunks()` RPC
- `015_user_approval.sql` — `profiles.approval_status` + companion columns for the admin approval gate
