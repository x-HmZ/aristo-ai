# Aristo AI — Project Brief for Claude

## What This Is

Aristo AI is an immersive AI teacher platform. A 3D avatar teaches middle-school students using voice, visuals, generated 3D models, and adaptive learning. This document is the single source of truth for all Claude sessions — read this fully before starting any work.

---

## Vision

- **#1 priority**: Real-time 3D model generation of the topic being taught, displayed in the scene alongside the teacher avatar, with the teacher narrating and annotating it
- **Target user**: Middle-school students (prototype)
- **Design**: Bright pastel orange + off-white/beige theme, modern, immersive, friendly

---

## Finalized Tech Stack

| Area | Choice |
|------|--------|
| Framework | Next.js 15, TypeScript |
| Auth + DB | Supabase (project ref: `thivgkbxgfchhystlyvh`) |
| 3D Rendering | React Three Fiber v8 + Drei v9 |
| State | Zustand (`src/store/useAristoStore.ts`) |
| UI | shadcn/ui + Tailwind CSS |
| AI - Teaching | Gemini 2.0 Flash (via `/api/teach`) |
| AI - TTS/STT | Browser Web Speech API (free, no keys needed for now) |
| 3D Generation | fal.ai: FLUX Schnell (text→image) → Tripo3D v2.5 (image→GLB) |
| Deployment | Vercel |

### 3D Generation Pipeline
```
Topic → FLUX Schnell (fal.ai, text→image, ~5s)
      → Tripo3D v2.5 (fal.ai, image→GLB, ~25-30s)
      → GLB loaded into R3F scene
```

---

## CRITICAL: React Three Fiber + Next.js 15 Architecture

**Problem**: Next.js 15 App Router's `(app-pages-browser)` webpack layer aliases `react` to `next/dist/compiled/react` (React 19 build). This compiled React strips `__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED`. `react-reconciler@0.27.0` (R3F's dependency) reads `ReactCurrentOwner` from `__SECRET_INTERNALS` at **module initialization time**, causing a fatal crash.

**Solution**: `/learn` lives in the **Pages Router** (`pages/learn.tsx`), NOT the App Router. Pages Router uses the `(pages-browser)` webpack layer which does NOT alias react, so R3F finds real React 18 internals.

**Rules — never violate these:**
- `pages/learn.tsx` — Pages Router page with `getServerSideProps` for Supabase auth
- `src/components/learn/LearnClient.tsx` — `"use client"` component, statically imports `AristoCanvas`
- `pages/learn.tsx` uses `next/dynamic({ ssr: false })` to load `LearnClient` — this is the SSR boundary
- Do NOT move `/learn` back to `src/app/learn/` — it will break R3F
- Do NOT add webpack aliases that redirect `react` to real `node_modules/react` — breaks `React.use` in App Router pages

---

## File Structure (key files)

```
pages/
  learn.tsx                          # Pages Router — Supabase auth + loads LearnClient

src/
  app/
    page.tsx                         # Landing page
    sign-in/page.tsx                 # Auth pages
    sign-up/page.tsx
    auth/
      actions.ts                     # signIn, signUp, signOut server actions
      callback/route.ts              # Supabase OAuth callback
    api/
      teach/route.ts                 # Gemini 2.0 Flash teaching API
      generate-model/route.ts        # fal.ai FLUX→Tripo3D pipeline → returns GLB URL
    admin/page.tsx                   # Stub placeholder

  components/
    learn/
      LearnClient.tsx                # Full learning UI shell ("use client", static imports)
      AristoCanvas.tsx               # R3F Canvas + OrbitControls + Experience
      MessagePanel.tsx               # Chat history: definition/explanation/example/fun_fact cards
      InputBox.tsx                   # Text input + mic (Web Speech API) + send; calls /api/teach then /api/generate-model
      TeacherControls.tsx            # Avatar switcher (Ryan/Sonia), learning style pills, clear, generating badge
    three/
      Experience.tsx                 # R3F scene: lights, floor, Teacher, GeneratedModel
      Teacher.tsx                    # Teacher avatar (Ryan/Sonia GLB)
      GeneratedModel.tsx             # Loads generated GLB, float animation, annotation highlights

  store/
    useAristoStore.ts                # Zustand store — teacher, learningStyle, messages, activeModelUrl, etc.

  lib/
    supabase/
      client.ts                      # Browser Supabase client
      server.ts                      # Server Supabase client

  middleware.ts                      # Protects /learn and /admin routes

supabase/
  migrations/
    001_initial_schema.sql           # profiles, style_assessments, curricula, courses, sessions, quiz_attempts + RLS
```

---

## API Routes

### `POST /api/teach`
- Input: `{ topic, learningStyle, history, userName }`
- Uses Gemini 2.0 Flash with structured JSON schema
- Returns: `{ definition, explanation, example, fun_fact, should_generate_model, model_prompt, quiz }`
- `should_generate_model: true` triggers the 3D generation client-side

### `POST /api/generate-model`
- Input: `{ prompt }`
- Step 1: fal.ai FLUX Schnell → image URL
- Step 2: fal.ai Tripo3D v2.5 → GLB URL
- Returns: `{ modelUrl }` (GLB URL usable directly by Three.js)

---

## Zustand Store Shape (`useAristoStore.ts`)

```ts
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  definition?: string;
  explanation?: string;
  example?: string;
  fun_fact?: string;
  annotationHints?: string[];
  modelUrl?: string;
  quiz?: QuizQuestion[];
}

interface AristoStore {
  userId: string;
  teacher: "ryan" | "sonia";
  learningStyle: "visual" | "simple" | "metaphor" | "technical";
  messages: Message[];
  activeModelUrl: string | null;
  isGeneratingModel: boolean;
  // + setters for all of the above
}
```

---

## Phase Status

### Phase 1 — Foundation ✅ COMPLETE
- Next.js 15 TypeScript, Firebase removed, all keys server-side
- Supabase auth (middleware, server actions, callback, sign-in/sign-up pages)
- Tailwind design system — pastel orange + cream, full CSS variable set
- shadcn/ui components: button, card, input, label, badge, separator, toast, dialog, sheet, progress
- Zustand store fully typed
- DB schema at `supabase/migrations/001_initial_schema.sql`
- Landing page, `/admin` stub, `/aristo` → `/learn` redirect

**USER TODO**: Run `supabase/migrations/001_initial_schema.sql` in Supabase SQL editor (required for auth/profiles to work)

### Phase 2 — 3D Model Generation ✅ COMPLETE (as of April 2026)

**What was built:**
- `/api/teach` — Gemini 2.0 Flash teaching route with structured output
- `/api/generate-model` — fal.ai FLUX Schnell → Tripo3D v2.5 pipeline
- R3F scene: `AristoCanvas`, `Experience`, `Teacher`, `GeneratedModel`
- Full learning UI: `LearnClient`, `MessagePanel`, `InputBox`, `TeacherControls`
- Pages Router architecture for `/learn` (fixes R3F + Next.js 15 compatibility)
- Browser Web Speech API for STT/TTS (no API key required)
- App is **running on `localhost:3000`** and loading the `/learn` page

**Known remaining issue**: There is a minor runtime error on the `/learn` page (user reported "apart from this error" — error details TBD, investigate on next session start by checking browser console).

**Pending wire-up / polish (Phase 2 completion tasks):**
- Verify full teach → speak → generate model → display in scene flow end-to-end
- Quiz rendering in MessagePanel (quiz data comes back from `/api/teach`)
- Confirm `.env.local` has all required keys: `GEMINI_API_KEY`, `FAL_KEY`

### Phase 3 — Personalized Teaching 🔜
- Learning style assessment test on first login
- Store results in Supabase, adaptive style shifts over time
- Claude streaming for more conversational teaching
- Real-time voice conversation

### Phase 4 — Curriculum System 🔜
- PDF upload → Supabase Storage → Gemini 2.0 Flash parses → structured curriculum
- Admin dashboard: upload PDFs, review/edit curriculum, publish courses

### Phase 5 — Shared Sessions 🔜
- Supabase Realtime for session sync
- Teacher controls pace, question queue

---

## Key Decisions Log

| Decision | Choice | Why |
|----------|--------|-----|
| `/learn` in Pages Router | Yes — permanent | R3F + Next.js 15 App Router breaks react-reconciler; Pages Router fixes it |
| Teaching AI | Gemini 2.0 Flash | Claude API added latency in structured output; Gemini faster for lesson JSON |
| TTS/STT | Browser Web Speech API | Free, no keys, good enough for prototype; upgrade to ElevenLabs/Whisper in Phase 3 |
| 3D gen via fal.ai | FLUX Schnell → Tripo3D v2.5 | Both on fal.ai, single SDK, no separate API keys; ~30-40s total |
| Firebase → Supabase | Supabase | Better SQL, Realtime, Storage |
| No webpack react alias | Confirmed | Aliasing react to node_modules breaks React.use in App Router pages |

---

## Claude Code Setup

### Skills installed (`~/.claude/skills/`)
- `nextjs-turbopack`, `frontend-design`, `claude-api`, `fal-ai-media`, `security-review`, `design-system`, `postgres-patterns`, `database-migrations`

### MCP Servers
- `.mcp.json` (git-tracked): `context7`, `vercel`, `magic`, `sequential-thinking`
- `~/.claude.json` (not in git): `supabase` (project ref: thivgkbxgfchhystlyvh), `github` PAT

---

## Repo & Deployment
- Git: `master` branch, user: x-HmZ
- Working directory: `C:\Users\Pc\Desktop\Empire\Artisto\Aristo 2.0\Aristo-AI`
- Deployed on Vercel

---

## Next Immediate Steps (start of next session)
1. Check browser console on `/learn` for the reported error and fix it
2. Verify end-to-end flow: sign in → ask question → Gemini responds → TTS speaks → 3D model generates and appears
3. Fix quiz rendering in `MessagePanel` if quiz data isn't displaying
4. Confirm `.env.local` has `GEMINI_API_KEY` and `FAL_KEY` set
5. Then move to Phase 3: learning style assessment on first login
