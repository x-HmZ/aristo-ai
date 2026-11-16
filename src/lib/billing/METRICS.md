# Which route consumes which allowance

For the wiring step after L07/L13. Nothing below is wired yet: every route still calls `requireApproved()`.

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

| Route | Metric | Amount | Where exactly |
|---|---|---|---|
| `GET /api/learn/lesson/[conceptId]` | `fresh_lessons` | 1 | Cache-miss branch only: after the `if (hit) return ...` block, before `generateLesson()`. Release if generation throws. |
| `GET /api/learn/lesson/[conceptId]` | `replays` | 1 | Cache-hit branch, before returning `hit.payload`. On 402, still decide whether a cached replay should be served (pricing.md says catalogue replays keep working over a cap: then skip the 402 and only count). Owner decision. |
| `POST /api/teach` (free chat) | `chat_turns` | 1 | After the body is validated, before the Anthropic call. |
| `POST /api/learn/explain-more` | `chat_turns` | 1 | After validation, before the Haiku call. |
| `POST /api/learn/challenge` | `chat_turns` | 1 | Same. |
| `POST /api/tts` | `voice_chars` | `text.length` | After the length check, before the ElevenLabs call; release on a non-OK ElevenLabs response. See note 1. |
| `POST /api/generate-model/3d` | `models_3d` | 1 | After validation, before `generate3dModel()`, and only when it will not be a cache hit (needs the cache check split out of `generate3dModel`, or count `cached: false` results and release on `cached: true`). Free and Plus have 0, so they get 402. |
| `POST /api/generate-model` | `models_3d` | 1 | Same rule as above (FLUX source image for a 3D model). |
| `POST /api/learn/segment-visuals` | none yet | | Part of a fresh lesson's cost; covered by `fresh_lessons` once lessons are counted. Keep L04's per-request caps. |
| `POST /api/learn/interactive` | none | | Part of a fresh lesson; its own DB-backed window limit stays. |
| `GET /api/quiz/lesson/[conceptId]`, `GET /api/quiz/review`, `POST /api/quiz/submit` | none | | Part of a lesson; L08 caches quizzes per concept. |
| `POST /api/courses/generate` | `fresh_lessons` | 1 | Course generation is an LLM call per request; count it like a lesson until it has its own metric. Owner decision. |
| `GET /api/learn/next`, `POST /api/learn/complete`, `/api/courses*` reads | none | | No paid call: `requireEntitlement()` without a metric. |

`learners` is a limit, not a counter: check it where L06 adds a learner (`limits.learners`).

## Notes

1. `voice_chars` in the plan table (pricing.md C1) is chat voice only; fresh-lesson narration is "included" in a
   fresh lesson and catalogue audio comes from the audio cache (L08). `/api/tts` cannot tell narration from chat
   today, and a client-sent flag would be trusted input. Until L08's server-side audio cache exists, either count
   every character (Plus's 8,000 then covers about two narrated lessons) or add the per-lesson narration budget
   (3,700 per fresh lesson) to the limit. Owner decision; do not wire `/api/tts` before it.
2. Paid plans count per billing period (`subscriptions.current_period_start`), free per UTC calendar month. The counter
   key is the period's start date, so an upgrade mid-month usually starts a fresh row with the full new allowance
   (an upgrade bought on the 1st shares the free month's row).
3. Per-seat plans pool: `limit x seats`, floored (0.5 fresh lessons x 10 seats = 5).
