# T11 — Content Seeding (KG + RAG for launch domains)

**Model:** sonnet | **Priority:** 11 | **Depends on:** T05 (better generation model), ideally T10 (admin working)

## Context

The machinery is built but the shelves are near-empty: the knowledge graph has thin/demo
content and the RAG table (`reference_chunks`) was never seeded — so lessons generate from
model priors alone, without grounded reference material. To be demonstrable ("somewhat
complete"), the app needs 1-2 fully built launch domains for grades 6-8.

Existing tooling (verify signatures before use):
- `POST /api/kg/generate/[domain]` — LLM-generates concepts + prerequisite edges for a domain
- `POST /api/kg/validate/[domain]` — validates the graph (cycles, orphans)
- `POST /api/kg/ingest` — admin-only RAG ingest: chunks (1800 chars, 200 overlap) -> OpenAI
  embeddings -> `reference_chunks` (needs `OPENAI_API_KEY`)
- `POST /api/courses/generate` — CurriculumAgent builds a course from the KG
- Admin UI under `/admin`

## What to do

1. Pick launch domains with the user (suggest: "Cell Biology" and "Fractions & Ratios" —
   one physical/3D-friendly science domain + one math domain exercises different lesson styles).
2. For each domain:
   a. Generate the KG (aim 15-30 concepts), validate, then **manually review** the graph in the
      admin/map UI for nonsense edges — LLM-generated prerequisite graphs need human eyes;
      present the concept list + edges to the user for a quick approve/edit pass.
   b. Source reference material for RAG: public-domain / openly licensed texts only
      (e.g. CK-12 (check license terms), OpenStax middle-school-adjacent sections, Wikipedia
      simple-English articles). Record source + license per document in a
      `content/sources.md` manifest. Do NOT ingest copyrighted textbook content.
   c. Ingest via `/api/kg/ingest`; verify retrieval quality by generating a lesson and checking
      the `<reference_material>` block actually surfaces relevant chunks (log or debug print).
   d. Generate + publish one course per domain; run through 2-3 lessons end-to-end including
      quiz + review flow.
3. Document the repeatable recipe in `.claude/docs/content-pipeline.md`: exact steps, costs
   observed (embedding + generation), and the review checklist — so future domains are a
   30-minute job.

## Acceptance criteria

- Two domains live: validated KG, seeded RAG (with licensed-source manifest), one published
  course each, lessons verifiably using retrieved reference material.
- `content-pipeline.md` recipe written.
- Total spend recorded (embeddings + LLM + any visuals triggered).

## Do NOT

- No copyrighted material into `reference_chunks`.
- Do not bulk-generate dozens of domains — depth over breadth for launch.

## Status checklist

- [ ] Domains chosen: ____ , ____
- [ ] KGs generated + human-reviewed
- [ ] RAG seeded (sources manifest)
- [ ] Courses published + played through
- [ ] Recipe doc written (spend: $____)
