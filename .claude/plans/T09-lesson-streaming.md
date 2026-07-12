# T09 — Lesson Streaming (kill the 30-60 s wait)

**Model:** opus | **Priority:** 6 | **Depends on:** T05 (model bump first, so latency work targets the final model)

## Context

Today `GET /api/learn/lesson/[conceptId]` makes ONE synchronous Sonnet tool_use call that
returns the entire 5-phase lesson (all segments, all visual prompts) before the student sees
anything — 30-60 s of loading. This is the single worst UX moment in the app. True token-level
streaming of tool_use JSON is fragile (partial-JSON parsing, schema validation only possible at
the end). The design below avoids it.

## Design (follow this — split generation with prompt caching)

Split the lesson into two sequential generations that exploit the fact that narrating
phase 1-2 takes the student 1-3 minutes — far longer than a second LLM call:

1. **Call A (fast-start)**: generate ONLY Activate + Explain phases (their segments + visual
   prompts). Same system prompt, same tool_use pattern, smaller output -> returns in roughly
   1/3 the time. Response is returned to the client immediately and playback starts.
2. **Call B (completion)**: fired server-side right after Call A resolves (do not wait for the
   client), generating Demonstrate + Challenge + Connect. Pass Call A's output back in the
   user message ("here are phases 1-2, continue with 3-5, stay consistent") so continuity
   holds. The shared system prompt + reference material block already carry
   `cache_control: ephemeral` — verify Call B is structured so the cached prefix actually hits
   (identical system blocks, stable prefix ordering).
3. **Delivery of part B to the client** — pick the simplest robust option:
   - Preferred: the lesson route becomes an SSE/streamed JSON-lines response
     (`ReadableStream` from the route handler): event 1 = phases 1-2 payload, event 2 =
     phases 3-5 payload, event `error` otherwise. Client consumes with `fetch` + reader in
     `useCourseAutoTeach` / wherever the lesson is fetched today.
   - Alternative if SSE fights the Pages-Router client plumbing: Call A response includes a
     `lessonId`; client polls `GET /api/learn/lesson/[conceptId]?part=rest` which awaits a
     server-held promise (in-memory map keyed by lessonId, same Fluid instance) or regenerates.
     SSE is cleaner; try it first.
4. **Client state**: `useLessonPlayback` / `LessonPlayer` must tolerate a lesson whose later
   phases arrive while phase 1 is narrating: store merges `segments` append-only; the "next"
   control shows a small "preparing the rest..." state only if the user outruns generation
   (skip-spamming). If Call B fails, retry once, then gracefully end the lesson after phase 2
   with an apology card and log to console + `usage_events` unaffected.
5. **Lesson cache interaction** (`cached_lessons`, keyed by concept + profile signature):
   cache the ASSEMBLED full lesson only after Call B succeeds; cache hits bypass streaming
   entirely (return everything in event 1). Moderation flow unchanged.
6. **Segment visuals**: today the client batch-fetches visuals after the full lesson arrives.
   Move to per-part batches: fire the phases-1-2 visual batch as soon as event 1 lands.
7. Keep the legacy non-adaptive path working (`NEXT_PUBLIC_ADAPTIVE_VISUALS` off -> old
   single-shot behavior is acceptable; guard the new path behind the same flag if simpler).

Key files: `src/lib/agents/teaching.ts` (schema splits into two tools or one tool called with
a `phases` argument), `src/app/api/learn/lesson/[conceptId]/route.ts`, `src/hooks/useLessonPlayback.ts`,
`src/hooks/useCourseAutoTeach.ts`, `src/components/learn/LessonPlayer.tsx`, store.

## Acceptance criteria

- Time from "start lesson" to first narrated word cut to well under half of current
  (record before/after with the same concept, cache cold).
- Skip-spamming to phase 5 never crashes; failure of Call B degrades gracefully.
- Cached lessons still work; moderation statuses unchanged; `usage_events` shows two calls
  with cache-read tokens on Call B (verify prompt cache hit).
- `yarn type-check` + `yarn build` pass; manual end-to-end lesson verified in browser.

## Do NOT

- No token-level partial-JSON parsing of tool_use streams.
- No schema loosening — both calls stay strict tool_use.
- Do not break the legacy (flag-off) path.

## Status checklist

- [ ] teaching.ts split implemented (prompt-cache verified)
- [ ] Route streams part 1 / part 2
- [ ] Client merge + outrun state
- [ ] Cache + moderation integration
- [ ] Before ____ s -> after ____ s to first word
