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
