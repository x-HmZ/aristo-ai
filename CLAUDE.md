# Aristo AI — CLAUDE.md

Aristo AI is an immersive, knowledge-graph-driven AI tutoring platform. A 3D avatar teacher delivers structured 5-phase lessons to middle-school students (grades 6–8), adapting to each learner's behaviorally-inferred profile and tracking mastery per concept with spaced repetition.

> **For Claude:** read `.claude/docs/state.md` first for current status. Auto-memory `MEMORY.md` is for session learnings only — durable facts belong in `.claude/docs/`. The authoritative spec is `AI_TEACHER_APP_SPEC.md` at project root; consult `spec_index.md` to read one section surgically rather than the full file. **The spec supersedes this CLAUDE.md on any conflict.** Deep docs are in `.claude/docs/` — read on demand, not upfront.

## Vision (do not redirect from this)

- **Immersive 3D experience** — teacher avatar (Jake, the default, or MJ) in a real-time R3F scene; physical topics get a generated 3D model (FLUX → Tripo3D) in the scene.
- **Real teaching, not summarization** — strict 5-phase protocol: Activate → Explain → Demonstrate → Challenge → Connect.
- **Adaptive** — no fixed learning-style buckets (FSLSM rejected); `DynamicProfile` (expertise / depth / pace / example preference) inferred from behavioral signals every session.
- **Mastery-based, not time-based** — BKT per concept, FSRS spaced repetition; the KG decides what to teach next.
- **Visual direction** — product (classroom, `/learn`, `/demo`): pastel orange (#F97B2F) + cream/beige, soft glassmorphism; not childish, not corporate. Landing page (`/`): "Night Class" since T04b, dark-first ink with orange as a spark, Archivo wide caps for display, light variant, follows the OS with a toggle; its tokens are scoped to `.landing` (`.claude/docs/landing-design-system.md`).

## Stack

| Area | Choice |
|------|--------|
| Framework | Next.js 15, TypeScript, App Router (one Pages Router exception — see below) |
| Auth + DB | Supabase (ref: `thivgkbxgfchhystlyvh`) — pgvector enabled |
| 3D | React Three Fiber v8 + Drei v9 + Three.js |
| State | Zustand (`src/store/useAristoStore.ts`) — persisted to sessionStorage |
| UI | shadcn/ui + Tailwind CSS |
| LLMs | Anthropic — Sonnet (lessons, quiz gen) + Haiku (explain-more, review, short-answer eval, free chat) |
| RAG | OpenAI `text-embedding-3-small` (1536 dim, gracefully optional) |
| TTS/STT | Browser Web Speech API (Whisper/TTS routes exist as planned upgrade — leave in place) |
| 3D gen | fal.ai: FLUX Schnell → Tripo3D v2.5 (GLB) |
| Deploy | Vercel |

**Model IDs are centralized:** `src/lib/agents/models.ts` exports `MODELS.teaching | assessment | fast`. **Never hardcode model strings elsewhere.**

## CRITICAL: Pages Router constraint for `/learn` (do not violate)

Next.js 15 App Router's `(app-pages-browser)` webpack layer aliases `react` to `next/dist/compiled/react` (React 19), which strips internals that `react-reconciler@0.27.0` (R3F's dep) reads at module init — fatal crash.

- `pages/learn.tsx` — Pages Router page with `getServerSideProps` for Supabase auth
- `src/components/learn/LearnClient.tsx` — `"use client"`, statically imports `AristoCanvas`
- `pages/learn.tsx` uses `next/dynamic({ ssr: false })` to load `LearnClient` (the SSR boundary)
- Do **not** move `/learn` into `src/app/learn/` — breaks R3F
- Do **not** add a webpack alias redirecting `react` to real `node_modules/react` — breaks `React.use` in App Router pages

Everything else lives in App Router.

## Teacher avatars (V9)

- **Jake is the default teacher** (`DEFAULT_TEACHER` in the store; only his scene is preloaded); **MJ** is the second. Ryan, Sonia,
  Marcus and Priya are archived (kept in `AVATAR_ASSETS`, not offered, not tested). Both are Canino3d models, CC BY 4.0: the credit
  renders via `AvatarCredit` from `AVATAR_ASSETS[*].credit`. Any new asset needs a `LICENSES.md` row.
- Each teacher is a base GLB (mesh + Idle/Talking/Thinking) plus a lazy `_clips.glb` pack loaded after `sceneReady`. What plays is
  decided by the pure director in `src/lib/avatar/` (manifest, director, masks, look, face, gaze); `Teacher.tsx` only renders it.
  Clip names live in the manifest, never in `Teacher.tsx`. Detail: `.claude/docs/architecture.md` ("Teacher avatar subsystem").
- A teacher that cannot load, a persisted archived choice, and `custom` with no URL all fall back to Jake. Custom teachers keep
  `CUSTOM_CLIP_SET` and `smileGain` 0.4.

## Docs map (read on demand)

| Doc | Contents |
|-----|----------|
| `.claude/docs/state.md` | Phase status, what's next, migration state |
| `.claude/docs/architecture.md` | Agents, subsystems, all API routes, components, hooks, store, approval gate |
| `.claude/docs/decisions.md` | Decision log — why things are the way they are |
| `.claude/docs/landing-design-system.md` | Landing page tokens, type, shape, theme rules ("Night Class") |
| `LICENSES.md` | Every shipped third-party asset: author, licence, source, modified, open items |
| `AI_TEACHER_APP_SPEC.md` | Authoritative spec (use `spec_index.md` to navigate) |
| `.claude/eval/2026-09-09-pipeline/README.md` | Real fal.ai output behind the image/3D model choices — comparison images, reference GLBs, and three decisions not to re-litigate |

## Workflow

- Plan mode (Opus) before multi-file changes; execute with Sonnet.
- `security-reviewer` subagent before shipping anything touching auth, learner data, or API routes.
- All Anthropic calls use `tool_use` with strict schemas — never regex-parse JSON.
- Update `.claude/docs/state.md` at session end (done / next / blockers, compact).

## Env vars

```
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY     # Teaching / Assessment / Curriculum
OPENAI_API_KEY        # RAG embeddings + planned Whisper/TTS — gracefully optional
FAL_KEY               # fal.ai 3D generation (NOT FAL_API_KEY)
```

## Repo & tooling

- Git: `master` (currently on `build-v2`), user `x-HmZ`. Package manager: **yarn**.
- Skills to load per task: `nextjs-turbopack`, `frontend-design`, `claude-api`, `fal-ai-media`, `security-review`, `design-system`, `postgres-patterns`, `database-migrations`
- MCP: `context7`, `vercel`, `magic`, `sequential-thinking` (`.mcp.json`); `supabase`, `github` (global)
