"use client";

/**
 * useTTS — central client-side TTS playback + viseme analyzer.
 *
 * Replaces the Web Speech API helpers in LessonView.tsx and InputBox.tsx so
 * we get:
 *   • higher-quality voices (OpenAI gpt-4o-mini-tts)
 *   • access to the audio buffer (Web Speech does not expose it), which lets
 *     wawa-lipsync analyze frequency bands and emit per-frame visemes that
 *     drive the avatar's mouth morphs.
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

// ─── Singletons (browser-only — guarded) ──────────────────────────────────────

let _audio:    HTMLAudioElement | null = null;
let _lipsync:  Lipsync          | null = null;
let _connected = false;
let _activeUrl: string | null = null;
let _activeHandlers: { play: () => void; end: () => void } | null = null;

// ─── Prefetch cache ───────────────────────────────────────────────────────────
//
// Optional warm cache for the NEXT segment's TTS audio while the CURRENT
// one is playing.  Hides the 0.5–1.5s ElevenLabs fetch between segments in
// the adaptive playback engine.  Key = `${voice}|${text}` — voice matters
// because the same text can hit different ElevenLabs voices per avatar.
//
// LRU-ish with a single-slot bias — we generally only prefetch one segment
// ahead, but a tiny ring buffer protects against rapid skip/prev clicks.

const PREFETCH_MAX = 4;
const _prefetchCache = new Map<string, Promise<Blob>>();

function prefetchKey(voice: string, text: string): string {
  return `${voice}|${text}`;
}

function consumePrefetched(voice: string, text: string): Promise<Blob> | null {
  const k = prefetchKey(voice, text);
  const hit = _prefetchCache.get(k);
  if (!hit) return null;
  _prefetchCache.delete(k);
  return hit;
}

function storePrefetched(voice: string, text: string, blobPromise: Promise<Blob>): void {
  const k = prefetchKey(voice, text);
  if (_prefetchCache.has(k)) return; // dedupe
  if (_prefetchCache.size >= PREFETCH_MAX) {
    const oldest = _prefetchCache.keys().next().value;
    if (oldest) _prefetchCache.delete(oldest);
  }
  _prefetchCache.set(k, blobPromise);
}

/** Detach + null the current play/ended/error handlers from the singleton audio element. */
function detachHandlers() {
  if (!_audio || !_activeHandlers) return;
  _audio.removeEventListener("play",  _activeHandlers.play);
  _audio.removeEventListener("ended", _activeHandlers.end);
  _audio.removeEventListener("error", _activeHandlers.end);
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
  if (!_lipsync || !_audio) return null;
  if (_audio.paused || _audio.ended) return null;

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
}

export interface SpeakController {
  stop: () => void;
}

export function useTTS() {
  const setIsSpeaking = useAristoStore((s) => s.setIsSpeaking);
  const teacher       = useAristoStore((s) => s.teacher);
  const currentControllerRef = useRef<SpeakController | null>(null);

  const stop = useCallback(() => {
    detachHandlers();
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
        !!opts.forceBrowser ||
        (typeof process !== "undefined" &&
          process.env.NEXT_PUBLIC_TTS === "browser");

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

      // OpenAI TTS path
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

      (async () => {
        try {
          // If a prefetch for this text+voice already landed (or is in flight),
          // consume it instead of firing a second /api/tts request.
          let blob: Blob;
          const prefetched = consumePrefetched(voice, cleaned);
          if (prefetched) {
            blob = await prefetched;
          } else {
            const res = await fetch("/api/tts", {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({ text: cleaned, voice }),
            });
            if (cancelled) return;
            if (!res.ok) throw new Error(`TTS ${res.status}`);

            blob = await res.blob();
          }
          if (cancelled) return;

          const url = URL.createObjectURL(blob);
          _activeUrl = url;
          audio.src = url;

          // Detach any prior listeners before we add new ones (defense-in-depth
          // — stop() already does this on the same path, but if play() was never
          // called for the previous request, no cleanup ever ran).
          detachHandlers();

          const onPlay = () => setIsSpeaking(true);
          const onEnd  = () => {
            detachHandlers();
            if (_activeUrl === url) {
              URL.revokeObjectURL(url);
              _activeUrl = null;
            }
            setIsSpeaking(false);
            opts.onEnd?.();
          };
          _activeHandlers = { play: onPlay, end: onEnd };
          audio.addEventListener("play",  onPlay);
          audio.addEventListener("ended", onEnd);
          audio.addEventListener("error", onEnd);

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
        fetch("/api/tts", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ text: cleaned, voice }),
        })
          .then((r) => {
            if (!r.ok) throw new Error(`TTS prefetch ${r.status}`);
            return r.blob();
          })
          // Swallow prefetch errors — speak() will re-attempt on its own path.
          .catch(() => new Blob())
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
