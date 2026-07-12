# T05 — LLM Model Bump (Sonnet 4.6 -> Sonnet 5)

**Model:** sonnet | **Priority:** 2 | **Depends on:** nothing

## Context

`src/lib/agents/models.ts` pins:

```ts
teaching:   "claude-sonnet-4-6",
assessment: "claude-sonnet-4-6",
fast:       "claude-haiku-4-5-20251001",
```

Claude Sonnet 5 (`claude-sonnet-5`) is now available and is the better default for the
teaching and assessment agents (structured 5-phase lessons, 8-type quiz generation).
Haiku 4.5 remains the best cheap/fast option — leave `fast` unchanged.

Pricing is logged per call in `src/lib/llm/pricing.ts` and written to `usage_events`;
that table must know the new model ID or cost attribution breaks.

## What to do

1. Verify the exact current model ID and per-MTok pricing for Sonnet 5 from the official
   Anthropic docs (https://docs.claude.com/en/docs/about-claude/models) — do not guess pricing.
2. Update `models.ts`: `teaching` and `assessment` -> `claude-sonnet-5` (or the exact dated ID
   the docs recommend for production pinning).
3. Update `src/lib/llm/pricing.ts`: add the new model's input/output prices; keep the 4.6 row
   (historical usage_events still reference it).
4. Grep the whole repo for `claude-sonnet-4-6` to catch strays (known: a descriptive string in
   `src/app/admin/cost/page.tsx:251` — update the example text).
5. Smoke test with the dev server + a real key: generate one lesson (course mode) and one lesson
   quiz; confirm tool_use JSON validates against the existing schemas and the 5-phase/segment
   structure renders. If the adaptive `segments` array comes back malformed, report back rather
   than patching schemas — that would escalate to a bigger task.
6. Check max_tokens / maxDuration: lesson route runs with `maxDuration = 60`. If Sonnet 5 is
   slower for this payload, note observed latency in the checklist (T09 addresses the wait
   properly; do not restructure here).

## Acceptance criteria

- Exactly one place defines model IDs; pricing table covers old + new IDs.
- One successful end-to-end lesson + quiz generation observed and cost row written to
  `usage_events` with correct nonzero cost.
- `yarn type-check` passes.

## Do NOT

- Do not touch prompts, schemas, or agents beyond the model constant unless output is broken —
  and if it is, stop and report.

## Status checklist

- [ ] Sonnet 5 ID + pricing verified from docs
- [ ] models.ts + pricing.ts updated
- [ ] Repo grep clean
- [ ] Smoke test passed (lesson latency observed: ____ s)
