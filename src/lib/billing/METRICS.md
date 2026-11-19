# Which route consumes which allowance

Wired: every route in the table below with a metric calls `requireEntitlement()` and spends as shown (file:line in the
last column). With `ENFORCE_ALLOWANCE` off the guard behaves exactly like `requireApproved()`. Not wired on purpose:
the routes marked `none`, which keep `requireApproved()` (segment-visuals, interactive, quiz routes, stt, profile,
admin, the course and learn reads). The wiring is covered by `src/app/api/metering.test.ts` and
`src/app/api/tts/route.test.ts`.

## How to wire a route

```ts
import { requireEntitlement, spendAllowance, releaseConsumed } from "@/lib/billing/entitlements";

const guard = await requireEntitlement();              // replaces requireApproved(); same { user, error }
if (guard.error) return guard.error;
// ... cache lookup; on the branch that costs money:
const spent = await spendAllowance(guard.entitlement, "fresh_lessons");
if (spent.error) return spent.error;                   // 402 allowance_exhausted, or 503
try { /* generate */ } catch (e) { await releaseConsumed(spent.consumed); throw e; }
```

When the whole request costs one unit, pass it to the guard instead: `requireEntitlement({ metric: "chat_turns" })`
and call `releaseConsumed(guard.consumed)` on failure. Both are no-ops while `ENFORCE_ALLOWANCE` is off and for
platform admins. Consume AFTER input validation (a 400 must not cost an allowance) and BEFORE the paid call.

## Table

| Route | Metric | Amount | Where (consume / release) |
|---|---|---|---|
| `GET /api/learn/lesson/[conceptId]` | `fresh_lessons` | 1 | Cache-miss branch only, after the cache lookup, before generation: `learn/lesson/[conceptId]/route.ts:101`; released in the catch, line 202. |
| `GET /api/learn/lesson/[conceptId]` | `replays` | 1 | Cache-hit branch, `:95`. Counts but NEVER blocks: the result is ignored, so a cached lesson is served over the cap and when the counter fails (decision taken). |
| `POST /api/teach` | `chat_turns` | 1 | After the topic check: `teach/route.ts:139`; release in the catch, `:197`. |
| `POST /api/learn/explain-more` | `chat_turns` | 1 | After validation: `learn/explain-more/route.ts:35`; release `:43`. |
| `POST /api/learn/challenge` | `chat_turns` | 1 | After validation: `learn/challenge/route.ts:41`; release `:84`. |
| `POST /api/tts` | `voice_chars` | `text.length` | `scope: "live"` only, after validation and the throttle, before ElevenLabs: `tts/route.ts:162`; release in the catch, `:264`. Lesson scope consumes nothing (see note 1). |
| `POST /api/generate-model/3d` | `models_3d` | 1 | Before `generate3dModel()`: `generate-model/3d/route.ts:51`; released at `:59` when the result is cached and in the catch, `:65`. Free and Plus have 0, so they get 402. |
| `POST /api/generate-model` | `models_3d` | 1 | Only when `model3dPrompt` is set (the FLUX source image of a 3D model; a teaching-image-only request costs nothing): `generate-model/route.ts:46`; released at `:73` when the source image was cached and in the catch, `:84`. `generate3dSourceImageDetailed()` was added to `banana.ts` to report hit or miss; `generate3dSourceImage()` is unchanged. |
| `POST /api/courses/generate` | `fresh_lessons` | 1 | Guard with `{ metric }` after the `domain` check: `courses/generate/route.ts:29`; release in the catch, `:83`. |
| `POST /api/learn/segment-visuals` | none | | Part of a fresh lesson's cost; covered by `fresh_lessons`. Keep L04's per-request caps. |
| `POST /api/learn/interactive` | none | | Part of a fresh lesson; its own DB-backed window limit stays. |
| `GET /api/quiz/lesson/[conceptId]`, `GET /api/quiz/review`, `POST /api/quiz/submit` | none | | Part of a lesson; L08 caches quizzes per concept. |
| `GET /api/learn/next`, `POST /api/learn/complete`, `/api/courses*` reads, `/api/stt`, profile, admin | none | | No metered paid call: `requireApproved()` unchanged. |

`learners` is a limit, not a counter: check it where L06 adds a learner (`limits.learners`).

## Notes

1. `voice_chars` counts chat voice only (`scope: "live"`). Lesson narration (`scope: "lesson"`) consumes nothing
   here: its cost belongs to the lesson. An unmetered lesson-scope cache miss is bounded only by the per-learner
   throttle until the spend guard (plan item L04) meters it.
2. Paid plans count per billing period (`subscriptions.current_period_start`), free per UTC calendar month. The counter
   key is the period's start date, so an upgrade mid-month usually starts a fresh row with the full new allowance
   (an upgrade bought on the 1st shares the free month's row).
3. Per-seat plans pool: `limit x seats`, floored (0.5 fresh lessons x 10 seats = 5).
