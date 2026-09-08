/**
 * Character-timing -> viseme timeline.
 *
 * ElevenLabs returns *character* timings, not phonemes: an array of
 * `{ text, start, end }` covering every character of the text that was spoken
 * (see `/v1/forced-alignment` and the `with-timestamps` TTS endpoints). This
 * module turns that into a small sorted list of viseme spans the avatar can be
 * driven from, replacing the FFT guess in wawa-lipsync.
 *
 * Why this is better than the FFT: wawa-lipsync infers a viseme from the
 * frequency profile of the current audio frame, so sounds that share a band
 * profile collapse onto the same mouth shape -- an "m" and an "ah" can render
 * identically. Character timings tell us what is actually being said and when,
 * so "m" closes the lips and "ah" opens the jaw.
 *
 * English orthography is not phonetic, so a character mapping is an
 * approximation too -- but a much closer one, and it is wrong in ways a viewer
 * does not notice (a silent "e", a soft "c") rather than in ways they do (lips
 * that never close on a "b").
 *
 * Pure logic, no DOM and no network: unit-tested in visemes.test.ts.
 */

/**
 * The 15 Oculus/ARKit viseme morph names carried by the Avaturn rigs. These
 * strings double as the morph target names on the mesh, so they must match
 * AVATURN_VISEMES in src/components/three/Teacher.tsx exactly.
 */
export type VisemeName =
  | "viseme_sil" | "viseme_PP" | "viseme_FF" | "viseme_TH" | "viseme_DD"
  | "viseme_kk"  | "viseme_CH" | "viseme_SS" | "viseme_nn" | "viseme_RR"
  | "viseme_aa"  | "viseme_E"  | "viseme_I"  | "viseme_O"  | "viseme_U";

/** One character's timing, as ElevenLabs returns it. */
export interface CharTiming {
  text:  string;
  start: number; // seconds
  end:   number; // seconds
}

/** A merged run of characters sharing one mouth shape. */
export interface VisemeSpan {
  viseme: VisemeName;
  start:  number; // seconds
  end:    number; // seconds
}

/**
 * Sentinel meaning "this character has no mouth shape of its own -- hold
 * whatever the previous one was". Used for apostrophes and intra-word hyphens,
 * which carry no sound but would otherwise punch a silence into the middle of
 * a word ("don't", "well-known").
 */
const CARRY = "__carry__" as const;

type Mapped = VisemeName | typeof CARRY;

/**
 * Digraphs, checked before the single-character table. Two letters that name
 * one sound: mapping them separately produces a visible wrong shape (the "t"
 * in "the" would close the tongue behind the teeth on a DD).
 */
const DIGRAPHS: Record<string, VisemeName> = {
  th: "viseme_TH",
  ch: "viseme_CH",
  sh: "viseme_CH",
  ph: "viseme_FF",
  wh: "viseme_U",
  ck: "viseme_kk",
  ng: "viseme_nn",
  qu: "viseme_kk",
};

const SINGLES: Record<string, Mapped> = {
  // vowels
  a: "viseme_aa", e: "viseme_E", i: "viseme_I", o: "viseme_O", u: "viseme_U",
  // bilabial stops + nasal: the lips must actually meet
  b: "viseme_PP", p: "viseme_PP", m: "viseme_PP",
  // labiodental
  f: "viseme_FF", v: "viseme_FF",
  // alveolar stops
  t: "viseme_DD", d: "viseme_DD",
  // velar
  k: "viseme_kk", g: "viseme_kk", c: "viseme_kk", q: "viseme_kk",
  // sibilants
  s: "viseme_SS", z: "viseme_SS", x: "viseme_SS",
  // postalveolar
  j: "viseme_CH",
  // nasal + lateral share a tongue-to-ridge shape close enough to read
  n: "viseme_nn", l: "viseme_nn",
  r: "viseme_RR",
  // glides
  w: "viseme_U", y: "viseme_I",
  // "h" is an open breathy channel -- an open jaw reads far better than a
  // closed mouth partway through a word
  h: "viseme_aa",
  // no sound of their own
  "'": CARRY, "’": CARRY, "-": CARRY,
};

/**
 * Map one character (with lookahead for digraphs) to a viseme.
 *
 * Returns the viseme plus how many characters it consumed, so the caller can
 * advance past the second half of a digraph.
 */
export function mapCharacter(ch: string, next?: string): { viseme: Mapped; consumed: number } {
  const c = ch.toLowerCase();

  if (next) {
    const pair = c + next.toLowerCase();
    const dg = DIGRAPHS[pair];
    if (dg) return { viseme: dg, consumed: 2 };
  }

  const single = SINGLES[c];
  if (single) return { viseme: single, consumed: 1 };

  // Digits are spoken aloud, so a closed mouth is the worse error -- an open
  // jaw at least moves in time with the audio.
  if (c >= "0" && c <= "9") return { viseme: "viseme_aa", consumed: 1 };

  // Whitespace, punctuation, anything unrecognised.
  return { viseme: "viseme_sil", consumed: 1 };
}

/**
 * Silences shorter than this are absorbed into the preceding span rather than
 * closing the mouth. Word boundaries in continuous speech are only a few tens
 * of milliseconds; snapping shut on each one produces a chattering jaw.
 * Real pauses -- sentence ends, commas -- are longer than this and survive.
 */
const MIN_SILENCE_S = 0.12;

/** Spans shorter than this are merged into their neighbour to stop jitter. */
const MIN_SPAN_S = 0.03;

/**
 * Build a merged, sorted viseme timeline from ElevenLabs character timings.
 *
 * Adjacent characters sharing a viseme collapse into one span, so "ll" in
 * "hello" is a single sustained shape rather than two identical restrikes.
 */
export function buildVisemeTimeline(characters: readonly CharTiming[]): VisemeSpan[] {
  const spans: VisemeSpan[] = [];

  for (let i = 0; i < characters.length; ) {
    const cur = characters[i];
    if (!cur || typeof cur.start !== "number" || typeof cur.end !== "number") { i++; continue; }

    const { viseme, consumed } = mapCharacter(cur.text, characters[i + 1]?.text);
    // A digraph's span runs to the end of its second character.
    const last  = characters[Math.min(i + consumed - 1, characters.length - 1)];
    const start = cur.start;
    const end   = Math.max(last.end, start);
    i += consumed;

    if (viseme === CARRY) {
      // Extend the previous shape over this character instead of emitting one.
      if (spans.length) spans[spans.length - 1].end = Math.max(spans[spans.length - 1].end, end);
      continue;
    }

    const prev = spans[spans.length - 1];
    if (prev && prev.viseme === viseme) {
      prev.end = Math.max(prev.end, end);   // collapse the run
    } else {
      spans.push({ viseme, start, end });
    }
  }

  return tidy(spans);
}

/**
 * Drop micro-silences and micro-spans, extending the previous span over them.
 * Runs until stable so a span left adjacent to its twin by a removal still
 * collapses.
 */
function tidy(input: VisemeSpan[]): VisemeSpan[] {
  const out: VisemeSpan[] = [];

  for (const span of input) {
    const dur  = span.end - span.start;
    const prev = out[out.length - 1];
    const tooShort =
      span.viseme === "viseme_sil" ? dur < MIN_SILENCE_S : dur < MIN_SPAN_S;

    if (prev && tooShort) {
      prev.end = Math.max(prev.end, span.end);
      continue;
    }
    if (prev && prev.viseme === span.viseme) {
      prev.end = Math.max(prev.end, span.end);
      continue;
    }
    out.push({ ...span });
  }

  return out;
}

/** Peak morph influence. Teacher.tsx scales by 1.4, so this still reaches full closure. */
const PEAK_INTENSITY = 0.85;
/** Ease in/out at span edges so morphs glide rather than pop. */
const EDGE_S = 0.025;

/**
 * The viseme active at time `t` (seconds into the clip), or null when the clip
 * is silent there or `t` falls outside it.
 *
 * Binary search: called once per rendered frame, so it must not scan.
 */
export function visemeAt(
  timeline: readonly VisemeSpan[],
  t: number,
): { viseme: VisemeName; intensity: number } | null {
  if (!timeline.length || !Number.isFinite(t)) return null;

  let lo = 0, hi = timeline.length - 1, found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const s = timeline[mid];
    if (t < s.start)     hi = mid - 1;
    else if (t >= s.end) lo = mid + 1;
    else { found = mid; break; }
  }
  if (found === -1) return null;

  const span = timeline[found];
  if (span.viseme === "viseme_sil") return null;

  // Ease over a window that never exceeds a third of the span, so very short
  // spans still reach a readable influence.
  const edge = Math.min(EDGE_S, (span.end - span.start) / 3);
  const ramp = edge > 0
    ? Math.min(1, (t - span.start) / edge, (span.end - t) / edge)
    : 1;

  return { viseme: span.viseme, intensity: PEAK_INTENSITY * Math.max(0, ramp) };
}

/**
 * Where the alignment sidecar for a pre-rendered segment lives.
 *
 * `scripts/prerender-demo-tts.mjs --align` writes `<seg_id>.align.json` next to
 * `<seg_id>.mp3`, so the URL is the audio URL with its extension swapped. Any
 * query string is dropped -- the sidecar is a plain static file.
 *
 * Returns null when the input is not an mp3 URL, so callers can skip the fetch
 * entirely rather than requesting something that cannot exist.
 */
export function alignmentUrlFor(srcUrl: string): string | null {
  const m = /^([^?#]+)\.mp3(?:[?#].*)?$/i.exec(srcUrl);
  return m ? `${m[1]}.align.json` : null;
}

/**
 * Normalise either ElevenLabs alignment shape into `CharTiming[]`.
 *
 * The two endpoints disagree about their payload, and we consume both:
 *
 *   Forced Alignment  ->  characters: [{ text, start, end }, ...]
 *   TTS with-timestamps -> characters: ["H", "i"],
 *                          character_start_times_seconds: [0, 0.05],
 *                          character_end_times_seconds:   [0.05, 0.2]
 *
 * Returns null on any inconsistency (mismatched array lengths, non-finite
 * times, an end before its start) rather than guessing.
 */
function toCharTimings(obj: Record<string, unknown>): CharTiming[] | null {
  const characters = obj.characters;
  if (!Array.isArray(characters) || characters.length === 0) return null;

  // with-timestamps: three parallel arrays.
  if (typeof characters[0] === "string") {
    const starts = obj.character_start_times_seconds;
    const ends   = obj.character_end_times_seconds;
    if (!Array.isArray(starts) || !Array.isArray(ends))     return null;
    if (starts.length !== characters.length)                return null;
    if (ends.length   !== characters.length)                return null;

    const out: CharTiming[] = [];
    for (let i = 0; i < characters.length; i++) {
      const text = characters[i], start = starts[i], end = ends[i];
      if (typeof text !== "string")                          return null;
      if (!Number.isFinite(start) || !Number.isFinite(end))  return null;
      if (end < start)                                       return null;
      out.push({ text, start, end });
    }
    return out;
  }

  // Forced Alignment: one object per character.
  const out: CharTiming[] = [];
  for (const c of characters) {
    if (!c || typeof c !== "object") return null;
    const { text, start, end } = c as CharTiming;
    if (typeof text !== "string")                         return null;
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    if (end < start)                                      return null;
    out.push({ text, start, end });
  }
  return out;
}

/**
 * Validate a parsed alignment payload and turn it into a viseme timeline.
 *
 * Accepts either endpoint's shape (see toCharTimings). Returns null for
 * anything that is not a usable ElevenLabs alignment, so a truncated download,
 * a 404 HTML body, or a hand-made placeholder degrades to the FFT path rather
 * than driving the mouth from nonsense.
 */
export function parseAlignment(raw: unknown): VisemeSpan[] | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  // Only trust files a real alignment run produced. Payloads that come straight
  // off the API carry no `generator`, so absence is fine -- this rejects a
  // placeholder that claims to be something else.
  if (typeof obj.generator === "string" && !obj.generator.startsWith("elevenlabs")) return null;

  const chars = toCharTimings(obj);
  if (!chars) return null;

  const timeline = buildVisemeTimeline(chars);
  return timeline.length ? timeline : null;
}
