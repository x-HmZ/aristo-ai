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

- [x] Migration 016 written — `supabase/migrations/016_generated_assets.sql`. **NOT applied to the
      live DB.** This environment has only `NEXT_PUBLIC_SUPABASE_URL` / anon key / service-role
      key in `.env.local` — no Postgres connection string, no `SUPABASE_ACCESS_TOKEN`, no linked
      `supabase` CLI session, and no `supabase` MCP server available in-session. PostgREST (what
      the service-role key talks to) has no arbitrary-SQL endpoint, so DDL cannot be executed
      from this session. Verified empirically: `select 1 from generated_assets` returns
      `PGRST205 relation not found`. **Action needed:** paste the migration file's contents into
      the Supabase SQL Editor once (10 seconds), or add a DB connection string / access token to
      `.env.local` for a future automated session. Note also: `concept_id` is `VARCHAR(100)` (FK
      to `concepts.id`), not `uuid` as sketched in this brief — `concepts.id` is
      `VARCHAR(100)` per migration `005_reset_and_graph.sql`.
- [x] Bucket created — `generated-assets`, **public**, 20MB file size limit, created live via
      the Storage Admin API (works with the service-role key even though DDL doesn't). Uploads
      use `cacheControl: "31536000"` (1y, immutable) — confirmed on real test uploads
      (`cacheControl: 'max-age=31536000'` in the object metadata).
- [x] banana.ts layered lookup implemented — `src/lib/imagegen/banana.ts`: memory (L1) ->
      `generated_assets` table (L2) -> generate via fal -> upload to bucket -> upsert row ->
      populate L1 with the durable Supabase URL. All three generators
      (`generateInfographic`, `generate3dSourceImage`, `generate3dModel`) updated; `concept_id`
      threaded from `/api/generate-model`, `/api/generate-model/3d`, `/api/learn/segment-visuals`
      and their client call sites (`useLessonPlayback.ts`, `LessonView.tsx`, `Experience.tsx`).
- [ ] Cold-instance cache hit verified via usage_events — **blocked on the migration above.**
      Ran the layered code against the live (table-less) project twice, in two separate
      `npx tsx` process invocations (genuine cold L1), via `generate3dSourceImage` (FLUX
      Schnell, $0.003) + `generate3dModel` (TripoSR, $0.07): L1 memory hit confirmed
      (0ms repeat call, same URL, same process); L2 lookup/insert correctly caught the missing
      table and degraded to the fal.ai URL every time (`console.warn` fired, no throw, no
      lesson-blocking) — this doubles as the "storage failure path" acceptance criterion,
      proven against a real failure (missing table) rather than a simulated wrong bucket name.
      Because the table doesn't exist, run 2 necessarily made its own fresh fal.ai calls
      (4 new `usage_events` rows total, $0.146 spend, well under the $0.50 cap) — once migration
      016 is applied, rerunning the same two-process probe is expected to show run 2's calls
      collapse to L2 hits with zero new fal.ai rows. Test artifacts uploaded to the bucket during
      the probe were deleted afterward to keep it clean.
