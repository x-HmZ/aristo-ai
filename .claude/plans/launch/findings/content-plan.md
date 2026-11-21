# Content plan: more subjects on day one through the RAG upload path

Audit and research, 2026-11-16. Code read only; no server started, no paid call, nothing downloaded. Web facts were read from the cited pages on 2026-11-16; anything that could not be read on the page is marked UNCONFIRMED. This is not legal advice.

## One-page summary

**Can the owner add a subject today by uploading a PDF in the admin UI? No.**

- The upload route refuses PDFs (`src/app/api/admin/rag/upload/route.ts:54-59`) and the dialog says so and only accepts `.txt/.md` (`src/app/admin/rag/_components/UploadDialog.tsx:92,141`). No PDF library is in `package.json`.
- Even with text: the route runs inside one Vercel function (`maxDuration = 60`, route.ts:21) and Vercel rejects request bodies over 4.5 MB (https://vercel.com/docs/errors/FUNCTION_PAYLOAD_TOO_LARGE). So a 20 to 200 MB textbook PDF cannot be posted at all, and a whole book's text in one call would time out (inferred ceiling about 500 to 600 chunks per call, see 1.5).
- Adding the text is only half a subject. A subject also needs a domain with concepts and prerequisites, and nothing creates those from a document: `/api/kg/generate/[domain]` takes only a subject name (`src/app/api/kg/generate/[domain]/route.ts:55-56`), never text or a table of contents. The two systems (KG and RAG) are independent, linked only by the free-text `domain` string.
- Today's manual path that does work: extract the text outside the app, upload one `.txt` per chapter (under 4.5 MB and about 500 chunks each), typing the same `domain` the concepts use. KG: generate by subject name, review, commit.

**Smallest changes that make "upload a PDF, get a grounded subject" true** (briefs in Part 4, in order):
1. Extract PDF text in the admin's browser with `pdfjs-dist` (no server upload, so the 4.5 MB limit never applies), send it in batches of about 40 chunks per request (E1, E2).
2. A `content_sources` table (title, author, licence, URL, attribution text) and `source_id` on chunks; dedupe by content hash; delete by source (E2).
3. A free admin "preview grounding" tool that shows the exact `<reference_material>` block a concept would receive, with no LLM call (E3).
4. Table-of-contents to KG: a tool-use call that turns an extracted outline plus a few chunks per chapter into concepts, grade-appropriate, reviewed in the existing KG admin (E4).
5. Onboarding subject list read from published courses instead of the hardcoded two (E5), and attribution shown in the lesson UI, `/credits` and `LICENSES.md` (E6).

**Licence finding that changes the plan: OpenStax is out.** Its books are now CC BY-NC-SA, and its own page forbids ingesting a book into generative AI offerings without written permission. CK-12, Khan Academy, Eureka/EngageNY, Code.org, Core Knowledge, Experience AI, Think Python 3e and Automate the Boring Stuff are also non-commercial or no-derivatives. Clean sources for a commercial product are **Illustrative Mathematics 6-8 (CC BY 4.0)**, **OpenSciEd middle school (CC BY 4.0)**, the **Python documentation tutorial (PSF-2)**, and Siyavula's **unbranded** CC BY editions (availability UNCONFIRMED).

**Recommended day-one tracks:** (1) Maths 6-8: Illustrative Mathematics. (2) Science 6-8: OpenSciEd middle school units as grounding, with Siyavula Natural Sciences (unbranded CC BY) as structure if obtainable. (3) Python: the official tutorial as RAG for the already-seeded 38-concept KG. (4) optional, deferred: computing and AI literacy from CS Unplugged (CC BY-SA, ShareAlike risk) or owner-authored.

**Cost (every figure needs the owner's approval before it is spent):** minimum viable, all three tracks, KG plus RAG only: about **$1** (embeddings under $0.10, KG generation about $0.9). Pre-generated catalogue of 16 lessons per track with pictures and cached audio: about **$33 to $62, central $43** (about **$53** with a 20 percent retry margin), dominated by pictures ($0.32 per lesson) and by narration whose dollar rate is not in the repo. Verification of the RAG path: **under $0.01** for embeddings, about $0.12 for two comparison lessons if wanted.

---

## Part 1. How content gets in today (from the code)

### 1.1 The RAG pipeline end to end

| Stage | What exists | Cite |
|---|---|---|
| Admin access | `verifyAdmin()` looks up `profiles.is_admin` with the service client; every `/api/admin/rag/*` route calls it first. `/api/kg/ingest` repeats the check inline. | `src/lib/admin/auth.ts:27-43`; `upload/route.ts:76-77`; `kg/ingest/route.ts:29-43` |
| UI | `/admin/rag`: chunk table with domain filter and text search, upload dialog, similarity tester, per-chunk delete | `src/app/admin/rag/page.tsx`; `_components/UploadDialog.tsx`, `SimilarityTester.tsx` |
| Upload route | JSON `{domain, source_title?, text, concept_id?}` or multipart. A `file` with type `application/pdf` returns an error; any other file is read with `file.text()`. No Zod, no size check, no domain check. | `upload/route.ts:30-73` (PDF refusal at 55-59) |
| PDF parsing | None. No pdf library installed. Consequences for the questions asked: scanned PDFs (no OCR), tables (would flatten into row text), formulas (lost or garbled), images (ignored). A text-layer extractor like pdf.js or `pdf-parse` handles prose well, tables and formulas poorly, scans not at all. Source books below are all born-digital, so OCR is not needed for them. | `package.json` (no pdf dependency); route comment lines 10-11 |
| Chunking | `chunkText(text, 1800, 200)`: fixed character windows, about 450 tokens, 200 characters overlap, blind to sentences, headings and pages; drops fragments under 51 characters. A heading can be cut from its paragraph. | `src/lib/rag/embed.ts:35-52` |
| Embedding | OpenAI `text-embedding-3-small`, 1536 dimensions, input cut to 8,000 characters; null if `OPENAI_API_KEY` missing. Price **$0.02 per 1M tokens** (`text-embedding-3-large` $0.13). Usage is logged to `usage_events`, but the upload route calls `getEmbedding(c)` with no tag, so cost lands under "rag.embed.unspecified" with no user. | `src/lib/llm/openai.ts:12-62`; `src/lib/llm/pricing.ts:52-53`; `upload/route.ts:109` |
| Batching | Sequential groups of 5 chunks embedded in parallel; all rows inserted in one call at the end. An OpenAI error throws out of `Promise.all` with no try/catch around the loop: the whole request returns 500 and nothing is stored. | `upload/route.ts:107-134` |
| Storage | Table `reference_chunks` (migration `supabase/migrations/010_rag.sql`): `id`, `domain` varchar(100), `source_title` varchar(255), `content`, `embedding vector(1536)`, `metadata jsonb`, `created_at`; HNSW cosine index; RLS: authenticated read, service_role write. No licence, author, URL, page, grade or concept column; `concept_id` is only an optional key inside `metadata`. | `010_rag.sql:14-40` |
| Retrieval | RPC `match_reference_chunks(query_embedding, match_count=4, domain_filter)`, cosine similarity, ordered nearest first. **Filter: domain only** (not concept, not grade). `retrieveContext` embeds `"{name}: {description}. {objectives}"`, asks for top **4**, drops rows with similarity <= **0.3**, formats each as `[Reference (source_title)]\n content`. | `010_rag.sql:60-90`; `src/lib/rag/retrieve.ts:41-66` (threshold at 61) |
| Where chunks enter prompts | **Only the lesson generator.** `GET /api/learn/lesson/[conceptId]` calls `retrieveContext` on a **cache miss** for a KG concept, in parallel with the prerequisite lookup, then `generateLesson(concept, profile, ragContext)`; the chunks go in the user message inside `<reference_material>` (or "No additional reference material available. Use your general knowledge."). The system prompt says "Ground your explanations in the reference material provided. Do not fabricate facts." Not used in quiz generation, explain-more, challenge, review, free chat (`/api/teach`) or the free-form lesson fallback. | lesson route `:95-115, :144`; `src/lib/agents/teaching.ts:198, 633-637` |
| Source/licence shown to the learner? | **No.** `source_title` is put in the prompt only; the lesson payload has no sources field, no component renders one. The only attribution UI in the product is for the avatar models (`src/components/learn/AvatarCredit.tsx`). A CC BY corpus would be non-compliant as built. | grep of `src/components/learn`, `teaching.ts` |
| Gracefully optional? | Yes, mostly. No key: `getEmbedding` returns null, `retrieveContext` returns `[]` (`retrieve.ts:49-50`), lesson still generates from model priors. Empty table or RPC error: `[]` (`retrieve.ts:58`). An OpenAI exception inside `retrieveContext` is not caught there but the lesson route has `.catch(() => [])` (`lesson route:111`). Admin ingest and tester return 503 without the key (`upload:86-91`, `test:29-34`). |  |
| Cache interaction | RAG runs only on a lesson-cache miss. Lessons already in `cached_lessons` (key concept + profile signature) will never see newly added chunks until those rows are deleted or invalidated. | lesson route `:76-90` |

### 1.2 The admin "test" page

`POST /api/admin/rag/test` embeds one query, calls the same RPC with `k` 1 to 20 and an optional domain, and returns matches with score, source title and domain (`src/app/api/admin/rag/test/route.ts:17-69`); `SimilarityTester.tsx` colours scores. It proves that retrieval finds relevant text. It does **not** build the lesson prompt, apply the 0.3 cut-off the lesson path uses, call the LLM, or compare a lesson with and without references. So it cannot show that grounding improves a lesson; E3 adds that.

### 1.3 The knowledge graph

- **Tables:** `concepts` (id snake_case, domain, name, description, difficulty 1-5, bloom_level, estimated_minutes, key_terms, learning_objectives, common_misconceptions, tags; migration `005_reset_and_graph.sql:99-117`) and `concept_prerequisites` (edge list, no self edges; `:123-131`). **No grade-level, source or chunk reference column exists on concepts** (`grade_level` exists only on `profiles`, `001_initial_schema.sql:16`).
- **Creating a domain today:** (a) `POST /api/kg/generate/[domain]` asks Sonnet (`MODELS.teaching`, max_tokens 8192) for a JSON array, aims at "40-60 concepts", takes only a subject label, parses with a regex `\[[\s\S]*\]` (not tool_use, against the project rule), and does not save anything (`route.ts:18-44, 58-80`). At about 200 tokens per concept, 40 or more concepts is at or beyond 8192 output tokens, so a truncated reply fails JSON parsing: likely, not tested. (b) `POST /api/kg/concepts` upserts concepts and replaces prerequisite edges (service client, admin only; `route.ts:25-86`). No Zod, no cycle check on write; `POST /api/kg/validate/[domain]` runs `validateGraph` for cycles/orphans (`src/lib/kg/graph.ts`). (c) The admin page `/admin/knowledge-graph` wires generate, validate, commit and a concept editor (`page.tsx:99-135`). (d) Repo seed: only `supabase/seeds/python_intro.ts` (38 concepts, domain `python_programming`). (e) `/api/kg/ingest` is an older duplicate of upload that inserts with the **admin's user session**, not the service client (`kg/ingest/route.ts:97-99`); migration 010 allows writes only for `service_role`, so it should fail on RLS: broken by reading, untested. T11 still points at it. Delete it (E2).
- **Courses:** table `courses` (`008_courses.sql`): `domain`, title, `structure` JSONB (modules, lessons, `concept_ids`), `is_published`; admins write, everyone reads published. Built either by the CurriculumAgent (Sonnet groups the KG's concepts into modules, `src/lib/agents/curriculum.ts:100-190`, route `/api/courses/generate`, saved unpublished) or by admin `POST /api/admin/courses/from-kg` (no LLM: linear, by Bloom or by difficulty) and published from `/admin/courses`.
- **Onboarding to domain:** two hardcoded options, `python_programming` and `middle_school_science` (`src/components/onboarding/OnboardingView.tsx:47-50`); the API stores any non-empty string into `user_course_progress.domain` (`src/app/api/auth/onboarding/route.ts:28-61`); `/learn` reads that domain (`pages/learn.tsx:94-99`) and the picker lists all published courses regardless (`src/app/api/courses/route.ts:14-24`). `middle_school_science` exists nowhere else, so choosing it today leads to an empty subject.
- **Can a KG be generated from a PDF today? No.** KG and RAG are independent. The only link is that the lesson route filters chunks by `concept.domain`.

**What is missing for "upload a textbook PDF, get a course whose lessons are grounded in that book":** PDF text extraction; an upload path that is not limited by the 4.5 MB body or the 60 s function; a source registry with licence and attribution; outline extraction and TOC-to-concepts (grade-aware, tool_use, chunked output); chunk to concept alignment (today retrieval is domain-wide, which is fine if one domain is one book or one coherent set, but a concept's own chapter should be preferred); a free grounding preview; cache invalidation after ingest; a domain registry feeding onboarding; learner-facing attribution.

### 1.4 Limits and risks

| Topic | State |
|---|---|
| Upload size | Vercel Functions: 4.5 MB request body, 413 `FUNCTION_PAYLOAD_TOO_LARGE`; Vercel's own workaround is uploading straight to storage (https://vercel.com/docs/errors/FUNCTION_PAYLOAD_TOO_LARGE, https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions). Textbook PDFs of 20 to 200 MB are impossible via this route. Extracted text is small (a 500-page book is about 1 to 2 MB), so extracting in the browser and posting text in batches avoids the limit entirely. |
| Function duration | `maxDuration = 60`. Inferred, not measured: groups of 5 parallel embeds at about 0.3 to 0.6 s each means about 8 to 15 chunks per second, so roughly 500 to 600 chunks (0.8 to 1.0M characters) is the ceiling; one batched insert of that many 1536-float vectors is also a heavy single request. Batches of about 40 chunks per request remove the problem. |
| Rate limits | None in the app. OpenAI embeddings limits depend on the account tier (not checked). Parallelism is only 5, so 429s are unlikely; they would throw and abort the request (1.1). |
| Duplicates | None prevented: uploading the same text twice doubles the chunks and the retrieval would return near-identical top-4 hits. No content hash, no unique key. |
| Delete / re-index | Only single-chunk delete (`chunks/[id]/route.ts`). No "delete this source", no re-embed, no model-version column. Re-uploading a book means hand-deleting hundreds of chunks. |
| Admin only | Yes, all admin routes and `/api/kg/ingest`. Read policy: any authenticated user can select chunks directly via the Supabase API (`010_rag.sql:33-36`), which is acceptable only for openly licensed text. Do not store anything licensed "not for redistribution" in this table. |
| Prompt injection via text | Chunks are pasted unescaped into the user message (`teaching.ts:633-637`). Source is admin-supplied, so the realistic risk is a hostile or garbled source (teacher-guide boilerplate, "ignore previous instructions" in a scraped page) or a `</reference_material>` string closing the block. Mitigation in E3: strip angle-bracket tags from chunks, state in the system prompt that reference text is data, never instructions. |
| Tests | None for `src/lib/rag/*`, the upload route, the KG routes or `chunkText` (36 vitest files exist elsewhere; none match rag/kg/chunk/embed). |
| Quality | Chunk cut mid-sentence; no page/heading metadata; 0.3 threshold untuned. |
| Licence | Not stored, not shown (1.1). |

### 1.5 Verification plan for the RAG path (nearly free)

1. **Unit tests, $0** (vitest, no network): `chunkText` (empty, shorter than one chunk, exact boundary, overlap equals 200, trailing fragment dropped, never infinite loop); the new PDF-to-text function against a tiny fixture PDF (a 2-page, under 20 KB file generated once and committed) including an empty-text PDF returning a clear error; `retrieveContext` with `getEmbedding` mocked: null gives `[]`, RPC error gives `[]`, rows at 0.29 dropped and 0.31 kept, source title formatting; the tag-stripping and fencing helper; content-hash dedupe.
2. **One tiny paid run, about $0.0001:** embed a 5-page, 15,000-character sample = 15,000 / 1,600 = about 10 chunks x 450 tokens = 4,500 tokens x $0.02 per 1M = **$0.00009**. Then 5 tester queries at about 20 tokens each: under $0.00001.
3. **One real unit, about $0.001:** a 60-page unit of IM Grade 7 (150,000 characters, about 94 chunks, 42,000 tokens): **$0.0008**. Run the SimilarityTester with the concept's name and description as the query, exactly the string `retrieveContext` builds (`retrieve.ts:46-47`), and check that the top hits come from the right chapter with scores above 0.3. Check a deliberately unrelated query returns nothing above 0.3.
4. **Grounding proof, free:** the E3 preview shows the final `<reference_material>` block for a concept without any LLM call (one embedding, about $0.0000004). An admin reads it and judges whether it contains the facts the lesson should use.
5. **Grounding proof, paid, optional, owner approval:** clear the cached lesson for one concept, generate it once with RAG on and once with the chunks removed (or the domain filter pointing at an empty domain): two Sonnet lessons at about $0.056 each = about **$0.12** (ordinary lessons also generate images when played; do this from the admin preview or API without triggering segment visuals). Compare the two for the book's specific terms, examples and numbers; note that retrieval adds about 4 x 450 = 1,800 input tokens, about $0.004 per lesson.
6. **No-key behaviour:** run the unit test for `OPENAI_API_KEY` unset; confirm lesson still returns.

---

## Part 2. Sources

What the licences mean for a paid, or free-with-paid-later, product. **BY**: commercial use allowed; credit author, give the licence link, say if you changed it. **BY-SA**: same, and adaptations must be released under the same licence. **BY-NC / BY-NC-SA**: no commercial use, which is treated here as ruling out any product from a company or individual that sells or plans to sell, including a free tier that funds itself later. **BY-ND**: no adaptations. **Honest uncertainty on generated lessons:** whether an LLM lesson written with a book's text in its prompt is an "adaptation" is legally unsettled. For BY it does not matter (credit and keep commercial rights). For SA it matters: the safe reading is that the lessons would have to carry the same licence, which conflicts with a proprietary catalogue; for NC it is a breach regardless; for ND the chunks-to-lessons pipeline is almost certainly an adaptation. Where a rights holder wrote an explicit AI clause (OpenStax), that clause governs. Get written confirmation for each source relied on.

### 2.1 Verdict table

| Source | Subject, grade | Format | Licence (page read) | Use? |
|---|---|---|---|---|
| **Illustrative Mathematics 6-8** (original Open Up Resources edition, authored by IM) | Maths grades 6, 7, 8 (ratios, fractions, expressions, equations, functions, geometry, statistics; covers pre-algebra) | Student and teacher HTML on the IM site; PDF of each grade also published (exact current download URL UNCONFIRMED); per-grade volume large (hundreds of pages, mostly tasks) | **CC BY 4.0**. IM name and logo not licensed; some third-party images carry their own licences; Spanish-text images not CC BY. Footer text: "IM 6-8 Math was originally developed by Open Up Resources and authored by Illustrative Mathematics", licensed CC BY 4.0. https://im.kendallhunt.com/MS/students/1/index.html (footer read 2026-11-16); also https://www.openupresources.org/ | **Yes. Track 1.** Use the OER text, not Kendall Hunt, Amplify or McGraw-Hill editions (they add their own copyright). |
| **OpenSciEd middle school units** | Science 6-8, phenomenon-driven units (e.g. cells and systems, Earth's resources) | Free downloads on openscied.org; teacher and student editions, long (about 100s of pages per unit); exact unit list and PDF sizes UNCONFIRMED (the access page 404d when fetched) | **Middle school: CC BY 4.0. Elementary and high school: CC BY-NC** with a separate commercial licence. Attribution must credit source, link the licence, say if changed, and not imply endorsement. https://openscied.org/?p=111 (read 2026-11-16). A search hit shows an older "License Descriptions" document saying classroom materials are generally CC BY-NC: conflicting, so **get OpenSciEd's confirmation in writing for middle school before use**; also check that the commercial-licence document's AI-tool clause does not apply to MS units (UNCONFIRMED). | **Yes, with a written check. Track 2.** Pedagogy is a sequence of investigations, so concept KG should not be copied from unit order; use it as grounding. |
| **Siyavula** Natural Sciences Gr 4-9, Mathematics Gr 7-12 | South African CAPS curriculum; clear chapter structure, good for KG spine | PDF (learner book + teacher guide, English/Afrikaans) and ePUB | **Branded: CC BY-ND** (copy and share, no changes). **Unbranded: CC BY.** https://www.siyavula.com/read (read 2026-11-16). IT and CAT titles are closed copyright. | **Only the unbranded CC BY editions** (availability and download link UNCONFIRMED; ask Siyavula). Branded ND copies must not be chunked into lessons. |
| **Python documentation tutorial** (docs.python.org) | Python, adult-oriented prose but clear | Online HTML; PDF/EPUB downloads from the docs; about 150 pages | **PSF License 2** for documentation; code examples dual-licensed PSF-2 and Zero-Clause BSD (from 3.8.6). Retain the PSF copyright notice and licence text, summarise changes, no use of PSF trademarks to endorse. https://docs.python.org/3/license.html (read 2026-11-16) | **Yes. Track 3** as grounding for the existing 38-concept KG. |
| **CS Unplugged** (Univ. of Canterbury) | Computing without computers, ages 5-14 | Web pages, GitHub repo | **CC BY-SA 4.0** (page says "Attribution-ShareAlike"); commercial use is allowed by SA but adaptations must be SA. https://www.csunplugged.org/en/about/ | **Optional, hold.** ShareAlike would plausibly attach to generated lessons built on it. Use only if the owner is willing to license that track's lessons CC BY-SA, or skip. |
| **Wikibooks / Wikijunior** | Broad, uneven quality, children's science books | Web, PDF per book | **CC BY-SA** (Wikibooks; older books 3.0). https://en.wikibooks.org/wiki/Wikijunior | Skip for launch: ShareAlike plus uneven quality. |
| **LibreTexts K12** | Mixed | Web, PDF export | Licence is per page and book; one chem book read says CC BY 4.0; the K12 library's licence UNCONFIRMED. LibreTexts also mirrors OpenStax books, which are now NC-SA. | Skip unless a specific book is checked. |
| **OpenStax** (Prealgebra 2e, Elementary Algebra, etc.) | Maths, science, college and high-school level | PDF and web | **CC BY-NC-SA** (help centre and the Prealgebra 2e page, read 2026-11-16: https://help.openstax.org/s/article/Licensing-information-of-OpenStax-textbooks, https://openstax.org/books/prealgebra-2e/pages/index). The book page says it may not be used to train LLMs or **ingested into generative AI offerings** without prior written permission; the AI-tools help page allows AI use for noncommercial education only (https://help.openstax.org/0TO6f0000003F84GAE). Search results still show older "CC BY 4.0" statements on some preface pages: stale. | **No.** Rules out OpenStax for this pipeline unless OpenStax gives written permission. |
| **CK-12** | Maths, science, K-12 | FlexBooks, PDF | Older content CC BY-NC 3.0; current terms: CK-12's own Terms of Use and Curriculum Materials License, educational purposes only, help centre says you cannot use CK-12 content to make money without permission. https://help.ck12.org/hc/en-us/articles/53032403416219-Can-I-Use-CK-12-Content-to-Make-Money, https://help.ck12.org/hc/en-us/articles/51042851054235-CK-12-Terms-of-Use | **No.** Rules out all CK-12 content, including what T11 suggested. |
| **Khan Academy** | Maths, science | Videos, exercises | Own videos and exercises CC BY-NC-SA with attribution; partner content may carry other terms. https://support.khanacademy.org/hc/en-us/articles/202262954-Can-I-use-Khan-Academy-s-videos-name-materials-links- | **No.** |
| **EngageNY / Eureka Math** | Maths K-12 | PDF | CC BY-NC-SA 4.0 (Great Minds); the court cases only protected schools' use of printers. https://www.edweek.org/teaching-learning/fedex-targeted-in-open-educational-resources-lawsuit/2016/10 | **No.** |
| **Core Knowledge** (CKHG, CKSci) | History, geography, science K-8 | Free PDFs | CC BY-NC-SA 4.0 where marked; grades 6-8 science is OpenSciEd. https://www.coreknowledge.org (terms of use) | **No.** |
| **Code.org** | CS | Curriculum PDFs | CC BY-NC-SA 4.0, commercial use via a separate arrangement. https://code.org/commitment | **No.** |
| **Scratch / CS First** | Block coding | Cards, guides | Scratch user projects CC BY-SA 4.0; Scratch source AGPL-3.0; Scratch Foundation guide licences and CS First (Google) terms not found: UNCONFIRMED. https://scratch.mit.edu (terms) | Skip. |
| **Think Python 3e** (Downey) | Python | Web, PDF | Text **CC BY-NC-SA 4.0**, code MIT. https://allendowney.github.io/ThinkPython/chap00.html | **No** (text). |
| **Automate the Boring Stuff** (Sweigart) | Python | Web | **CC BY-NC-SA 3.0**. https://automatetheboringstuff.com/ | **No.** |
| **Experience AI** (Raspberry Pi Foundation) | AI literacy 11-14 | PDF, slides | CC BY-NC-ND 4.0 on the files seen; not confirmed for every lesson. https://experience-ai.org | **No** (NC and ND). |
| **Open Up Resources** other courses | Maths 6-8 (same as IM), others | | Same CC BY 4.0 as IM for 6-8 | Same as IM. |

### 2.2 Required attribution (templates; keep each as a row in `LICENSES.md` and in the app)

- **IM 6-8:** "Maths lessons are based on IM 6-8 Math, originally developed by Open Up Resources and authored by Illustrative Mathematics, licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Lessons were rewritten and shortened by Aristo AI; changes were made." Do not use the IM name or logo as a brand or endorsement.
- **OpenSciEd MS:** "Science lessons are based on OpenSciEd middle school units (https://www.openscied.org), licensed CC BY 4.0. Rewritten and shortened by Aristo AI. OpenSciEd does not endorse Aristo AI."
- **Siyavula (unbranded):** "Based on Siyavula Natural Sciences (CC BY 4.0), siyavula.com; adapted by Aristo AI." (confirm Siyavula's required wording with them.)
- **Python tutorial:** "Based on The Python Tutorial, Copyright 2001 and later Python Software Foundation, used under the PSF License Version 2. Adapted and simplified by Aristo AI." Keep a copy of the PSF licence text in the repo. Code snippets under Zero-Clause BSD need no credit.

### 2.3 Recommendation: the cleanest day-one tracks

1. **Maths 6-8** on IM Grades 6, 7, 8. Cleanest licence, the right age, strong task design, large enough for 3 grade-domains.
2. **Science 6-8** on OpenSciEd middle school units (6 units for launch) after written confirmation; add Siyavula unbranded Natural Sciences as the chapter spine if the owner can obtain the CC BY edition. If neither is confirmed, do not launch science from third-party text: the KG can still be generated and lessons run from model priors, exactly as Python's would without RAG.
3. **Python** on the official tutorial, grounding the existing KG. Cheapest track: KG exists, text small.
4. **Optional, not for day one:** computing and AI literacy: CS Unplugged only if the owner accepts CC BY-SA for that track; otherwise owner-authored outline with no RAG source.

---

## Part 3. Costed plan

### 3.1 Unit costs used (from `product-cost.md`, `src/lib/llm/pricing.ts`)

Embedding $0.02 per 1M tokens. Sonnet 5 $2 in / $10 out per 1M. Fresh lesson text $0.056 (worst $0.19 with retry), segment visuals 4 x $0.08 = $0.32, widget $0.06, quiz $0.018, 3D (single view) $0.30 plus teaching image $0.15 plus FLUX $0.003 for physical topics. Concept-topic lesson without TTS **$0.45**; physical-topic lesson with 3D **$0.85**. Narration 3,700 characters per lesson at r dollars per 1,000 characters; r is **not in the repo**: shown at $0.05 / $0.11 / $0.22 (product-cost ASSUMPTION), so $0.19 / $0.41 / $0.81 per lesson. Check the owner's real ElevenLabs plan before approving.

### 3.2 Embedding arithmetic

Chunks = characters / 1,600 (1,800 window minus 200 overlap). Tokens = chunks x 450. Cost = tokens x $0.02 / 1M. Per 1M characters: 625 chunks, 281,250 tokens, **$0.0056**. A page is about 2,500 characters of prose (maths and science pages with figures and tasks are lighter, so this is generous). Page counts below are estimates, not measured.

| Track | Scope ingested | Pages | Characters | Chunks | Tokens | Embed cost |
|---|---|---|---|---|---|---|
| Maths | IM 6, 7, 8, lesson text and teacher guidance, about 400 pages per grade | 1,200 | 3.0M | 1,875 | 844k | **$0.017** |
| Science | 6 OpenSciEd MS units, about 300 pages each | 1,800 | 4.5M | 2,813 | 1.27M | **$0.025** |
| Science (optional) | Siyavula Natural Sciences Gr 7-9, about 250 pages each | 750 | 1.9M | 1,170 | 527k | **$0.011** |
| Python | Python tutorial | 150 | 0.45M | 281 | 127k | **$0.003** |
| **Total** | | 3,900 | 9.85M | 6,139 | 2.77M | **$0.055** |

Embedding is a rounding error; the real costs are KG generation and lessons. Add per-lesson retrieval: one query embed (about 60 tokens) negligible, plus about 1,800 extra Sonnet input tokens = $0.0036 per fresh lesson.

### 3.3 KG generation arithmetic

A concept is about 200 output tokens. One Sonnet call (input = outline of about 5,000 tokens plus 3 to 4 sampled chunks per chapter about 3,000 tokens; output capped at 8,000 tokens, about 35 concepts): 8k x $10/M + 8k x $2/M = $0.080 + $0.016 = **$0.096 per call**.

- Maths: about 3 domains of about 30 concepts, or one of 90: 3 calls = **$0.29**; with 100 percent retry margin **$0.58**.
- Science: about 60 concepts (6 units x about 10): 2 calls = **$0.19**; margin $0.38.
- Python: already seeded (38 concepts): **$0**; if re-generated from the tutorial for review: 1 call **$0.10**.
- Course grouping: `from-kg` admin tool is free; CurriculumAgent per course about $0.03 (product-cost 2.4).
- Review time, not money, is the real cost: someone must read each KG and prune bad edges (T11 step 2a).

### 3.4 Pre-generated catalogue (16 lessons per track, pictures, cached audio)

Per lesson, no TTS: concept-topic $0.45. Narration: 16 x 3,700 = 59,200 characters. Excludes interactive widgets beyond the $0.06 in the $0.45.

| Track | Lessons | Generation arithmetic | Narration at r=0.05 / 0.11 / 0.22 | Total (low / mid / high) |
|---|---|---|---|---|
| Maths | 16 concept-topic | 16 x 0.45 = **$7.20** | 59.2 x r = $2.96 / $6.51 / $13.02 | **$10.2 / $13.7 / $20.2** |
| Science | 12 concept + 4 physical | 12 x 0.45 + 4 x 0.85 = 5.40 + 3.40 = **$8.80** | same | **$11.8 / $15.3 / $21.8** |
| Python | 16 concept | **$7.20** | same | **$10.2 / $13.7 / $20.2** |
| **Three tracks** | 48 | $23.20 | $8.9 / $19.5 / $39.0 | **$32.1 / $42.7 / $62.2** |
| Optional 4th (12 lessons) | 12 concept | 12 x 0.45 = $5.40 | 44.4 x r = $2.2 / $4.9 / $9.8 | $7.6 / $10.3 / $15.2 |

Margins: retry on lesson text adds up to ($0.19 - $0.056) x 48 = $6.4 worst case; plan **+20 percent** on the mid figure: $42.7 x 1.2 = **about $51**; add KG and embeddings $1.3 for **about $53 total**. This is also where `product-cost.md` A10 and B1 apply: audio caching and the cached quiz ($0.018 per concept, one-off) are engineering prerequisites for narration to be pre-rendered, not a cost to repeat per learner. If the pre-rendered audio path is not built, the catalogue's pictures and text still cache (L2 asset cache and `cached_lessons`), but each learner replay pays narration again.

### 3.5 Option comparison per track

| Track | Minimum viable (KG + RAG only; lessons generate on first use inside the free allowance) | Pre-generated catalogue of 16 |
|---|---|---|
| Maths | embed $0.017 + KG $0.29 to $0.58 = **about $0.31 to $0.60**. Every learner's first miss is paid by the owner: about $0.31 (reduced Design 1 lesson, product-cost 2.6) to $0.45 plus narration. | $0.31 to 0.60 + $13.7 (range $10.2 to $20.2) = **about $14** |
| Science | $0.025 (+$0.011) + $0.19 to $0.38 = **about $0.23 to $0.42** | $0.4 + $15.3 (range $11.8 to $21.8) = **about $16** |
| Python | $0.003 = **about $0** (KG seeded) | $13.7 (range $10.2 to $20.2) = **about $14** |
| **All three** | **about $0.55 to $1.0** | **about $44 (range $33 to $63; $53 with 20 percent margin)** |

Recommendation: minimum viable for all three tracks now (about $1, the RAG path gets exercised as asked), then the catalogue for the one track the owner sees traction on, because uncached first-use cost for a free user is about $0.3 to $0.5 per lesson and an uncapped launch is the larger risk (product-cost A2, A3).

### 3.6 What is not in these numbers

ElevenLabs real price (r), Supabase storage and egress for cached images and audio, Vercel, translation or Spanish, any review labour, and Tripo 3D beyond the 4 science lessons assumed.

---

## Part 4. Engineering briefs (in order; each executable by a cheaper model)

Rules for all: tests with vitest; no paid call without the owner's approval; Zod on every external input; no hardcoded model strings; yarn only; no emoji; do not edit code outside the brief.

**E1. Browser PDF extraction and batch upload client** (paid run: no)
- Files: `src/app/admin/rag/_components/UploadDialog.tsx`; new `src/lib/rag/pdfText.ts` (pdfjs-dist, lazy imported, worker from the package); `package.json` (add `pdfjs-dist`, yarn).
- Do: accept `.pdf`; extract text per page in the browser; drop repeated headers and footers (lines occurring on over 40 percent of pages); keep page numbers per chunk; reject files that yield under 200 characters per page on average with "this PDF has no text layer (scanned); OCR not supported"; show progress and a cost estimate (characters / 1,600 x 450 tokens x $0.02 / 1M) with a confirm button before sending. Never send the PDF to the server.
- Done when: a 5-page fixture PDF yields correct text in a unit test (`pdfText.test.ts`); a 120 MB PDF can be selected without a network request until the user confirms; the estimate is shown.

**E2. Batched ingest API, source registry, dedupe, delete by source** (paid run: yes, tiny; $0.0001 to $0.001)
- Files: new migration `019_content_sources.sql` (table `content_sources`: id uuid, title, author, licence_name, licence_url, source_url, attribution_text, share_alike boolean, notes, created_at; add `reference_chunks.source_id uuid references content_sources on delete cascade`, `content_hash text`, `page_start int`, `page_end int`, `unique (source_id, content_hash)`); rewrite `src/app/api/admin/rag/upload/route.ts` to take `{ domain, source_id, chunks:[{text,page}] }` with Zod and at most 50 chunks per request; try/catch with per-chunk errors; tag embeddings `rag.embed.ingest` with `userId`; new `DELETE /api/admin/rag/sources/[id]`; list route returns sources; delete `src/app/api/kg/ingest/route.ts` (RLS-broken duplicate) and fix `T11-content-seeding.md` references; `chunkText` becomes paragraph and heading aware (split on blank lines, keep headings with the text that follows; keep 1,800 and 200 as defaults) with tests.
- Done when: re-uploading the same file inserts 0 new chunks; deleting a source removes its chunks; a 429 mid-batch leaves earlier batches stored and returns which failed; domain validated as `^[a-z0-9_]{3,100}$`; tests pass; the migration is applied by the owner in the SQL editor and `LICENSES.md` has a "Reference corpora" section stub.
- Paid run: ingest the 5-page sample, then one 60-page IM unit; record tokens and dollars from `usage_events` (expect $0.00009 and $0.0008).

**E3. Free grounding preview, prompt hardening, cache invalidation** (paid run: no, one embedding of a query)
- Files: new `POST /api/admin/rag/preview` (input `{ conceptId }`; loads the concept, calls `retrieveContext`, then the exact `buildUserMessage` text from `src/lib/agents/teaching.ts` exported for this purpose, returns the `<reference_material>` block, scores, and the number of chunks dropped by the 0.3 cut-off; no LLM call); a "Preview for concept" panel in `SimilarityTester.tsx`; `src/lib/rag/retrieve.ts`: return structured `{content, source_id, source_title, similarity}`, strip `<` and `>` tags from chunk content, wrap each chunk with a delimiter; add one line to the teaching system prompt (`teaching.ts:~198`) that reference text is untrusted data; make threshold and top-k named constants; new admin action "invalidate cached lessons for domain" using the existing lesson-cache admin route.
- Done when: unit tests for no key, RPC error, threshold, tag stripping pass; the preview for a seeded Python concept shows its tutorial chunks; ingesting a source then invalidating the domain makes the next lesson miss and retrieve.
- Paid run: none required; optional A/B of two lessons, about $0.12, only with the owner's yes.

**E4. Table of contents to KG, grounded** (paid run: yes, $0.10 to $0.58 per track, approval first)
- Files: new `src/app/api/admin/kg/from-source/route.ts`; new `src/lib/kg/fromSource.ts`; UI button in `src/app/admin/knowledge-graph/page.tsx` (next to Generate); migration `020_concept_grade.sql` adding `concepts.grade_band text` and `concepts.source_id uuid` (nullable).
- Do: input `{ domain, source_id, grade_band }`; read the source's chunks' headings (E2 keeps them) to build an outline; call Anthropic with `MODELS.teaching`, a **tool_use** strict schema (not regex parsing), output split in calls of at most 35 concepts per chapter group; require prerequisites to be ids inside the output; server-side validation of ids, cycle check with `validateGraph`, difficulty tied to grade band; return for review, do not commit; log usage with `feature "kg.from_source"` and the admin id; show estimated cost before the call.
- Done when: a unit test with a mocked client produces a valid DAG; a truncated or invalid response returns an error not a 500; the admin reviews and commits through the existing `/api/kg/concepts`.
- Also fix `kg/generate/[domain]` to use tool_use and a 4-chunk output loop (same brief, small).

**E5. Subjects from the database, not hardcoded** (paid run: no)
- Files: `src/components/onboarding/OnboardingView.tsx` (lines 47-50), new `GET /api/domains` returning distinct `domain` of published courses with title and concept count; `src/app/api/auth/onboarding/route.ts` (Zod; reject domains with no published course); `src/components/learn/ModePicker.tsx` (default domain from progress, not `python_programming`).
- Done when: onboarding lists exactly the published domains; an unseeded `middle_school_science` can no longer be chosen; a test covers the Zod rejection. This also covers launch brief A7.

**E6. Learner-facing attribution, `/credits`, `LICENSES.md`** (paid run: no)
- Files: new `src/components/learn/ContentCredit.tsx` modelled on `AvatarCredit.tsx`; lesson payload route returns the credit list for the chunks actually used (`source_id` to `content_sources`) alongside the lesson, and the credit is cached with the lesson (`cached_lessons.payload`); render it in the lesson panel footer and on the quiz/review screens that derive from the lesson; new `src/app/credits/page.tsx` listing every source with title, author, licence name and link, and "changes were made"; link it from the landing footer (`src/components/landing/SiteFooter.tsx`); new "Reference corpora" section in `LICENSES.md` with a row per source (author, licence, licence page URL, access date, whether adapted, share-alike flag, open items such as "OpenSciEd written confirmation").
- Done when: a lesson whose chunks came from source X shows X's attribution text; a lesson with no chunks shows none; the page lists all sources; `LICENSES.md` rows have the URLs from Part 2.

**E7. Content runs (owner approves every spend)**
1. Owner obtains source files (IM 6-8 OER PDFs or HTML export, OpenSciEd MS units, Python tutorial PDF) and the written confirmations listed below. No generation yet.
2. Ingest per track (E2); record tokens and dollars. Expected total $0.06.
3. KG per track (E4), then human review of concepts and edges in `/admin/knowledge-graph`, then `from-kg` course, publish.
4. Check retrieval with E3 on 5 concepts per track; tune the 0.3 threshold.
5. Optional catalogue: only after the entitlement/cap work (launch briefs L04 and A2-A4) exists, and after the audio cache (B1) if narration is to be pre-rendered; reuse `scripts/generate-demo-content.ts` and `scripts/prerender-demo-tts.mjs` as the pattern. Cost per track is in 3.4.

### Owner actions before any ingest

- Ask OpenSciEd in writing: middle school units are CC BY 4.0; does that include ingestion into an AI tutoring product; confirm the attribution wording.
- Ask Siyavula whether unbranded CC BY editions are available as ePUB/PDF and how they want attribution.
- Decide the ShareAlike stance (skip BY-SA sources unless the owner accepts releasing those lessons under BY-SA).
- Confirm the real ElevenLabs rate and plan (every narration dollar in 3.4 is r times characters).
- Take legal advice on commercial use of CC BY content for children and on the attribution placement.
- Apply migration 018 (still unapplied in production) before anything else, per state.md.

---

## Open questions the code and web could not settle

1. Exact current PDF download links and sizes for IM 6-8 and OpenSciEd MS units (OpenSciEd access page returned 404; IM page confirmed licence only).
2. Whether Siyavula's unbranded CC BY files exist for Natural Sciences 7-9 as downloads.
3. Whether OpenSciEd's commercial licence AI clause applies to MS units.
4. Production KG contents (Supabase MCP was down): whether any `middle_school_science` concepts exist.
5. OpenAI embedding tier limits for the account.
6. Measured embedding throughput; the 500 to 600 chunk ceiling in 1.4 is an estimate.
