# T06 — Persistent Generation Cache (Supabase Storage)

**Model:** sonnet | **Priority:** 7 | **Depends on:** T01; do before or with T07

## Context

All fal.ai outputs (NB Pro infographics ~$0.04, FLUX sources $0.003, TripoSR GLBs $0.07) are
cached only in-memory per Fluid Compute instance (`src/lib/imagegen/banana.ts` — three
SHA-256-keyed LRU Maps, 12 h TTL). Cold instances regenerate everything, and every student
pays generation cost for the same concept. The intended fix (recorded in project memory) is:
**the first student to view a concept pays once; everyone after inherits from storage.**

This also unblocks T07 (a better, pricier image->3D model becomes affordable when amortized
per concept instead of per view).

Relevant code: `src/lib/imagegen/banana.ts` (all three generators + cache helpers),
`src/app/api/generate-model/route.ts`, `src/app/api/generate-model/3d/route.ts`,
`src/app/api/learn/segment-visuals/route.ts`. Migrations live in `supabase/migrations/`
(next number: check the folder; expected `016_*`). Cost logging: `src/lib/llm/fal.ts`.

## Design (follow this)

1. **Storage**: one private Supabase Storage bucket `generated-assets`. fal.ai URLs are
   temporary — download the artifact server-side and re-upload to the bucket
   (`{kind}/{hash}.{ext}`). Serve via long-lived signed URLs or a public bucket if the assets
   are not sensitive (they are generated educational images — public bucket with immutable
   cache headers is fine and simpler; confirm with user).
2. **Table** `generated_assets` (migration 016):
   - `id uuid pk`, `kind text check in ('infographic','flux_source','model_3d')`,
     `prompt_hash text not null` (the same SHA-256 key banana.ts already computes),
     `concept_id uuid null references concepts` (nullable — free-mode has no concept),
     `storage_path text not null`, `source_model text` (e.g. `fal-ai/triposr`),
     `bytes int`, `created_at timestamptz default now()`,
     `unique (kind, prompt_hash)`.
   - RLS: read for authenticated users; insert via service-role only (server routes).
3. **Lookup flow** in banana.ts, layered around the existing helpers:
   memory cache -> `generated_assets` by `(kind, prompt_hash)` -> generate -> upload ->
   insert row -> populate memory cache. Failures in the persistence layer must degrade to
   the current behavior (log + return the fal URL) — never block a lesson on storage errors.
4. Pass `concept_id` down from the routes where it is known (lesson/segment-visuals paths)
   so future admin tooling can list assets per concept.
5. Zod-validate route inputs if not already (project rule).

## Acceptance criteria

- Second request for the same prompt (fresh server instance — restart dev server to test)
  serves from Supabase without a fal.ai call (verify via `usage_events`: no new cost row).
- Storage failure path tested (e.g. wrong bucket name locally) — generation still succeeds.
- Migration applies cleanly; RLS in place; `yarn type-check` + `yarn build` pass.

## Do NOT

- Do not remove the in-memory caches — they stay as the L1 layer.
- Do not make the client fetch from fal.ai directly.

## Status checklist

- [ ] Migration 016 written + applied
- [ ] Bucket created (public/private decision recorded: ____)
- [ ] banana.ts layered lookup implemented
- [ ] Cold-instance cache hit verified via usage_events
