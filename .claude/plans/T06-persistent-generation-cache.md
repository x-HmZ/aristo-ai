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

**COMPLETE — verified end to end 2026-09-09.**

- [x] Migration 016 written + applied — `supabase/migrations/016_generated_assets.sql`,
      applied to the live DB by hand via the Supabase SQL Editor (the REST API exposes no
      arbitrary-SQL endpoint, so an agent session cannot run DDL). Confirmed live:
      `generated_assets` returns `200 []` rather than `PGRST205 relation not found`.
      Note: `concept_id` is `VARCHAR(100)` (FK to `concepts.id`), not `uuid` as sketched
      above — `concepts.id` is `VARCHAR(100)` per `005_reset_and_graph.sql`.
- [x] Bucket created — **decision recorded: PUBLIC** (confirmed by Hmz, 2026-09-09).
      `generated-assets`, public, 20 MB file size limit, created live via the Storage Admin
      API. Rationale: the assets are generated educational images with no learner data;
      paths are content-addressed (`{kind}/{sha256-24}.{ext}`) so they are unguessable;
      public URLs are CDN-cacheable, never expire, and need no signing round trip, which
      keeps them safe to store in the L1 memory cache and in lesson payloads. Uploads set
      `cacheControl: "31536000"` — verified live on the served object:
      `cache-control: public, max-age=31536000`.
- [x] banana.ts layered lookup implemented — `src/lib/imagegen/banana.ts`: memory (L1) ->
      `generated_assets` table (L2) -> generate via fal -> upload to bucket -> upsert row ->
      populate L1 with the durable Supabase URL. All three generators
      (`generateInfographic`, `generate3dSourceImage`, `generate3dModel`) updated;
      `concept_id` threaded from `/api/generate-model`, `/api/generate-model/3d`,
      `/api/learn/segment-visuals` and their client call sites (`useLessonPlayback.ts`,
      `LessonView.tsx`, `Experience.tsx`).
- [x] Cold-instance cache hit verified via usage_events — proven against the live project
      with `generate3dSourceImage` (FLUX Schnell, $0.003/call), each run a **separate
      process** so L1 was genuinely cold:

      | run | scenario | result |
      |-----|----------|--------|
      | 1 | first call, empty cache | 3683 ms, generated, **1 new `usage_events` row** ($0.003), row + 127 KB object persisted; returned URL is already the Supabase one, not fal's |
      | 2 | same prompt, cold process | 300 ms, identical URL, **no new `usage_events` row** — L2 hit, zero fal.ai spend |
      | 3 | storage failure (bucket renamed to `generated-assets-WRONG-NAME`), fresh prompt | generation **still succeeded**; `console.warn "L2 persistence skipped ... Bucket not found"`, no throw, served the fal.ai URL, and correctly wrote **no** row for an object it could not store |

      The served object returns `HTTP 200`, `content-type: image/png`,
      `cache-control: public, max-age=31536000`. Total real fal.ai spend for the whole
      verification: **$0.009** (3 FLUX calls). All test rows and objects were deleted
      afterwards — `generated_assets` and the bucket are both empty again.

### Defect found and fixed during verification (2026-09-09)

A row is not proof the object still exists. `getPublicUrl` is pure string building — it
never checks — so **row present + object deleted** (admin bucket cleanup, a lifecycle rule;
the earlier T06 session did exactly that kind of cleanup) made L2 return a URL that `400`s.
Worse, the row kept "hitting", so generation never re-ran: a permanently broken image in a
lesson, silently, with no self-healing. Reproduced live before the fix (deleted the object,
left the row: 168 ms "hit" -> URL returning `400`).

Fix in `lookupPersistedAsset`: confirm a hit with a `HEAD` before trusting it, bounded by
`OBJECT_CHECK_TIMEOUT_MS` (1500 ms). A definitive `400`/`404` drops the stale row and falls
through to generation, which re-persists; any other outcome — timeout, network blip — serves
the URL anyway (fail-open, so a slow storage layer never costs a regeneration). Verified
live: the stale row logged `dropping the row and regenerating`, regenerated, re-persisted,
and the next cold process hit it cleanly at 300 ms with no new cost row. Cost of the guard
is ~100 ms per L2 hit (199 ms -> 300 ms) against ~3800 ms to regenerate.

### Gates

`yarn type-check`, `yarn lint` (warnings only, all pre-existing, none in `banana.ts`),
`yarn test` (76/76) and `yarn build` all pass on the merge commit.
