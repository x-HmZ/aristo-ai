/**
 * The landing's opt-in sound (V8.3): the heart demo's pre-rendered narration, never anything else. Off until the
 * reader presses "Hear it"; while on, the line of the beat on screen plays (a new beat swaps it, leaving the
 * section stops it). The mouth follows the recording's own character timings (the `.align.json` sidecar, through
 * the pure helpers in src/lib/lipsync); a missing sidecar just leaves the mouth still.
 *
 * Its own <audio> element, not useTTS: that hook falls back to the browser's speech synthesis when a file fails,
 * and the landing must only ever play the recorded demo audio. It never calls an API.
 */
import { parseAlignment, visemeAt, type VisemeSpan } from "@/lib/lipsync/visemes";
import { shared } from "./shared";

const SEGMENT = /^seg_\d{3}$/;

let audio: HTMLAudioElement | null = null;
let enabled = false;
let current: string | null = null;
let timeline: VisemeSpan[] | null = null;
/** Seconds at which each word of the current line starts. */
let wordStarts: number[] = [];
let gen = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const isEnabled = (): boolean => enabled;
export const playing = (): string | null => (audio && !audio.paused ? current : null);

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Word start times from the character timings: a word starts at a non-space character after a space. */
export function wordStartsOf(chars: readonly { text: string; start: number }[]): number[] {
  const out: number[] = [];
  let inWord = false;
  for (const c of chars) {
    const space = /\s/.test(c.text);
    if (!space && !inWord) out.push(c.start);
    inWord = !space;
  }
  return out;
}

function stopAudio() {
  gen++;
  timeline = null;
  wordStarts = [];
  current = null;
  if (audio) { audio.pause(); audio.removeAttribute("src"); audio.load(); }
  shared.speaking = false;
}

function start(segment: string) {
  if (!SEGMENT.test(segment)) return;
  stopAudio();
  const g = gen;
  current = segment;
  audio ??= new Audio();
  audio.preload = "auto";
  audio.onended = () => { if (g === gen) { shared.speaking = false; notify(); } };
  audio.onplay = () => { if (g === gen) { shared.speaking = true; notify(); } };
  audio.onpause = () => { if (g === gen) { shared.speaking = false; notify(); } };
  audio.src = `/demo/heart/${segment}.mp3`;
  void audio.play().catch(() => { if (g === gen) { shared.speaking = false; notify(); } });
  void fetch(`/demo/heart/${segment}.align.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((raw: unknown) => {
      if (g !== gen || !raw) return;
      timeline = parseAlignment(raw);
      const chars = (raw as { characters?: unknown }).characters;
      if (Array.isArray(chars)) {
        wordStarts = wordStartsOf(chars.filter((c): c is { text: string; start: number } =>
          !!c && typeof c === "object" && typeof (c as { text?: unknown }).text === "string" && typeof (c as { start?: unknown }).start === "number"));
      }
    })
    .catch(() => {});
}

/** The "Hear it" toggle. Turning it on plays the line on screen now. */
export function setEnabled(on: boolean, segment: string | null): void {
  enabled = on;
  if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; pending = null; }
  if (!on) stopAudio();
  else if (segment) start(segment);
  notify();
}

/** A line starts only once its beat has held this long, so scrolling past a move neither plays nor fetches it. */
const SETTLE_MS = 350;
let pending: string | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

/** Called by the beats each frame: the line that belongs on screen (null when none does). */
export function want(segment: string | null): void {
  if (!enabled) return;
  if (segment === current) { if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; pending = null; } return; }
  if (!segment) { if (pendingTimer) clearTimeout(pendingTimer); pendingTimer = null; pending = null; stopAudio(); notify(); return; }
  if (segment === pending) return;
  // A new line: stop the old one now, start this one if the reader stays on it.
  if (current) { stopAudio(); notify(); }
  if (pendingTimer) clearTimeout(pendingTimer);
  pending = segment;
  pendingTimer = setTimeout(() => { pendingTimer = null; const s = pending; pending = null; if (enabled && s) start(s); }, SETTLE_MS);
}

/** How many words of the current line have been spoken (for the caption highlight). */
export function spokenWords(segment: string): number {
  if (!audio || current !== segment || !wordStarts.length) return 0;
  const t = audio.currentTime;
  if (audio.ended) return wordStarts.length;
  let n = 0;
  while (n < wordStarts.length && wordStarts[n] <= t) n++;
  return n;
}

/** The mouth shape now, for the teacher's driver. */
export function visemeNow(): { viseme: string; intensity: number } | null {
  if (!audio || audio.paused || !timeline) return null;
  return visemeAt(timeline, audio.currentTime);
}
