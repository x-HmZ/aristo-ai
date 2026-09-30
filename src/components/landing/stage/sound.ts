/**
 * The landing's spoken lines (V8.3b): the heart demo's real narration, never anything else.
 *
 * A line plays on a clock, silent by default: its player (the hero's line card, the lesson) says which segment is
 * being spoken and how far in, every frame (`speak`). The words light, and Jake's mouth moves, from the recording's
 * own character timings (the `.align.json` sidecar, through src/lib/lipsync), so a silent line looks spoken at the
 * real pace. "Hear it" turns the sound on: the same line's pre-rendered mp3 then plays along, and its time leads.
 *
 * Its own <audio> element, not useTTS: that hook falls back to the browser's speech synthesis when a file fails,
 * and the landing must only ever play the recorded demo audio. It never calls an API.
 */
import { parseAlignment, visemeAt, type VisemeSpan } from "@/lib/lipsync/visemes";
import { shared } from "./shared";

const SEGMENT = /^seg_\d{3}$/;

export interface Word { start: number; end: number }
export interface LineData { timeline: VisemeSpan[] | null; words: Word[] }

/** Word spans from the character timings: a word starts at a non-space character after a space. */
export function wordsOf(chars: readonly { text: string; start: number; end: number }[]): Word[] {
  const out: Word[] = [];
  let inWord = false;
  for (const c of chars) {
    const space = /\s/.test(c.text);
    if (!space && !inWord) out.push({ start: c.start, end: c.end });
    else if (!space) out[out.length - 1].end = c.end;
    inWord = !space;
  }
  return out;
}

/** How many of the words have started by `t` (for the caption: the last one is the word being said). */
export function wordsSpoken(words: readonly Word[], t: number): number {
  let n = 0;
  while (n < words.length && words[n].start <= t) n++;
  return n;
}

const cache = new Map<string, Promise<LineData>>();
const ready = new Map<string, LineData>();

/** A segment's timings, fetched once (6 to 9 kB each). A missing sidecar gives a line with no words. */
export function loadLine(segment: string): Promise<LineData> {
  if (!SEGMENT.test(segment)) return Promise.resolve({ timeline: null, words: [] });
  let p = cache.get(segment);
  if (!p) {
    p = fetch(`/demo/heart/${segment}.align.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((raw: unknown): LineData => {
        const chars = raw && typeof raw === "object" ? (raw as { characters?: unknown }).characters : null;
        const valid = Array.isArray(chars)
          ? chars.filter((c): c is { text: string; start: number; end: number } =>
            !!c && typeof c === "object" && typeof (c as { text?: unknown }).text === "string"
            && typeof (c as { start?: unknown }).start === "number" && typeof (c as { end?: unknown }).end === "number")
          : [];
        return { timeline: raw ? parseAlignment(raw) : null, words: wordsOf(valid) };
      })
      .catch(() => ({ timeline: null, words: [] }));
    cache.set(segment, p);
    void p.then((d) => ready.set(segment, d));
  }
  return p;
}

export const lineData = (segment: string): LineData | null => ready.get(segment) ?? null;

// ─── What is being said now ─────────────────────────────────────────────────

let saying: { segment: string; t: number } | null = null;

/** The player's report, every frame: the segment being spoken and seconds into it, or null for silence. */
export function speak(segment: string | null, t = 0): void {
  saying = segment ? { segment, t } : null;
  shared.speaking = !!segment;
}

/** The mouth shape now, for the teacher's driver. */
export function visemeNow(): { viseme: string; intensity: number } | null {
  if (!saying) return null;
  const d = ready.get(saying.segment);
  return d?.timeline ? visemeAt(d.timeline, saying.t) : null;
}

// ─── Sound ("Hear it") ───────────────────────────────────────────────────────

let audio: HTMLAudioElement | null = null;
let soundOn = false;
let loaded: string | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const isSoundOn = (): boolean => soundOn;

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function stopAudio() {
  loaded = null;
  if (audio) { audio.pause(); audio.removeAttribute("src"); audio.load(); }
}

/** The "Hear it" toggle. Off stops at once. */
export function setSound(on: boolean): void {
  if (soundOn === on) return;
  soundOn = on;
  if (!on) stopAudio();
  notify();
}

/**
 * Keep the sound with the line, once per frame from the player: while the sound is on and the line plays, its mp3
 * plays from `t`; otherwise it is paused. Returns the recording's own time when it is playing this segment (the
 * player then follows it), else null.
 */
export function syncAudio(segment: string | null, t: number, playing: boolean): number | null {
  if (!soundOn || !segment || !playing || !SEGMENT.test(segment)) {
    if (audio && !audio.paused) audio.pause();
    if (!segment) loaded = null;
    return null;
  }
  audio ??= new Audio();
  if (loaded !== segment) {
    loaded = segment;
    audio.preload = "auto";
    // A media fragment starts it at the line's time now (setting currentTime before the metadata loads is ignored).
    audio.src = `/demo/heart/${segment}.mp3#t=${Math.max(0, t).toFixed(2)}`;
    void audio.play().catch(() => {});
    return null;
  }
  if (audio.paused && !audio.ended) {
    if (Math.abs(audio.currentTime - t) > 0.25) audio.currentTime = Math.max(0, t);
    void audio.play().catch(() => {});
    return null;
  }
  return audio.paused ? null : audio.currentTime;
}

/** Leaving the page: silence. */
export function stopAll(): void {
  soundOn = false;
  saying = null;
  shared.speaking = false;
  stopAudio();
  notify();
}
