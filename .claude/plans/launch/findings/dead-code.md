# Dead code and leftovers audit (pre-launch)

Audit date 2026-11-16, branch `fix/classroom-ux` (461eec8), Next 15.5.15. Read-only: nothing in the repo was changed except this file.

Method: `tsc`, `next lint`, `vitest` run for real; my own import-graph script (resolves `@/`, relative, `next/dynamic`, `require`; entry points = `pages/**`, App Router special files, `middleware.ts`) because `knip` crashed on this machine (missing oxc native binding on Node 22.1); `depcheck` for the dependency pass; every "unused" claim then cross-checked with repo-wide greps for file name, export name and string paths. Confidence: **certain** = no reference anywhere (code, scripts, strings, docs); **likely** = no runtime reference but a plausible owner intent; **needs owner** = product decision.

## Summary

Health: `yarn type-check` clean (0 errors), `yarn test` 37 files / 702 tests pass, `yarn lint` 0 errors / 10 warnings (all old). No `console.log`, no TODO/FIXME/HACK, no `@ts-ignore`, no commented-out code blocks in shipped code. The tree is in good shape; what is left is mostly dead dependencies, one dead UI layer, archived assets, and git/branch/doc sprawl.

Estimated wins

| Win | Amount | Note |
|---|---|---|
| Deploy artifact (`public/`) | about 27 MB of 60 MB (45%) | archived Ryan/Sonia/Marcus/Priya GLBs + their anim packs 26.4 MB, `dev_placeholder.glb` 0.12 MB, 3 tiny files. Users never download these today (nothing offers them), so this is deploy size and repo weight, not page speed. |
| Optional extra | about 3 MB + 0.5 MB | demo PNGs to WebP (4.4 MB of PNG/JPG in `public/demo`), `draco_decoder.js` (fallback decoder, see table 3) |
| Packages | 8 certain, up to 17 | 8 unreferenced (`@google/generative-ai`, `leva`, `react-responsive-carousel`, `react-scroll`, `react-intersection-observer`, `react-hot-toast`, `@tanstack/react-table`, `@tabler/icons-react`); 8 more become unused once the dead shadcn wrappers go (`cmdk` + 7 radix); `@avaturn/sdk` only if `/create-teacher` is cut. Install-time/lockfile win only (`@tabler/icons-react` alone is 64 MB in node_modules); none of these reach the client bundle today. |
| Source files | 16 files under `src/` (about 36 KB) + about 14 dead exports + about 6 dead store members | |
| Git | 16.8 MB tracked `.claude/eval` (3721 files), 11.7 MB tracked `scripts/y_bot_animations/*.fbx`; pack is 777 MB (history, matters if the repo goes public) | disk: `.claude/eval` 11 GB, `.claude/worktrees` 6.9 GB, `assets-src` 133 MB (all untracked/ignored) |
| Branches | 33 local + 31 remote branches already merged into `origin/deploy-prep` | 3 unmerged need a decision |

Most important findings for launch (not just tidiness)

1. `POST /api/quiz`, `POST /api/whisper`, `GET /api/openai-tts` have **no auth at all** and spend money (Anthropic Haiku / OpenAI Whisper / OpenAI TTS). Nothing in the app calls any of them. The middleware matcher covers `/api/*` but only redirects `/learn`, `/admin`, `/pending`. Anyone on the internet can burn the keys. Delete (or put behind `verifyApproved`) before launch.
2. `ignoreBuildErrors: true` is **still needed** on Next 15.5.15 (details in table 6).
3. `uuid` and `three-stdlib` are imported but not declared in `package.json` (only transitive). A dependency bump can silently break the build.
4. `README.md` is a 3-line placeholder ("Something is coming Stay Tuned :D" plus a stray code fence). `CLAUDE.md` points at `spec_index.md`, which does not exist at the repo root.
5. `.claude/settings.local.json` is tracked in git (and modified). It should be ignored.

---

## 1. Dependencies

| Item | Evidence | Confidence | Proposed action | Risk |
|---|---|---|---|---|
| `@google/generative-ai` | zero imports in `src`, `pages`, `scripts`; `.env.example` says "installed but unwired"; `GOOGLE_AI_KEY` is read nowhere | certain | remove dep; drop `GOOGLE_AI_KEY` from `.env.example` and `DEPLOY.md` table | none |
| `leva` | zero imports (grep hits were the word "level") | certain | remove | none |
| `react-responsive-carousel` | zero imports | certain | remove | none |
| `react-scroll` | zero imports (grep hit was `react-scroll-area`) | certain | remove | none |
| `react-intersection-observer` | zero imports | certain | remove | none |
| `react-hot-toast` | only a comment in `src/hooks/use-toast.ts` ("Inspired by react-hot-toast"); zero imports | certain | remove | none |
| `@tanstack/react-table` | zero imports (admin tables are hand-built / `ui/table.tsx`) | certain | remove | none |
| `@tabler/icons-react` | zero imports; `lucide-react` is the icon lib (61 files). 64 MB in node_modules | certain | remove | none |
| `@radix-ui/react-toast` plus `src/hooks/use-toast.ts`, `ui/toast.tsx`, `ui/toaster.tsx` | `Toaster` is never mounted (not in `_app.tsx` or any layout); `useToast`/`toast` have no callers. Two toast systems declared (radix and react-hot-toast), neither used | certain | delete the three files, remove dep | none |
| `cmdk` | only `ui/command.tsx`, which nothing imports | certain | delete `command.tsx`, remove dep | none |
| `@radix-ui/react-dropdown-menu`, `-popover`, `-progress`, `-scroll-area`, `-separator`, `-tooltip` | each is imported only by its own `src/components/ui/*.tsx` wrapper, and those wrappers are unreachable (table 2) | certain | delete wrappers, remove the 6 deps | none |
| `@avaturn/sdk` | single use: `src/app/create-teacher/CreateTeacherClient.tsx` (lazy SDK for the "Create yours" teacher editor, needs `NEXT_PUBLIC_AVATURN_SUBDOMAIN`) | needs owner | keep if "Create yours" ships at launch; remove with the whole feature otherwise (table 2) | low |
| `openai` | used by `src/lib/llm/openai.ts` (RAG embeddings, live) plus the two dead routes | certain: KEEP | keep | none |
| `acorn` | used by `src/lib/interactive/guard.ts` (widget sandbox) | certain: KEEP | keep | none |
| `recharts`, `@xyflow/react` | used by admin pages (`admin/cost`, `courses/[id]`, `quiz-analytics`, `KgGraph`) | certain: KEEP | keep (admin-only chunks) | none |
| `uuid` (undeclared) | imported in `src/lib/agents/assessment.ts`; `package.json` has only `@types/uuid`; resolved via a transitive `uuid@^9`/`uuid@*` in `yarn.lock` | certain | either `crypto.randomUUID()` (Node 20+, already the engine floor) and remove `@types/uuid`, or declare `uuid` | low |
| `three-stdlib` (undeclared) | imported in `src/components/three/Teacher.tsx` (`SkeletonUtils`); only transitive via drei | certain | declare it, or import `SkeletonUtils` from `three/examples/jsm/utils/SkeletonUtils.js` | low |
| `@gltf-transform/cli` (dev) | no import; used by CLI (`scripts/room/README.md` runs `yarn gltf-transform ...`) | likely | keep (asset tooling) | none |
| `autoprefixer`, `postcss`, `tailwindcss` (dev) | depcheck false positives: used by `postcss.config.js`/`tailwind.config.js` | certain: KEEP | keep | none |
| `dotenv` (dev), `sharp` | `dotenv` used by 6 scripts; `sharp` by `opengraph-image.tsx` and `scripts/brand/og-still.mjs` | certain: KEEP | keep | none |
| `npx tsx` | scripts say `npx tsx scripts/...`, but `tsx` is not a devDependency | likely | add `tsx` as a devDependency or document | none |
| Duplicates doing one job | toast: radix vs react-hot-toast (both dead). Charts: `recharts` live, and `src/app/admin/GoogleCharts.jsx` (loads Google Charts from gstatic, dead). Icons: lucide live, tabler dead. Fonts/cn: `src/utils/cn.js` duplicates `src/lib/utils.ts` (dead copy) | certain | covered by rows above and in table 2 | none |
| `framer-motion` | only 2 files (`LoadingScreenVisual`, `SceneLoadingOverlay`) on the `/learn` path, about 2.8 MB installed | needs owner | optional: replace with CSS to drop the client chunk | medium (visual regression) |

## 2. Source files, exports, routes

Unreachable from any entry point (graph script, then grep-checked; no string/dynamic references):

| Item | Evidence | Confidence | Proposed action | Risk |
|---|---|---|---|---|
| `src/components/ui/{badge,card,command,dropdown-menu,popover,progress,scroll-area,separator,skeleton,toast,toaster,tooltip}.tsx` (12 shadcn wrappers, about 27 KB) | no importer anywhere. The other 8 shadcn wrappers (button, dialog, input, label, select, sheet, table, tabs) are live | certain | delete the 12 | none |
| `src/hooks/use-toast.ts` | only imported by dead `toaster.tsx`/`toast.tsx` | certain | delete | none |
| `src/utils/cn.js` | `@/utils/cn` imported nowhere; `src/lib/utils.ts` is the real `cn` | certain | delete | none |
| `src/utils/modelLoader.js` | imported nowhere; carries 2 of the 10 lint warnings (conditional hooks); still lists `classroom_alternative.glb`. `useModelLoader`/`preloadModels` unused | certain | delete (also clears the lint "worst offender" the `.eslintrc.json` comment names) | none |
| `src/app/admin/GoogleCharts.jsx` | imported nowhere | certain | delete | none |
| `jsconfig.json` | redundant: `tsconfig.json` has the same `@/*` paths and `allowJs` | certain | delete | none |
| Dead exports: `ADMIN_NAV_SECTIONS` (admin/SidebarNav), `Shape` (landing/intro/timeline), `Shot` (landing/stage/room), `getDemoTopic` (data/demo/index), `verifyApproved` (lib/auth/approval; the guard `requireApproved` is the live one), `BrandColor` type, `getAvailableConcepts`/`getLearningPath`/`getConceptWithContext` (lib/kg/graph.ts), `EMBEDDING_MODEL`/`EMBEDDING_DIMS` (lib/llm/openai.ts) | no reference outside the defining file (names grep-checked repo-wide, scripts included). `verifyApproved` and the 3 kg functions are described in `TECHNICAL_SUMMARY.md` | certain (verifyApproved: likely, it is the documented guard primitive) | delete the unused functions/types; keep `verifyApproved` only if `requireApproved` is built on it | low |
| Exports used only by tests: `mapStory` (`stateAt`, `dayAt`, `routeTo`, `pulseAt`, `NEWEST`), `sheetFraming.DESK_TOP`, `CLIPS_BY_ID`, `PREREQ_THRESHOLD`, `selectNextDifficulty` | prod code does not use them | likely | leave, or un-export; test-only API is a legitimate choice | none |
| About 249 other exports used only inside their own file (`dropdown-menu.tsx` 15, `director.ts` 12, `face.ts` 11, ...) | export noise, not dead code | likely | ignore for launch | none |
| Store `src/store/useAristoStore.ts`: legacy `quiz` slice (`QuizState`, `MCQQuestion`, `startQuiz`, `answerQuestion`, `finishQuiz`; only `clearQuiz` is called, by two callers), `profile`/`setProfile`, `masteryByConcept`/`setMasteryByConcept`/`updateConceptMastery`, `currentConceptId`/`setCurrentConceptId` (persisted to sessionStorage but never set), `currentAudio`/`setCurrentAudio` | zero references outside the store file (grep by name, whole word, src/pages/scripts). Current quiz state lives in `activeQuiz`/`quizResult` | certain for the quiz slice and the 4 member groups; remove `clearQuiz` calls with it | remove members; drop `currentConceptId` from `partialize` | low (sessionStorage shape changes; `merge` already tolerates missing keys) |
| `src/app/api/quiz/route.ts` (legacy `/api/quiz`, feature tag `quiz.legacy`, uses `learningStyle`) | no caller (`fetch("/api/quiz")` appears nowhere; live quiz routes are `/api/quiz/lesson`, `/submit`, `/complete`, `/review`). **No auth, no zod**, spends Haiku tokens | certain | delete | none (security win) |
| `src/app/api/whisper/route.js`, `src/app/api/openai-tts/route.js` | no caller (STT/TTS use the Web Speech API and `/api/tts`). Both are **unauthenticated** public endpoints on the owner's `OPENAI_API_KEY`; whisper reads the whole upload with no size cap. CLAUDE.md says "leave in place" | needs owner (certain they are unused) | cost of keeping: 2 public endpoints, 2 legacy `.js` files, `openai` dep path. Minimum action: add `verifyApproved()` + size cap + zod, or move to a branch until Whisper is actually wired | low |
| `src/app/api/kg/ingest/route.ts` | no caller; superseded by `/api/admin/rag/upload` which the admin UI uses. Admin-only, so not a security issue | likely | delete | low |
| `src/app/api/profile/mastery/route.ts` | no caller anywhere | likely | delete | low |
| `src/app/api/admin/cost/events/route.ts` | no caller (admin cost page only calls `/summary`) | likely | delete, or wire to a table | low |
| `src/app/aristo/page.tsx` | 8-line redirect to `/learn`; the comment says "Old aristo route". Nothing links to it | likely | delete; if old bookmarks matter, use `redirects()` in `next.config.mjs` | none |
| `src/app/create-teacher/**` (`/create-teacher`), `/api/profile/custom-teacher`, migration 011 `custom_teacher_glb_url`, `custom` teacher in store/Teacher.tsx, `animations_Avaturn.glb` (1.9 MB), `@avaturn/sdk` | **Live and linked** from the "Create yours" button in `TeacherControls.tsx`. Without `NEXT_PUBLIC_AVATURN_SUBDOMAIN` the page shows developer setup text ("Set NEXT_PUBLIC_AVATURN_SUBDOMAIN...") to a public user; the link also trips 2 lint warnings (`<a>` not `<Link>`). CLAUDE.md names Jake and MJ as the offered teachers | needs owner | decide: ship (set the env var in prod and test it) or hide the button and cut the whole vertical | medium |
| `src/app/hx/**` (45 KB `mocks.ts`, admin harness) | **untracked** (in `.git/info/exclude`), local only; route 404s in production; not in git, so not on Vercel | certain | none for launch (it is already not shipped) | none |
| `pages/dev/{app-pages,learn-shell,quiz-bars}.tsx` | also untracked (`.git/info/exclude`), local only | certain | none | none |
| `pages/dev/{avatar-lab,desk-quiz,free-model,interactive}.tsx` + `src/components/dev/*` (7 files, 66 KB) | tracked; each returns a body "404" with **HTTP 200** when `NODE_ENV=production` (not a real 404; they are still built and routable). `/dev/interactive` even has a CSP header entry in `next.config.mjs` | likely | for launch: `getServerSideProps` returning `notFound: true` (or delete the routes from the deployed tree). Keep the harnesses in dev if the owner still uses them; Pages Router is required for R3F | low |
| `src/lib/…/learningStyle` leftovers | `FSLSM`/`learningStyle` still in `api/admin/analytics/route.ts`, `api/quiz/route.ts` (dead), `components/learn/InputBox.tsx` | likely | rename/remove when touching those files (CLAUDE.md: FSLSM rejected) | low |
| Legacy lesson path behind `NEXT_PUBLIC_ADAPTIVE_VISUALS` | `MessagePanel.tsx` picks `LessonPlayer` only when the flag is exactly `"true"`, else the standalone `LessonView`; `teaching.ts` (`isAdaptive`) has a whole second prompt + tool (`SYSTEM_PROMPT`, `lessonTool`) for the off state. The flag is `true` in `.env.example`/`DEPLOY.md`, but **defaults to off if unset**, so a fresh Vercel project silently gets the old lessons without a demo-like experience | needs owner | confirm prod has `true`; then make adaptive unconditional and delete the legacy branch and prompt (about 200+ lines), the flag and `.env.example` line | medium (core path; needs a lesson smoke test) |
| `NEXT_PUBLIC_INTERACTIVE_VISUALS` | off by default, a deliberate kill switch (CLAUDE.md) | certain: KEEP | keep; confirm the prod value | none |

## 3. Assets in `public/` (60.2 MB, 205 files)

Loadable by a user today (offered or fetched by code): `Teacher_Jake.glb` 2.25 MB + `Teacher_Jake_clips.glb` 0.72; `Teacher_MJ.glb` 1.73 + `Teacher_MJ_clips.glb` 0.73; classrooms `classroom_default.glb` 1.00 (preloaded, also prefetched on `/sign-in`) and `classroom_alternative.glb` 0.66 ("Evening" in the picker); `animations_Avaturn.glb` 1.88 (only the `custom` teacher uses it now); landing `heart.glb` 0.59, `brain.glb` 0.51, 2 webp pictures, voice mp3s 0.5 MB; `/demo` 22 MB (below); `draco/*`; `images/landing/v3b/*`, `images/og/room.jpg`.

| Item | Evidence | Confidence | Proposed action | Risk |
|---|---|---|---|---|
| `models/Teacher_Priya.glb` 9.39 MB, `Teacher_Marcus.glb` 9.18 MB, `Teacher_Sonia.glb` 5.00 MB, `Teacher_Ryan.glb` 1.89 MB, `animations_Ryan.glb` 0.46 MB, `animations_Sonia.glb` 0.48 MB (total 26.4 MB) | only reachable through `AVATAR_ASSETS` (kept on purpose); `isOfferedTeacher` blocks selection and `merge` rewrites a persisted archived choice to Jake; `TeacherControls` offers only Jake and MJ. Not preloaded, not fetched. Cost of keeping: 26.4 MB in every deploy, in git (history also holds 13.5 MB uncompressed Marcus/Priya, 35 MB old `classroom_alternative.glb`) | needs owner (kept per CLAUDE.md) | decision: move the 6 files out of `public/` (assets-src or a Git LFS/release asset), keep the `AVATAR_ASSETS` config entries so re-enabling is a copy-back. Remove entries from `AvatarLab`'s picker if it lists them | low |
| `models/dev_placeholder.glb` 0.12 MB | only used by `components/dev/FreeModelPreview.tsx` (dev harness) | certain | keep with the harness or delete with it | none |
| `public/next.svg` 1.4 KB, `public/vercel.svg` 0.6 KB | create-next-app leftovers; zero references | certain | delete | none |
| `demo/heart/source.jpg` 15 KB | only named in a comment (`shaders.ts`); `SOURCE_URL` points at `teaching.jpg` | certain | delete | none |
| `public/brand/aristo-{column,column-16,wordmark}-{dark,light}.svg` (6 files, 8 KB) | no `/brand/...` URL anywhere in `src`, `pages`, `scripts`; brand paths are inlined from `markPaths` | likely | keep if they are the press/brand kit, otherwise delete | none |
| `public/draco/draco_decoder.js` 0.49 MB | the WASM decoder (`draco_decoder.wasm`, `draco_wasm_wrapper.js`) is what `useGLTF.setDecoderPath("/draco/")` uses on every modern browser; the JS file is the no-WASM fallback | needs owner | keep (safe) or drop for 0.5 MB if non-WASM browsers are out of scope | low |
| `public/demo/**` 22 MB | played by `/demo` (4 topics: volcano-eruption, heart, brain, steepness-speed; Jake narration only: 61 mp3 13.5 MB, 4.4 MB of PNG/JPG, 2 GLBs 3.1 MB, align json). All referenced from `src/data/demo/*.ts` or `DemoClient`. No unused topic dirs. The 4 images over 0.75 MB (`brain/seg_004`, `volcano-eruption/seg_004`+`seg_008`, `steepness-speed/seg_014`) total 3.7 MB | certain: KEEP; oversize is optional | convert the big PNGs to WebP (about 3 MB saved) and update the 4 `imageUrl`s in `src/data/demo/*.ts` | low |
| `assets-src/` 133 MB | git-ignored (`/assets-src/` in `.gitignore`), **not tracked**, not deployed. Fine as is. History still contains earlier uncompressed copies (pack 777 MB) | certain | none for the tree; only consider `git filter-repo` if the repo goes public and clone size matters | high if history is rewritten (do not without owner) |

## 4. Repo-level leftovers

| Item | Evidence | Confidence | Proposed action | Risk |
|---|---|---|---|---|
| `README.md` | 3 lines, last touched 2024-05-04: "Aristo AI is here! Something is coming Stay Tuned :D" plus a stray code fence | certain | rewrite for launch (what it is, stack, run, link to `DEPLOY.md`/`LICENSES.md`) | none |
| `TECHNICAL_SUMMARY.md` (13 KB, 2026-07-12) | stale: says Sonnet 4.6 (`models.ts` is `claude-sonnet-5`), TripoSR (now Tripo3D v2.5), Ryan/Sonia/Marcus/Priya (now Jake/MJ), no V8/V9/V10, mentions `verifyApproved`-era middleware gate | certain | refresh or fold into `.claude/docs/architecture.md` and delete | none |
| `DEPLOY.md` (2026-05-20) | stale: first-deploy runbook; lists unused `GOOGLE_AI_KEY`, says "push the `deploy-prep` branch", names a personal email, omits `NEXT_PUBLIC_INTERACTIVE_VISUALS`, `ELEVENLABS_PLAN`, `TTS_TIMESTAMPS` | certain | refresh before launch; remove the personal email | none |
| `AI_TEACHER_APP_SPEC.md` (2026-04-15, 62 KB) | CLAUDE.md calls it authoritative ("supersedes this file"), yet it never mentions Jake, MJ, Tripo3D, Night Class, V10 widgets; still has FSLSM. `.vercelignore` excludes it | needs owner | mark as the original spec (banner "historical, see architecture.md") or update; do not let it override reality at launch | none |
| `spec_index.md` | CLAUDE.md says "consult `spec_index.md`" but the file does not exist in the repo (it only exists in auto-memory) | certain | add it or fix the CLAUDE.md pointer | none |
| `docs/archive/` (2 files, 41 KB) | already archived one-offs (`ADAPTIVE_VISUAL_AID_PLAN.md`, `design-prompt.md`) | likely | delete or leave; harmless | none |
| `.vercelignore` | lists `ADAPTIVE_VISUAL_AID_PLAN.md`, `HANDOFF_DESK_QUIZ.md`, `design-prompt.md` at root, which no longer exist there. Does not list `assets-src/`, `docs/`, `.github/` (irrelevant for git-integration deploys, matters for `vercel deploy` CLI) | certain | prune stale lines | none |
| `tsconfig.tsbuildinfo` | exists locally (400 KB) but **not tracked** (`*.tsbuildinfo` ignored); `next-env.d.ts` also ignored | certain | none | none |
| `tsconfig.seed.json` + `supabase/seeds/python_intro.ts` (892 lines) | no script in `package.json`, no doc mentions the seed command; `T11` (content seeding) is still open | needs owner | keep until content seeding is settled; add a `seed` script or document how to run it | none |
| `scripts/` (12 MB) | no broken imports or missing `public/...`/`.claude/...` path references found (checked by script). `scripts/y_bot_animations/*.fbx` is 11.7 MB tracked, used only by `build_avaturn_animations.py` which only builds the `animations_Avaturn.glb` already shipped. `download-avaturn.ts` is for the archived Marcus/Priya flow | likely | move the FBX sources to `assets-src/` (ignored) if the Avaturn pack is not rebuilt; keep the scripts | low |
| `.claude/settings.local.json` | **tracked and modified**; local settings should not be in git | certain | `git rm --cached`, add to `.gitignore` | none |
| `.claude/2026-10-14-jake-sleeves/landing/` | stray empty dir outside `eval/` (ignored by git, not tracked) | certain | delete | none |
| `.claude/eval/` | 11 GB on disk (3.5 GB `2026-09-18-v9-bakeoff`, 3.0 GB `2026-10-16-portfolio`, 2.4 GB `2026-10-07-portfolio`, 958 MB `2026-09-30-v8-3b-landing`, ...), but per-dir `.gitignore`s keep the heavy parts out: **16.8 MB / 3721 files are tracked** (jpg 2510, png 251, webp 400, cjs 199). Two new untracked dirs: `2026-10-16-portfolio/` (3.0 GB), `2026-10-26-ux-fixes/` (73 MB). `.vercelignore` already excludes `.claude/` from deploys | certain | the tracked 16.8 MB is the only part in git; decide whether evidence screenshots belong in a public repo (see also `src/**` paths in them). Local 11 GB can be pruned or archived off-disk | low |
| `.claude/worktrees/` | 6.9 GB; 2 registered worktrees (`fix/intro-skip-contrast`, `dev/v8-tokens`), both branches merged | certain | `git worktree remove` both, then delete branches | none |
| `.claude/docs/state.md` | 1880 lines (about 150 KB); the global rule says compact, resume-in-minimal-tokens | certain | keep the top 5 entries, move the rest to `.claude/docs/archive/state-2026-07..10.md` | none |
| `.claude/plans/` (47 tracked files, 608 KB) | see table below | | | |
| `.github/workflows/ci.yml` | runs type-check, lint, test, build; fine. `yarn lint` uses the deprecated `next lint` (removed in Next 16) | certain | later: migrate to the ESLint CLI codemod | none |

Plans (`.claude/plans/`), classified from `README.md` checklist plus `state.md` history (README checklist is itself stale: V8/V9 still show unchecked):

| Group | Files | Status | Action |
|---|---|---|---|
| Finished | `T01`, `T02`, `T03`, `T04`, `T04b`, `T05`, `T06`, `T07` + `T07-REPORT`, `T10-ops-hardening` (autonomous part), `V7-alignment-lipsync` (code complete), `V8-brand-and-experience-redesign`, `V8-7-assets-and-cleanup`, `V8.3-landing-plan`, `V8.3b-landing-plan`, `V8-V9-estimates-models-tooling`, `V9-teacher-avatar-and-animation-library`, `V9-REPORT` (119 KB), `V10-interactive-visuals` (steps 1-6 done, live run in later state entries), `V2-instant-public-demo` (done, merged since) | done per state.md | move to `.claude/plans/archive/` (certain) |
| Finished V9 session briefs | `NEXT-SESSION-CANINO`, `-V91-REVIEW`, `-V91D-MOTION-WARDROBE-QA`, `-V91E-MJ-SKIRT-AND-CLIPS`, `-V92-ANIMATION-LIBRARY`, `-V92B-FIXES`, `-V93-DIRECTOR`, `-V96-TIER2-CLIPS`, `-V96-WIRING`, `-V97-TEACHING-MOVES`, `-V97-WIRING`, `-V98-WIRING`, `V93-WIRING`, `V96-GESTURE-CATALOGUE` | V9.1 to V9.8 all "done" in state.md | archive (certain) |
| Superseded / session scratch | `SESSION_HANDOFF.md` (28 KB, 2026-07 audit), `MODEL-SWITCHING.md` | stale | archive or delete (likely) |
| Still open (keep) | `V1`, `V3`, `V4` (branch `dev/v4-teacher-memory` has 5 unmerged commits), `V5`, `V6`, `T08` (partly done via V9.4), `T09` (lesson streaming), `T10-RUNBOOK` (Resend, admin bootstrap, Sentry), `T11` (content seeding), `UX-POLISH-BACKLOG`, `README.md` | open | keep; update README checklist |

## 5. Git hygiene (read-only; remotes `origin` = x-HmZ/aristo-ai, `friend` = again-Suleman/Aristo-AI)

| Item | Evidence | Confidence | Proposed action | Risk |
|---|---|---|---|---|
| 33 local branches already merged into `origin/deploy-prep` | `adaptive-visuals`, `build-v2`, `build-v3`, `claude/charming-moser-52a2c0`, `claude/quirky-satoshi-0822a1`, `dev/desk-quiz-3d-fixes`, `dev/desk-quiz-portrait`, `dev/roadmap-wave-1`, `dev/t04-landing-page`, `dev/t04b-visual-identity`, `dev/t06-persistent-cache`, `dev/t10-ops-hardening`, `dev/v10-continuation`, `dev/v10-interactive-visuals`, `dev/v2-instant-demo`, `dev/v8-1-brand`, `dev/v8-2-design-system`, `dev/v8-3-landing`, `dev/v8-3b-landing`, `dev/v8-3c-landing`, `dev/v8-3d-shirts`, `dev/v8-4a-controls-gap`, `dev/v8-4a-lesson-panel`, `dev/v8-4b-quiz`, `dev/v8-4c-shells`, `dev/v8-5-studio-room`, `dev/v8-5b-day-walls`, `dev/v8-6-app-pages`, `dev/v8-7-cleanup`, `dev/v8-tokens`, `docs/portfolio-capture`, `docs/v8-v9-programme`, `fix/intro-skip-contrast`, `fix/og-jpeg` (and `master`, see below) | certain | `git branch -d` (safe-delete refuses unmerged). Remove the 2 worktrees first (`fix/intro-skip-contrast`, `dev/v8-tokens` are checked out there) | none |
| 31 `origin/*` branches merged into `origin/deploy-prep` | same dev/docs/fix names as above plus `origin/docs/v8-3-direction`, `origin/adaptive-visuals` (origin has 36 heads: these 31, `deploy-prep`, `master`, 3 unmerged) | certain | `git push origin --delete ...` after the owner confirms; GitHub also has PR history | none |
| `friend/*` remote | `friend/adaptive-visuals`, `build-v2`, `deploy-prep`, `master`, `weird_side` are merged; `friend/dev` has 1 unmerged commit ("Tweaks", 2024-05-05); remote is another person's GitHub account | likely | `git remote remove friend` (local-only, reversible by re-adding); no branch loses data on the owner's side | none |
| `master` (local and `origin/master`) | last commit 2025-04-23 (merge of PR #2); `origin/deploy-prep` is 465 commits ahead; CLAUDE.md calls `master` the main branch and `deploy-prep` the production branch | certain | decide the launch default: promote `deploy-prep` to `master` (T01 left this pending) or delete `master` and set `deploy-prep` default. Fix CLAUDE.md ("currently on build-v2") | medium (Vercel production branch setting) |
| UNMERGED `dev/v4-teacher-memory` (local + origin) | 5 commits ahead of `deploy-prep`, last 2026-07-13; V4 teacher memory (greeting agent, history back-reference, misconception targeting) marked complete in its own plan; never merged | needs owner | do not delete; decide merge (it is feature work, and it is based on a very old tree so a rebase is needed) or archive as a tag | high if deleted |
| UNMERGED `dev/classroom-color-tokens` (local + origin) | 1 commit, 2026-09-28, "WIP: tokenise classroom orange"; the hex-to-token work was done via `dev/v8-tokens` (merged) | likely superseded | verify the diff is covered, then delete (tag first if unsure) | low |
| UNMERGED `fix/classroom-ux` | current branch; local is 2 commits ahead of `origin/deploy-prep` (origin copy 1 commit); PR #29 open per `state.md`; working tree has uncommitted `settings.local.json`, `LICENSES.md`, two eval dirs | n/a | not a leftover | none |
| Repo weight | pack 777 MB, 14k objects (largest history blobs: 35.3 MB `classroom_alternative.glb`, 13.5/13.3 MB Marcus/Priya, `Sonia.fbx` 7.3 MB, bake-off PNGs). 5 `tmp_obj_*` garbage files in `.git/objects` | certain | `git gc --prune=now` clears the garbage; history rewrite only if making the repo public, and only with the owner's approval | high (rewrite) |

## 6. Code quality

| Item | Evidence | Confidence | Proposed action | Risk |
|---|---|---|---|---|
| `typescript.ignoreBuildErrors: true` | Comment cites vercel/next.js#82877. On installed **Next 15.5.15** the generated `.next/types/validator.ts` still imports pages as `"../../app/admin/audit-log/page.js"` (the `src/` segment is dropped: `.next/types/../../app` is `<root>/app`, which does not exist). `tsconfig.json` already excludes `validator.ts`, so `yarn type-check` is unaffected. The workaround is still needed | certain | keep until Next is upgraded; re-test by removing the flag after the next bump (15.5.x patch or 16). Risk of the flag today: a type error that only `tsc` would catch (CI runs `type-check`, so covered) | low |
| `yarn lint` | exit 0, 0 errors, 10 warnings: 2x `no-html-link-for-pages` (`CreateTeacherView`), 1 aria on `ClassroomChrome.tsx:162`, 2 conditional `useClassroomLayout` in `LessonView.tsx:779-780`, 1 + 1 + 1 exhaustive-deps (`QuizView`, `Classroom.tsx`, `useCourseAutoTeach`), 2 conditional hooks in `modelLoader.js` (dead file). The `.eslintrc.json` burn-down comment says to restore the three rules to errors when fixed | certain | fix the `LessonView` conditional hook (a real rules-of-hooks risk), delete `modelLoader.js`, then raise the rules back to error | low |
| `yarn type-check` | clean, 0 errors | certain | none | none |
| `yarn test` | 37 files, 702 tests pass (4.3 s) | certain | none | none |
| `console.log` in shipped code | 0 in `src/` and `pages/` (excluding tests). 68 `console.warn/error` (server error paths) | certain | none | none |
| TODO/FIXME/HACK | 0 in `src`, `pages`, `scripts`, `supabase` | certain | none | none |
| Commented-out code | none found (pattern scan for commented statements) | likely | none | none |
| `eslint-disable` / `any` | 23 `eslint-disable` lines, 0 `@ts-ignore`/`@ts-expect-error`, `: any` in about 31 files | likely | triage later | low |
| Env vars read but not in `.env.example` | `NODE_ENV` (framework), `VERCEL_URL` (platform), `TTS_TIMESTAMPS` (kill switch for `/api/tts` timestamps; documented only in code) | certain | add a commented `# TTS_TIMESTAMPS=off` line; `ELEVENLABS_PLAN`, `NEXT_PUBLIC_TTS`, `APP_URL` are present (commented) | none |
| Env vars in `.env.example` read nowhere | `GOOGLE_AI_KEY` | certain | remove (with the dep) and from `DEPLOY.md` | none |
| Script-only env vars | `UNCAP`, `ROOM`, `EVAL_OUT_DIR`, `CHROME`, `BASE_URL` (scripts/tests tooling) | certain | none | none |
| Permanently-on/off flags | `NEXT_PUBLIC_ADAPTIVE_VISUALS` is `true` in every doc (permanently on in practice, see table 2); `NEXT_PUBLIC_INTERACTIVE_VISUALS` off by default on purpose; `NEXT_PUBLIC_TTS=browser` fallback and `TTS_TIMESTAMPS=off` are kill switches | needs owner | retire the adaptive flag after confirming prod | medium |
| Unprotected paid endpoints | `/api/quiz`, `/api/whisper`, `/api/openai-tts` (table 2) | certain | delete or guard | low |

## 7. Database (`supabase/migrations/`, 001 to 017)

| Item | Evidence | Confidence | Proposed action | Risk |
|---|---|---|---|---|
| Tables | every live table is read or written by code: `profiles`, `concepts`, `concept_prerequisites` (+ view `concept_all_prerequisites`), `learner_profiles`, `user_concept_mastery`, `user_course_progress`, `user_misconceptions`, `session_logs`, `quiz_attempts`, `courses`, `reference_chunks`, `admin_audit_log`, `usage_events`, `cached_lessons`, `generated_assets`, `generated_interactives`. RPCs `increment_cached_lesson_usage`, `increment_misconception`, `match_reference_chunks` all called. Old `style_assessments`, `curricula`, `sessions` were dropped by `005_reset_and_graph.sql` | certain | none | none |
| `cached_lessons.rag_chunks_used` (JSONB, migration 014) | the only column found that no code reads or writes (the parse covered all `CREATE TABLE` plus `ALTER ... ADD COLUMN`; I did not have DB access, the Supabase MCP failed to connect) | likely | drop in a new migration (018) if traceability is not wanted, or start writing it | low |
| Migrations 001 to 004 | 002/003 alter `profiles`/`style_assessments`/`sessions` (FSLSM-era columns) that 005 then drops and recreates; history only | certain | do not edit applied migrations; optionally squash into a baseline for fresh installs | high if edited |
| Migration `007` missing | sequence jumps 006 to 008. `state.md` says "no `007`: `quiz_attempts` went into `006_mastery`". Applied-migration tracking (Supabase) is by filename/timestamp, so a gap does not break `db push`; it only confuses readers | certain | no action; add a one-line `007_RESERVED.md` or note in the README so nobody "fills" it; never add a 007 now (it would sort before 008 and look applied out of order) | none |
| Unverifiable from here | live-DB drift (columns/tables that exist in production but not in migrations), unused indexes, RLS on `usage_events`/`generated_*` | needs owner | run the Supabase advisors (security + performance) before launch | n/a |

---

## Suggested removal order (small, independently verifiable batches)

Every batch ends with `yarn type-check`, `yarn test`, `yarn build` (stop `yarn dev`/`next start` first: they share `.next`). Run `yarn install` after any `package.json` edit and keep the single lockfile (yarn 1).

1. **Security quick win: unauthenticated paid routes.** Delete `src/app/api/quiz/route.ts`; for `whisper` and `openai-tts` either delete or add `verifyApproved()` + zod + size cap (owner decides, CLAUDE.md says "leave in place", so guarding is the compliant option). Remove their lines from docs.
2. **Dead UI layer and utils (no deps yet).** Delete the 12 unreachable `ui/*.tsx`, `use-toast.ts`, `utils/cn.js`, `utils/modelLoader.js`, `admin/GoogleCharts.jsx`, `jsconfig.json`. Expect lint to drop to 8 warnings.
3. **Dependencies.** Remove the 8 unreferenced packages plus `cmdk`, `@radix-ui/react-{dropdown-menu,popover,progress,scroll-area,separator,toast,tooltip}`. Declare `uuid` and `three-stdlib` (or replace with `crypto.randomUUID()` / `three/examples` import) and drop `@types/uuid` if unused. Remove `GOOGLE_AI_KEY` from `.env.example` and `DEPLOY.md`. Verify `git diff yarn.lock` only removes entries.
4. **Dead exports and store members.** Remove the 14 unused exports (table 2) and the dead store slices (`quiz`, `profile`, `masteryByConcept`, `currentConceptId` incl. `partialize`, `currentAudio`) plus the 2 `clearQuiz` callers. Unused routes: `/api/kg/ingest`, `/api/profile/mastery`, `/api/admin/cost/events`, `src/app/aristo`.
5. **Dev routes at launch.** Make `pages/dev/*` return a real 404 in production (or exclude the 4 tracked harnesses from the deploy). Fix the lint warnings that matter (`LessonView` conditional hook, `Link` in `CreateTeacherView`) and raise the three downgraded ESLint rules back to error.
6. **Static assets.** Delete `public/next.svg`, `vercel.svg`, `demo/heart/source.jpg`; move the 6 archived avatar/anim GLBs out of `public/` (keep `AVATAR_ASSETS` config). Optional: demo PNG to WebP (update 4 `imageUrl`s), decide on `draco_decoder.js`. Run `/demo`, `/learn` with Jake and MJ and "Evening" in a prod build before merging.
7. **Docs.** Rewrite `README.md`; refresh `DEPLOY.md` and `TECHNICAL_SUMMARY.md` (or merge into `architecture.md`); fix the `spec_index.md` pointer and the `master`/`build-v2` statements in CLAUDE.md; prune `.vercelignore`; add `TTS_TIMESTAMPS` to `.env.example`; `git rm --cached .claude/settings.local.json` and ignore it.
8. **Plans and state.** Move the finished plans and `NEXT-SESSION-*` briefs to `.claude/plans/archive/`; update the README checklist; split `state.md` into current plus archive.
9. **Branches and worktrees.** Remove the 2 worktrees, delete the 33 merged local branches and 31 merged remote branches, `git remote remove friend`, `git gc --prune=now`. Decide `master`/default branch. Park `dev/v4-teacher-memory` and `dev/classroom-color-tokens` (tag or decide).
10. **Owner decisions last (feature-level).** Ship or cut `/create-teacher` + `@avaturn/sdk`; retire the `ADAPTIVE_VISUALS` flag and the legacy `LessonView`/`SYSTEM_PROMPT` path; whether `.claude/eval` evidence (16.8 MB tracked) and 26 MB archived avatars should be in a public repo; `rag_chunks_used` column drop; any history rewrite.
