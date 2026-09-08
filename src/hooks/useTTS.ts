"use client";

/**
 * useTTS — central client-side TTS playback + viseme analyzer.
 *
 * Replaces the Web Speech API helpers in LessonView.tsx and InputBox.tsx so
 * we get:
 *   • higher-quality voices (ElevenLabs, via /api/tts)
 *   • access to the audio buffer (Web Speech does not expose it), which is what
 *     makes lipsync possible at all — the avatar's mouth morphs are driven from
 *     the playing audio.
 *
 * Visemes come from one of two sources, preferred in this order:
 *   1. Real character timings from ElevenLabs, looked up by playback position.
 *      Live narration gets them inline from /api/tts (the `with-timestamps`
 *      endpoint); pre-rendered demo segments get them from an `.align.json`
 *      sidecar. Both are normalised by src/lib/lipsync/visemes.ts.
 *   2. wawa-lipsync's FFT, which infers a mouth shape from the frequency
 *      profile of the current frame. Always available, but it cannot tell apart
 *      sounds that share a profile — an "m" and an "ah" can render identically.
 *
 * (1) is used whenever timings exist for the clip being played; (2) is the
 * fallback and remains correct on its own, so nothing here depends on the
 * alignment pipeline having been run.
 *
 * The Lipsync instance is module-level (singleton) so any component can read
 * the current viseme via getCurrentViseme() inside a useFrame loop without
 * threading refs through the tree. The audio element is also a singleton —
 * one tab plays one TTS stream at a time, mirroring window.speechSynthesis.
 *
 * Fallback: if NEXT_PUBLIC_TTS=browser is set, the hook routes back to
 * window.speechSynthesis. Visemes will be silent (no audio source); the
 * avatar mouth falls back to the open/closed lerp.
 */

import { useCallback, useEffect, useRef } from "react";
import { Lipsync, VISEMES } from "wawa-lipsync";
import { useAristoStore, type TeacherAvatar } from "@/store/useAristoStore";
import { alignmentUrlFor, parseAlignment, visemeAt, type VisemeSpan } from "@/lib/lipsync/visemes";

// ─── Singletons (browser-only — guarded) ──────────────────────────────────────

let _audio:    HTMLAudioElement | null = null;
let _lipsync:  Lipsync          | null = null;
let _connected = false;
let _activeUrl: string | null = null;
let _activeHandlers: { play: () => void; end: () => void; error: () => void } | null = null;

// ─── Alignment-driven visemes ─────────────────────────────────────────────────
//
// When a segment has real character timings next to it, we drive the mouth from
// those instead of wawa-lipsync's FFT guess. `_visemeGen` is bumped on every
// stop()/speak() so an alignment fetch that resolves late cannot apply itself to
// whichever segment happens to be playing by then.

let _timeline:  VisemeSpan[] | null = null;
let _visemeGen = 0;

// ─── Ownership of the shared audio element ────────────────────────────────────
//
// One <audio> element is shared by every caller, but four components narrate
// independently (FreeTopicCard, InputBox, LessonView, useLessonPlayback). When
// two speak() calls overlap they used to race: both fetches completed, both set
// audio.src, and each load aborted the one before it. The symptoms were ugly and
// hard to attribute — the wrong segment audible, earlier segments silently
// dropped after ~50ms, several full-price ElevenLabs generations running
// concurrently (which is also what made them slow), and — worst — the losing
// caller never hearing back, because `abort`/`emptied` do not fire `ended`. A
// lesson waiting on that onEnd hangs forever with the avatar frozen mid-gesture.
//
// So speech is now explicitly owned. Every speak() takes the next id; only the
// holder may touch the audio element, and a superseded caller is told its turn
// is over instead of being left waiting.

let _speechSeq    = 0;
let _activeSpeech = 0;

/**
 * Fetch the `<segment>.align.json` sidecar written by
 * scripts/prerender-demo-tts.mjs --align and install it as the viseme source.
 *
 * Deliberately not awaited: playback must never wait on this. If it lands after
 * the audio starts, the first few frames use the FFT and then switch over; if it
 * 404s, is malformed, or was not produced by a real alignment run,
 * parseAlignment returns null and the FFT path simply stays in charge.
 */
function loadAlignment(srcUrl: string, gen: number): void {
  const alignUrl = alignmentUrlFor(srcUrl);
  if (!alignUrl) return;

  fetch(alignUrl)
    .then((r) => (r.ok ? r.json() : null))
    .then((raw) => {
      if (gen !== _visemeGen) return;   // a newer segment started meanwhile
      const timeline = raw ? parseAlignment(raw) : null;
      if (timeline) _timeline = timeline;
    })
    .catch(() => {});
}

// ─── Prefetch cache ───────────────────────────────────────────────────────────
//
// Optional warm cache for the NEXT segment's TTS audio while the CURRENT
// one is playing.  Hides the 0.5–1.5s ElevenLabs fetch between segments in
// the adaptive playback engine.  Key = `${voice}|${text}` — voice matters
// because the same text can hit different ElevenLabs voices per avatar.
//
// LRU-ish with a single-slot bias — we generally only prefetch one segment
// ahead, but a tiny ring buffer protects against rapid skip/prev clicks.

/**
 * One narration segment's audio, plus its viseme timeline when ElevenLabs
 * supplied character timings for it. `timeline` is null whenever the route fell
 * back to plain audio, in which case lipsync uses the FFT approximation.
 */
interface TtsAudio {
  blob:     Blob;
  timeline: VisemeSpan[] | null;
}

const PREFETCH_MAX = 4;
const _prefetchCache = new Map<string, Promise<TtsAudio>>();

/**
 * Requests currently in flight, keyed the same way as the prefetch cache.
 *
 * ElevenLabs bills per character on every request, so asking twice for the same
 * sentence costs twice even though one of the answers gets thrown away. Two
 * things cause that: React StrictMode double-invoking a narration effect in dev,
 * and any future component that starts narrating something already being
 * fetched. Sharing the promise makes a duplicate call free instead of merely
 * harmless — the second caller waits on the first request rather than opening
 * its own.
 *
 * Entries are removed as soon as the request settles, so this only ever
 * collapses genuinely concurrent calls; speaking the same text again later
 * fetches again, as it should.
 */
const _inflight = new Map<string, Promise<TtsAudio>>();

function prefetchKey(voice: string, text: string): string {
  return `${voice}|${text}`;
}

function consumePrefetched(voice: string, text: string): Promise<TtsAudio> | null {
  const k = prefetchKey(voice, text);
  const hit = _prefetchCache.get(k);
  if (!hit) return null;
  _prefetchCache.delete(k);
  return hit;
}

function storePrefetched(voice: string, text: string, blobPromise: Promise<TtsAudio>): void {
  const k = prefetchKey(voice, text);
  if (_prefetchCache.has(k)) return; // dedupe
  if (_prefetchCache.size >= PREFETCH_MAX) {
    const oldest = _prefetchCache.keys().next().value;
    if (oldest) _prefetchCache.delete(oldest);
  }
  _prefetchCache.set(k, blobPromise);
}

/** Decode the base64 mp3 the /api/tts JSON response carries. */
function base64ToBlob(b64: string): Blob {
  const bin   = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: "audio/mpeg" });
}

/**
 * Fetch one segment from /api/tts.
 *
 * The route answers with JSON (base64 audio + character timings) when
 * ElevenLabs served timestamps, and with raw mp3 bytes when it fell back — so
 * sniff the content type rather than assuming either. A malformed JSON body is
 * treated as a failure so the caller's error path runs, but a *missing*
 * alignment is not: audio without timings is a perfectly good outcome, it just
 * leaves lipsync on the FFT.
 */
async function fetchTts(text: string, voice: string): Promise<TtsAudio> {
  const res = await fetch("/api/tts", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ text, voice }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status}`);

  if (!(res.headers.get("content-type") ?? "").includes("application/json")) {
    return { blob: await res.blob(), timeline: null };
  }

  const data = await res.json();
  if (typeof data?.audio !== "string") throw new Error("TTS response had no audio");

  return {
    blob:     base64ToBlob(data.audio),
    timeline: data.alignment ? parseAlignment(data.alignment) : null,
  };
}

/**
 * fetchTts, but concurrent callers asking for the same (voice, text) share one
 * request instead of each paying for their own. See _inflight.
 */
function fetchTtsShared(text: string, voice: string): Promise<TtsAudio> {
  const k    = prefetchKey(voice, text);
  const live = _inflight.get(k);
  if (live) return live;

  const p = fetchTts(text, voice);
  _inflight.set(k, p);
  // Clear the slot once settled, without swallowing the result for the caller.
  p.then(
    () => { if (_inflight.get(k) === p) _inflight.delete(k); },
    () => { if (_inflight.get(k) === p) _inflight.delete(k); },
  );
  return p;
}

/** Detach + null the current play/ended/error handlers from the singleton audio element. */
function detachHandlers() {
  if (!_audio || !_activeHandlers) return;
  _audio.removeEventListener("play",  _activeHandlers.play);
  _audio.removeEventListener("ended", _activeHandlers.end);
  _audio.removeEventListener("error", _activeHandlers.error);
  _activeHandlers = null;
}

/** Returns the singleton audio element + lipsync, lazily creating them. */
function getAudioPipeline(): { audio: HTMLAudioElement; lipsync: Lipsync } | null {
  if (typeof window === "undefined") return null;

  if (!_audio) {
    _audio = document.createElement("audio");
    _audio.preload  = "auto";
    _audio.crossOrigin = "anonymous";
    _audio.style.display = "none";
    document.body.appendChild(_audio);
  }

  if (!_lipsync) {
    _lipsync = new Lipsync({ fftSize: 1024, historySize: 8 });
  }

  // connectAudio is NOT called here on purpose.
  //
  // wawa-lipsync v0.0.2 has a sequencing bug: connectAudio sets
  // `this.audioSource = element` BEFORE checking `if (!element.src)`.
  // If called with an empty src the element gets flagged as "already
  // connected" and the analyser is never wired up.  The actual
  // createMediaElementSource call is deferred to speak(), where we call
  // connectAudio AFTER audio.src is set to a valid blob URL.

  return { audio: _audio, lipsync: _lipsync };
}

/**
 * Per-frame viseme read. Returns the active viseme name (also the morph
 * target name on Avaturn ARKit-standard meshes) and a 0-1 intensity, or null
 * when nothing is playing.
 *
 * Call inside useFrame.
 */
export function getCurrentViseme(): { viseme: VISEMES; intensity: number } | null {
  if (!_audio) return null;
  if (_audio.paused || _audio.ended) return null;

  // Preferred source: real character timings from ElevenLabs, looked up by
  // playback position. The FFT can only guess a mouth shape from the frequency
  // profile of the current frame, so sounds that share a profile collapse onto
  // the same viseme -- an "m" and an "ah" can render identically. Timings say
  // what is actually being spoken and when.
  if (_timeline) {
    const hit = visemeAt(_timeline, _audio.currentTime);
    // null means this moment is silent -- let the caller close the mouth.
    return hit ? { viseme: hit.viseme as VISEMES, intensity: hit.intensity } : null;
  }

  // Fallback: wawa-lipsync's spectral guess. Used for live /api/tts audio and
  // for any pre-rendered segment that has no alignment sidecar yet.
  if (!_lipsync) return null;
  _lipsync.processAudio();
  const v = _lipsync.viseme;
  if (!v || v === VISEMES.sil) return null;

  // Volume from the analyzer's last extracted features. Clamp + normalise.
  const vol = _lipsync.features?.volume ?? 0;
  const intensity = Math.min(1, Math.max(0, vol * 4));
  return { viseme: v, intensity };
}

// ─── Voice mapping by avatar ──────────────────────────────────────────────────

// Voice keys sent to /api/tts — must match EL_VOICES keys in the route.
const VOICE_BY_AVATAR: Record<TeacherAvatar, string> = {
  ryan:   "ryan",
  sonia:  "sonia",
  marcus: "marcus",
  priya:  "priya",
  custom: "custom",
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface SpeakOptions {
  voice?:  string;
  onEnd?:  () => void;
  /**
   * Force the window.speechSynthesis fallback regardless of the
   * NEXT_PUBLIC_TTS env var. Set by the /demo route (demoMode) so a demo
   * session never calls /api/tts (ElevenLabs quota is shared with the
   * production teacher). Never set on the authed /learn path.
   */
  forceBrowser?: boolean;
  /**
   * Play this pre-rendered audio file instead of calling /api/tts. Set by the
   * /demo route, whose narration is rendered once by
   * scripts/prerender-demo-tts.mjs into public/demo/<slug>/<seg_id>.mp3.
   *
   * This routes demo playback back through the real audio element, which is
   * what wawa-lipsync analyses -- speechSynthesis exposes no audio buffer, so
   * the browser fallback leaves the avatar's mouth still. Costs no ElevenLabs
   * quota at runtime: the files are static and generated once.
   *
   * Takes precedence over forceBrowser. If the file is missing or will not
   * decode, playback falls back to speechSynthesis for that segment.
   *
   * If a `<segment>.align.json` sidecar sits next to the mp3 (written by the
   * same script's --align pass), it is loaded alongside and drives the avatar's
   * visemes from real character timings instead of the FFT guess. Entirely
   * optional -- without it playback and lipsync behave exactly as before.
   */
  srcUrl?: string;
}

export interface SpeakController {
  stop: () => void;
}

export function useTTS() {
  const setIsSpeaking = useAristoStore((s) => s.setIsSpeaking);
  const teacher       = useAristoStore((s) => s.teacher);
  const currentControllerRef = useRef<SpeakController | null>(null);
  // Lets the audio "error" handler re-enter speak() for the browser fallback
  // without making speak depend on itself.
  const speakRef = useRef<((text: string, opts?: SpeakOptions) => SpeakController) | null>(null);

  const stop = useCallback(() => {
    detachHandlers();
    // Invalidate any in-flight alignment fetch and drop the current timings, so
    // the next segment can never inherit the previous segment's mouth track.
    _visemeGen++;
    _timeline = null;
    // Nobody owns the element until the next speak() claims it.
    _activeSpeech = 0;
    if (_audio) {
      _audio.pause();
      _audio.currentTime = 0;
    }
    if (_activeUrl) {
      URL.revokeObjectURL(_activeUrl);
      _activeUrl = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    currentControllerRef.current = null;
  }, [setIsSpeaking]);

  const speak = useCallback(
    (text: string, opts: SpeakOptions = {}): SpeakController => {
      const cleaned = text.trim();
      if (!cleaned) {
        opts.onEnd?.();
        return { stop: () => {} };
      }

      // Always cancel anything in flight before starting.
      stop();

      const useBrowser =
        !opts.srcUrl &&
        (!!opts.forceBrowser ||
          (typeof process !== "undefined" &&
            process.env.NEXT_PUBLIC_TTS === "browser"));

      // Browser fallback path
      if (useBrowser) {
        if (typeof window === "undefined" || !window.speechSynthesis) {
          opts.onEnd?.();
          return { stop: () => {} };
        }
        const utt = new SpeechSynthesisUtterance(cleaned);
        utt.rate  = 1.05;
        utt.pitch = 1.05;
        let keepalive: ReturnType<typeof setInterval> | null = null;
        utt.onstart = () => {
          setIsSpeaking(true);
          // Chrome stops utterances after ~15s — pause/resume every 10s
          keepalive = setInterval(() => {
            if (!window.speechSynthesis.speaking) {
              if (keepalive) clearInterval(keepalive);
              return;
            }
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
          }, 10_000);
        };
        const finish = () => {
          if (keepalive) clearInterval(keepalive);
          setIsSpeaking(false);
          opts.onEnd?.();
        };
        utt.onend   = finish;
        utt.onerror = finish;
        window.speechSynthesis.speak(utt);
        const controller = { stop };
        currentControllerRef.current = controller;
        return controller;
      }

      // ElevenLabs path (audio element + viseme analysis)
      const pipeline = getAudioPipeline();
      if (!pipeline) {
        opts.onEnd?.();
        return { stop: () => {} };
      }
      const { audio } = pipeline;

      const voice = opts.voice ?? VOICE_BY_AVATAR[teacher] ?? "alloy";
      let cancelled = false;

      const controller: SpeakController = {
        stop: () => {
          cancelled = true;
          stop();
        },
      };
      currentControllerRef.current = controller;

      // Claim the audio element. stop() (called above) has already released it,
      // bumped the viseme generation and cleared the previous timeline.
      const speechId = ++_speechSeq;
      _activeSpeech  = speechId;

      (async () => {
        try {
          // Capture the generation so timings that arrive late cannot attach
          // themselves to whatever segment is playing by then.
          const gen = _visemeGen;

          let blobUrl: string | null = null;
          let url: string;

          if (opts.srcUrl) {
            // Pre-rendered file: no network call, no object URL to revoke. Its
            // timings live in a sidecar next to the mp3.
            url = opts.srcUrl;
            loadAlignment(opts.srcUrl, gen);
          } else {
            // If a prefetch for this text+voice already landed (or is in
            // flight), consume it instead of firing a second /api/tts request.
            const prefetched = consumePrefetched(voice, cleaned);
            const audioData  = await (prefetched ?? fetchTtsShared(cleaned, voice));
            if (cancelled) return;

            // Another caller claimed the element while this was in flight. Do
            // NOT touch audio.src — that is what used to abort whatever had
            // started playing. Tell this caller its turn is over so it does not
            // wait on an `ended` event that can never arrive.
            if (_activeSpeech !== speechId) {
              opts.onEnd?.();
              return;
            }

            if (gen === _visemeGen) _timeline = audioData.timeline;

            blobUrl    = URL.createObjectURL(audioData.blob);
            url        = blobUrl;
            _activeUrl = blobUrl;
          }
          audio.src = url;

          // Detach any prior listeners before we add new ones (defense-in-depth
          // — stop() already does this on the same path, but if play() was never
          // called for the previous request, no cleanup ever ran).
          detachHandlers();

          const releaseUrl = () => {
            if (blobUrl && _activeUrl === blobUrl) {
              URL.revokeObjectURL(blobUrl);
              _activeUrl = null;
            }
          };

          const onPlay = () => {
            if (_activeSpeech !== speechId) return;
            setIsSpeaking(true);
          };
          const onEnd  = () => {
            detachHandlers();
            releaseUrl();
            setIsSpeaking(false);
            opts.onEnd?.();
          };
          const onError = () => {
            detachHandlers();
            releaseUrl();
            setIsSpeaking(false);
            if (cancelled) return;
            // Superseded rather than genuinely broken: the new owner is already
            // playing, so release this caller quietly instead of retrying.
            if (_activeSpeech !== speechId) {
              opts.onEnd?.();
              return;
            }
            // A pre-rendered segment that will not load must not silently
            // vanish -- narrate it with speechSynthesis instead, so the demo
            // keeps its pacing rather than racing through in silence.
            if (opts.srcUrl) {
              console.warn(`[useTTS] pre-rendered audio failed (${opts.srcUrl}); using speechSynthesis`);
              speakRef.current?.(cleaned, { ...opts, srcUrl: undefined, forceBrowser: true });
              return;
            }
            opts.onEnd?.();
          };
          _activeHandlers = { play: onPlay, end: onEnd, error: onError };
          audio.addEventListener("play",  onPlay);
          audio.addEventListener("ended", onEnd);
          audio.addEventListener("error", onError);

          // Connect the analyser NOW — src is set, so wawa-lipsync won't bail
          // out early.  Must happen exactly once per audio element (the
          // createMediaElementSource call inside throws if called twice).
          if (!_connected && _lipsync) {
            try { _lipsync.connectAudio(audio); _connected = true; } catch {}
          }

          // wawa-lipsync calls audioContext.resume() inside connectAudio but
          // doesn't await it.  Explicitly await here so the analyser is
          // definitely running before the first useFrame tick reads it.
          if (_lipsync) {
            const ctx = (_lipsync as any).audioContext as AudioContext | undefined;
            if (ctx && ctx.state !== "running") {
              await ctx.resume().catch(() => {});
            }
          }

          await audio.play();
        } catch (err) {
          if (!cancelled) {
            console.error("[useTTS] speak failed", err);
            setIsSpeaking(false);
            opts.onEnd?.();
          }
        }
      })();

      return controller;
    },
    [stop, setIsSpeaking, teacher]
  );
  speakRef.current = speak;

  // Optional: warm a TTS fetch for an upcoming segment.  Callers that know
  // what they'll speak next (e.g. useLessonPlayback) can call this to mask
  // the ~0.5–1.5s ElevenLabs latency between segments.  No-op in browser
  // TTS mode (no network fetch to warm).
  const prefetch = useCallback(
    (text: string, opts: { voice?: string; forceBrowser?: boolean } = {}): void => {
      const cleaned = text.trim();
      if (!cleaned) return;

      const useBrowser =
        !!opts.forceBrowser ||
        (typeof process !== "undefined" &&
          process.env.NEXT_PUBLIC_TTS === "browser");
      if (useBrowser) return;

      const voice = opts.voice ?? VOICE_BY_AVATAR[teacher] ?? "alloy";
      if (_prefetchCache.has(prefetchKey(voice, cleaned))) return;

      storePrefetched(
        voice,
        cleaned,
        // Swallow prefetch errors — speak() will re-attempt on its own path.
        fetchTtsShared(cleaned, voice).catch(() => ({ blob: new Blob(), timeline: null })),
      );
    },
    [teacher]
  );

  // Stop on unmount only if this hook instance owns the active controller.
  useEffect(() => {
    return () => {
      if (currentControllerRef.current) {
        currentControllerRef.current.stop();
      }
    };
  }, []);

  return { speak, stop, prefetch };
}
