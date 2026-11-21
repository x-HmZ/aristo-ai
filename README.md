# Aristo AI

An immersive AI tutoring platform for middle-school learners (grades 6 to 8): a 3D teacher avatar delivers structured
five-phase lessons, adapts to each learner, and tracks mastery per concept with spaced repetition.

- Stack: Next.js 15 (App Router, plus Pages Router for the 3D routes), TypeScript, React Three Fiber, Supabase,
  Anthropic, fal.ai, ElevenLabs, Vercel.
- **Contributing:** start with [CONTRIBUTING.md](CONTRIBUTING.md) (setup, env vars, running without paid keys, PR flow),
  then [CLAUDE.md](CLAUDE.md) (product rules and constraints).
- Third-party assets and their licences: [LICENSES.md](LICENSES.md).

```bash
yarn install --frozen-lockfile
cp .env.example .env.local
yarn dev
```
