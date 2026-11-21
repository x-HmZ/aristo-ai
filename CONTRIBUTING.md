# Contributing to Aristo AI

How to get the project running on your machine and how changes reach production. Read this once, then
`CLAUDE.md` (what the product is and the rules that must not break), then the top entry of `.claude/docs/state.md`
(where the work stands today).

The repository is **public**. Anything you commit, including docs, screenshots and PR text, is visible to everyone.

## 1. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20 or 22 (`engines: >=20`; CI runs 20) | 22 LTS is a good default. |
| Yarn | 1.22.x (classic) | `corepack enable` picks up the version pinned in `package.json`. **Use yarn only**: no `npm install`, no `pnpm`, no second lockfile. |
| Git + GitHub CLI | any recent | `gh auth login` once, for PRs. |
| Chrome or Edge | recent | The 3D scene needs WebGL2. |
| Optional: Blender 4.x, Python 3.11 + `uv` | | Only for avatar/room asset work and the `blender` MCP server. |

## 2. Clone and install

```bash
git clone https://github.com/x-HmZ/aristo-ai.git
cd aristo-ai
git checkout deploy-prep
yarn install --frozen-lockfile
cp .env.example .env.local      # PowerShell: Copy-Item .env.example .env.local
```

## 3. Environment variables

`.env.example` is the authoritative list: every variable the code reads, grouped, each marked `[required]`,
`[optional]`, `[paid]` or `[auto]`, with a comment on what it does. Summary:

| Variable(s) | Needed for | Where to get it |
|-------------|-----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sign-in, `/learn`, `/admin`, every API route that touches the database | Ask the owner |
| `SUPABASE_SERVICE_ROLE_KEY` | Server routes, quiz/narration token signing | **Never the production key**: it bypasses Row Level Security on real learners' (minors') data. Use a dummy locally, or the key of a separate development project if the owner sets one up |
| `ANTHROPIC_API_KEY` | Lessons, quizzes, chat (paid) | Ask the owner |
| `OPENAI_API_KEY` | RAG embeddings and server voice input (paid, optional) | Ask the owner; skip locally |
| `ELEVENLABS_API_KEY` (+ `ELEVENLABS_PLAN`) | Teacher speech (paid, optional; falls back to the browser voice) | Ask the owner; skip unless you work on speech |
| `FAL_KEY` | Generated images and 3D models in lessons (paid, optional) | Ask the owner; skip unless you work on generation |
| `RESEND_API_KEY`, `ADMIN_NOTIFY_EMAIL` | Admin "new sign-up" email (optional) | Skip locally |
| Billing (`BILLING_ENABLED`, `PADDLE_*`, ...) | Payments: **sandbox-only, off by default** | Skip locally |
| Turnstile, operator details, Avaturn, `APP_URL` | Sign-up captcha, legal pages, custom teachers, absolute links | Skip locally |

There is one Supabase project, and it is production, holding real learners' data. Production credentials are not
handed out: work that needs a real database waits for a separate development project from the owner. Never apply a migration from `supabase/migrations/` to the
production project yourself: the owner applies migrations, and a PR that adds one says so at the top of its
description, with any ordering constraint (some migrations must land before or after a deploy).

Never paste a real key into a file, an issue, a PR, a commit or a chat with an AI tool. If a key leaks, tell the
owner at once so it can be rotated.

## 4. Running the app

```bash
yarn dev          # http://localhost:3000
yarn test         # Vitest, pure-logic unit tests (src/**/*.test.ts). No network, no keys.
yarn lint         # next lint (some rules are warnings on purpose, see .eslintrc.json)
yarn type-check   # tsc --noEmit
yarn build        # production build; CI runs type-check, lint, test and build on every PR
```

Only one Next.js server per checkout: `yarn dev` and a `yarn build`/`yarn start` share `.next/` and break each
other. Stop dev before a production build.

### Running without paid keys

With dummy values in `.env.local` (any non-empty string for the Supabase and API keys, e.g. the placeholders in
`.github/workflows/ci.yml`):

- `yarn install`, `yarn test`, `yarn lint`, `yarn type-check` and `yarn build` all work.
- `yarn dev` serves the landing page `/` and the public `/demo` lesson (pre-recorded narration, cached
  assets: no generation, no key needed) and the `/dev/*` harness pages.
- Sign-in, `/learn`, `/admin` and any lesson generation need real Supabase values and an Anthropic key.

## 5. Paid APIs: the rule

fal.ai, ElevenLabs, Anthropic and OpenAI are metered, and the owner tops up the credits by hand.

- **No paid generation for testing without the owner's go-ahead** for that run: no lesson generation, no
  image/3D generation, no TTS renders, no eval scripts (`scripts/eval-*`, `scripts/regen-*`,
  `scripts/generate-demo-*`, `scripts/prerender-demo-tts.mjs`, `scripts/landing-voice.mjs`).
- Prefer desk research (docs, pricing pages; fal's pricing API is free) and unit tests over live calls.
- Opening `/learn` while signed in can start a lesson automatically (a course auto-teach fires on load). Clear
  `sessionStorage` first, and treat signed-in checks as view-only unless a paid run was agreed.
- Media generation stays on fal.ai. The 2026-11-21 provider research (`.claude/research/`) decided not to switch;
  do not re-open it without the owner.
- When a change ships unverified because verifying it would cost money, say so in the PR.

## 6. The `/learn` Pages Router constraint (do not break)

Next.js 15's App Router aliases `react` to its compiled React 19, which crashes `react-reconciler` (React Three
Fiber) at module load. So `/learn`, `/`, `/demo` and `/dev/*` live in `pages/` (Pages Router), and load their 3D
client with `next/dynamic({ ssr: false })`. Do not move `/learn` into `src/app/`, and do not add a webpack alias
for `react`. Everything else is App Router. Details: `CLAUDE.md`, "CRITICAL: Pages Router constraint".

## 7. MCP servers (`.mcp.json`)

Claude Code asks you to approve the project's servers the first time it starts in the repo. All are optional.

| Server | What for | Setup |
|--------|---------|-------|
| `context7` | Up-to-date library docs | None (runs with `npx`) |
| `sequential-thinking` | Step-by-step reasoning tool | None |
| `magic` | Magic UI component registry | None |
| `puppeteer` | Headless browser checks | None; downloads Chromium on first run |
| `vercel` | Deployments and logs | Run `/mcp` in Claude Code and sign in with Vercel (OAuth). Only useful if the owner gives you access to the Vercel project, at a role that cannot read production env values; without access, leave it disabled. PR preview links appear on the PR anyway |
| `blender` | Driving a local Blender for asset work | Needs Blender with the blender-mcp add-on and `uv`/`uvx` with Python 3.11. Leave it disabled otherwise |

Supabase and GitHub MCP servers are not in `.mcp.json`; add them at user level if you want them. `gh` covers PR work.

## 8. Branches, PRs and commits

- `deploy-prep` is the main branch, and **Vercel deploys production from it**. Never push to it directly, never
  force-push it. Every change goes through a PR into `deploy-prep`.
- Branch from an up-to-date `deploy-prep`: `fix/...`, `feat/...`, `docs/...`, `chore/...`.
- The owner reviews and merges. Do not merge your own PR unless the owner says so for that PR.
- CI (`.github/workflows/ci.yml`) must be green: type-check, lint, test, build.
- In the PR description: what changed, how you verified it, what is not verified, and any migration or env var
  the owner must set (and update `.env.example` in the same PR when you add a variable).
- Commits: small and atomic, imperative mood ("Add quiz retry limit", not "Added..."), one concern per commit.
  No emojis in code, comments or commit messages.
- Never commit secrets or `.env*` files other than `.env.example`. Do not commit screenshots or local eval
  output; `.claude/eval/` holds only folders the docs point to.

## 9. Code rules worth knowing up front

- Model IDs live only in `src/lib/agents/models.ts` (`MODELS.teaching | assessment | fast`). Never hardcode one.
- Anthropic calls use `tool_use` with strict schemas; never regex-parse JSON from a model.
- Validate every external input with Zod: API routes, server actions, env vars.
- Security-sensitive changes (auth, learner data, API routes, payments, secrets) get a security review before merge.
- Third-party assets need a row in `LICENSES.md` (author, licence, source, modifications).

## 10. Working with Claude Code

Start every session the same way:

1. Claude reads `CLAUDE.md` (loaded automatically), then the **top entry** of `.claude/docs/state.md`.
2. Other docs (`.claude/docs/architecture.md`, `decisions.md`, `brand-system.md`, the spec
   `AI_TEACHER_APP_SPEC.md`) are read on demand, one section at a time, not upfront.
3. Plan before multi-file changes (plan mode), then implement.
4. At the end of a significant session, add a short entry to the top of `.claude/docs/state.md`
   (done / next / blockers) in the same PR.

`.claude/settings.json` holds shared permissions (yarn and a few read-only git/gh commands allowed; every `git push`
asks first; reading `.env.local`, force pushes and pushes to `deploy-prep` denied). Put anything machine-specific in `.claude/settings.local.json`, which is
gitignored.
