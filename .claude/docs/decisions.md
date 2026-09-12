# Aristo AI — Key Decisions Log

_Append new rows as decisions are made. Never re-litigate a decision without reading its "Why"._

| Decision | Choice | Why |
|----------|--------|-----|
| `/learn` in Pages Router | Permanent | R3F + App Router crashes on react-reconciler internals (see CLAUDE.md critical constraint) |
| FSLSM learning styles | **Removed** | Debunked; replaced by behaviorally-inferred DynamicProfile |
| Teaching model | Sonnet 4.6 | Quality on structured 5-phase output |
| Fast paths | Haiku 4.5 | explain-more, review questions, short-answer eval, free-mode |
| LLM JSON | tool_use everywhere | Guaranteed valid JSON; no regex parsing |
| TTS / STT | Web Speech (now), Whisper / TTS routes kept (planned upgrade) | Free for prototype; routes already wired for the swap |
| 3D gen | fal.ai FLUX → TripoSR (`fal-ai/triposr`, $0.07/gen) | One SDK, one key; TripoSR quality is the known weak link — see plans T06/T07 |
| Quiz UI | dedicated `QuizView`, 8 types | Replaces legacy `quiz` slice in store |
| Approval gate | `requireApproved()` placeholder | Future paywall swaps in by replacing one function body |
| Voice TTS | ElevenLabs `eleven_turbo_v2_5` via `/api/tts` | Free-tier friendly, single swap point; wawa-lipsync visemes ride the audio element |
| Desk quiz placement | `<Html transform>` at probed desk plane | Screen-anchored Html floated in mid-air; `occlude="blending"` was the original killer, not transform mode |
| Landing-page motion | `react-intersection-observer` + CSS transition, not framer-motion | Same scroll reveal for ~2 kB instead of ~38 kB on the one page whose job is to load fast (first-load JS 146 kB -> 120 kB); `prefers-reduced-motion` becomes a media query instead of a JS branch |
| Landing-page product shots | Stills captured from `/demo`, not `/learn` | Same classroom, avatar and lesson panel, but public, session-free and free to run; a real `/learn` capture costs Sonnet + fal per shot |
| Landing identity (T04b) | "Night Class": dark-first ink `#0E1117`, orange `#E98A52` (77% sat) as a spark, Archivo `wdth` 125 caps for display, light variant, follows the OS with a toggle | Hmz picked it from three canvas directions (Ember / Night Class / Cobalt). Only one where dark mode is the identity, and the warm classroom shots read as the lit window. Orange kept as the link to the product; Cobalt was rejected for splitting the brand from the classroom UI |
| Landing tokens scoped to `.landing` | Own `--lp-*` set, not the shared `--aristo-*` / shadcn tokens | `/learn` + `/demo` hardcode `#F97B2F` ~87 times, so a global change would restyle dashboard/auth but not the classroom. Product-wide migration is its own task |
| Landing display font | Archivo in `src/components/landing/fonts.ts`, not `src/lib/fonts.ts` | `src/lib/fonts.ts` is imported by both routers' roots, so anything there preloads on `/learn` and `/demo` too |
