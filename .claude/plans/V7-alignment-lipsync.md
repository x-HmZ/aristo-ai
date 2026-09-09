# V7 — Alignment-driven lipsync

**Model: sonnet. Size: M. Status: both paths code-complete 2026-09-08. /learn needs no
further action; /demo is blocked on one API-key permission.**

> **`/learn` is done and needs nothing run.** `/api/tts` now calls
> `/v1/text-to-speech/{id}/with-timestamps`, which returns character timings alongside the
> audio for the same character cost and needs no extra key scope. It falls back to plain
> audio automatically, and `TTS_TIMESTAMPS=off` disables it without a code deploy.
>
> **`/demo` needs the API key's `forced_alignment` permission enabled** (ElevenLabs
> dashboard -> API Keys -> edit key). Without it `--align` fails 401
> `missing_permissions`. Once enabled:
> `node scripts/prerender-demo-tts.mjs --align` -- 30 segments, ~7.4 min of audio,
> **0 TTS characters**. Until then the sidecars 404 and the demo stays on the FFT.
>
> Neither path has been exercised against the live ElevenLabs API: `api.elevenlabs.io` is
> denied by the Cowork session egress policy and the desktop VM has no outbound DNS, so no
> agent session can call it. Everything here is typechecked and unit-tested but unproven in
> production -- hence the fallbacks and the kill switch.

Prerequisite reading: `CLAUDE.md`, `src/hooks/useTTS.ts`, `src/components/three/Teacher.tsx`.

## Problem

Lipsync today is inferred, not aligned. `wawa-lipsync` runs an FFT over the playing
audio and guesses a viseme from the frequency profile of the current frame
(`getCurrentViseme()` in `useTTS.ts`, consumed by `Teacher.tsx`'s `useFrame`). It
produces mouth movement that is clearly in time with speech but does not match the
actual phonemes — an "m" and an "ah" can land on the same viseme because they share a
band profile. Observed and accepted as good-enough on 2026-09-08; this brief is the
upgrade path.

The fix is to drive visemes from real timing data instead of guessing from spectra.

## What ElevenLabs actually offers

Character-level, not phoneme-level. Two endpoints, and the distinction matters for cost:

| Path | Endpoint | Billed as | Use for |
|---|---|---|---|
| Generate + align in one call | `/v1/text-to-speech/{voice_id}/with-timestamps` | **the same characters as a normal TTS call** — timestamps are not a surcharge | `/learn` (live narration) |
| Align audio that already exists | Forced Alignment | **Speech-to-Text rates (audio minutes), not TTS characters** | `/demo` (30 mp3s already rendered) |

Both return `alignment` and `normalized_alignment`: a `characters` array plus
`character_start_times_seconds` / `character_end_times_seconds`.

**Cost consequence, and the reason this is worth doing:**

- `/learn` can switch at **no additional spend**. Swapping the endpoint costs the same
  characters it costs today.
- `/demo` does **not** need re-rendering. Re-rendering the 30 segments through
  `with-timestamps` would cost another ~7,029 characters, which would exceed the
  10,000/month free tier in a cycle where 7,029 are already spent. Forced Alignment on
  the existing mp3s is billed against STT (roughly 8 minutes of audio) and leaves the
  character budget untouched. **Prefer Forced Alignment for the demo.**

Limits are not a factor here: 10h audio, 3GB, 675,000 characters. Plain text only.

## Design

1. **Character → viseme map.** ElevenLabs gives characters; `AVATURN_VISEMES` in
   `Teacher.tsx` wants the 15 Oculus/ARKit viseme names. Write a lookup:
   vowels to `viseme_aa/E/I/O/U`, consonant groups to `PP/FF/TH/DD/kk/CH/SS/nn/RR`,
   whitespace and punctuation to `viseme_sil`. Collapse runs of characters that map to
   the same viseme into one span so the mouth is not restruck per letter.
2. **Demo (do this first — it is self-contained and needs no route changes).**
   Extend `scripts/prerender-demo-tts.mjs` with an `--align` pass that sends each
   existing `public/demo/<slug>/<seg>.mp3` plus its segment text to Forced Alignment and
   writes `<seg>.align.json` beside it. Then have `useTTS` load that JSON when `srcUrl`
   is set and expose a timeline-based `getCurrentViseme()` that binary-searches the spans
   by `audio.currentTime`. Deterministic, zero runtime API cost, and it makes the funnel
   page the best-looking surface in the product.
3. **`/learn`.** Change `/api/tts` to call `with-timestamps` and return
   `{ audio_base64, alignment }` instead of streaming raw mp3. Note this changes the
   route's response shape and inflates the payload (base64 plus JSON vs raw bytes), so
   measure the added latency against the existing ~0.5-1.5s fetch before committing;
   the prefetch path in `useTTS` already hides most of it.
4. **Keep `wawa-lipsync` as the fallback.** Any segment without alignment data — a
   missing file, an alignment call that failed, the browser speechSynthesis path — must
   still fall back to the current FFT behaviour rather than freezing the mouth.

## Checklist

- [x] Character→viseme map, with unit tests — `src/lib/lipsync/visemes.ts` (+ `.test.ts`,
      26 assertions). Handles digraphs (`th`/`sh`/`ck`/`ph`/`ng`/`qu`) as single sounds,
      carries the previous shape through apostrophes so "don't" does not go silent
      mid-word, collapses runs, and drops sub-120ms inter-word silences so the jaw does not
      chatter at every word boundary. Includes a 60fps playback simulation asserting the
      mouth stays active, changes 3-25x/sec, and never freezes for >0.6s.
- [x] `--align` pass in `scripts/prerender-demo-tts.mjs`, writing `<seg>.align.json`.
      Resumable, skips segments whose timings are already current, and treats an alignment
      as stale if the mp3's byte count no longer matches the `audioBytes` recorded in it,
      so re-rendering audio forces re-alignment.
- [x] Timeline viseme source in `useTTS`. `getCurrentViseme()` prefers real timings and
      falls back to the FFT; the fetch is fire-and-forget so playback never waits on it, and
      a generation counter stops a late-landing sidecar from applying to whichever segment
      is playing by then.
- [x] FFT fallback preserved. Verified against the running dev server: the sidecar URL
      returns 404 and the mp3 still returns 200, which is the degrade path. `parseAlignment`
      additionally rejects malformed payloads and anything whose `generator` is not an
      ElevenLabs run, so a placeholder file can never drive the mouth from invented numbers.
- [ ] **Run `--align` and watch a demo lesson.** Not done: see the egress note above. The
      timeline logic is unit-tested but has never driven a real mesh.
- [x] `/learn` on `with-timestamps`. `/api/tts` returns
      `{ audio: <base64>, alignment }` as JSON when ElevenLabs serves timings, and raw mp3
      bytes when it does not; `useTTS` sniffs the content type rather than assuming. The
      prefetch cache now carries the timeline alongside the blob, so a warmed segment keeps
      its timings.
      **No extra character cost** — `with-timestamps` bills the same as the plain endpoint.
      **No streaming lost** — the client already buffered the whole body to build a Blob, so
      the only price is base64's ~33% transfer inflation.
      Failure handling: an upstream error falls back to the plain endpoint; a malformed or
      absent alignment leaves `timeline` null and lipsync on the FFT; `TTS_TIMESTAMPS=off`
      skips the timestamped call entirely.
- [ ] Measure the added latency on `/learn` and record it here. Could not be done from an
      agent session (no route to the API, and the endpoint needs an authed session).
- [x] Update `.claude/docs/state.md` and `SESSION_HANDOFF.md`
