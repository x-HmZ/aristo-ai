/**
 * The opening's clock (V8.3c, "Spark to Teacher"), in seconds. Five shapes, each formed by a morph and then held:
 *   1. a spark draws the Column mark, and its flute lights;
 *   2. the mark bursts into the question;
 *   3. the question breaks into the lesson's ideas, linked (the map);
 *   4. they fold into a brain, turning (the model);
 *   5. it pours into the hero and becomes the teacher's poster, while the page's lights come on.
 * About five seconds; a skip runs the rest at SKIP_RATE. Pure: unit-tested.
 */

export const BEATS = [
  { shape: "mark", from: 0.15, to: 0.95, spread: 0.75, swirl: 14 },
  { shape: "question", from: 1.15, to: 1.75, spread: 0.3, swirl: 70 },
  { shape: "ideas", from: 2.3, to: 2.8, spread: 0.25, swirl: 50 },
  { shape: "brain", from: 3.15, to: 3.7, spread: 0.3, swirl: 60 },
  { shape: "teacher", from: 4.0, to: 4.7, spread: 0.45, swirl: 34 },
] as const;
export type Shape = (typeof BEATS)[number]["shape"];

/** The ideas' links come in and go, the cover lifts (the page's lights), the headline rises, the points fade. */
export const LINKS = { in: [2.55, 2.85], out: [3.05, 3.3] } as const;
export const COVER = [4.6, 5.05] as const;
export const HEADLINE_AT = 4.7;
export const FADE = [4.9, 5.25] as const;
export const LENGTH = 5.25;
/** A skip (the button, Esc, a scroll, a tap) runs what is left this many times faster: never a cut. */
export const SKIP_RATE = 5;
/** The brain turns from a three-quarter view, at this rate (rad/s), from the moment it starts forming. */
export const BRAIN_TURN = { from: -Math.PI / 2 - 0.55, rate: 0.6 } as const;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const ramp = (t: number, [a, b]: readonly [number, number]) => clamp01((t - a) / (b - a));

/** The beat being formed or held at `t` (the last one whose morph has started; -1 before the first). */
export function beatAt(t: number): number {
  let i = -1;
  while (i + 1 < BEATS.length && t >= BEATS[i + 1].from) i++;
  return i;
}

/** How far the current beat's morph is (0 to 1), and its index. */
export function morphAt(t: number): { beat: number; k: number } {
  const beat = beatAt(t);
  if (beat < 0) return { beat, k: 0 };
  const b = BEATS[beat];
  return { beat, k: clamp01((t - b.from) / (b.to - b.from)) };
}

/** The brain's turn at `t`. */
export const brainTurn = (t: number): number => BRAIN_TURN.from + BRAIN_TURN.rate * Math.max(0, t - BEATS[3].from);
