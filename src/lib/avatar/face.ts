/**
 * Face layer maths (V9.4): the director's expression hint as a smile amount,
 * and the blink. Pure, like director.ts and look.ts: the renderer reads the
 * numbers and writes them into the morph targets.
 *
 * The Canino rigs (Jake, MJ) carry the 14 visemes, `mouthSmile` and
 * `eyeBlinkLeft/Right` and nothing else: no brow, frown or eye-look shapes.
 * So the four hints are told apart by the smile alone, plus the eyes for
 * "thinking" (an averted gaze, see gaze.ts). That is deliberate: inventing
 * expressions the rig cannot make would mean editing the meshes.
 */
import type { FaceHint } from "./animationManifest";

/** `mouthSmile` influence for each hint when the teacher is not speaking. */
export const SMILE_REST: Record<FaceHint, number> = {
  neutral:  0.15, // the existing resting smile: the face must not read as dead
  smile:    0.6,  // greeting, correct, quiz good
  warm:     0.35, // wrong, quiz supportive: kind, not celebrating
  thinking: 0.03, // a flat, attentive mouth
};

/**
 * While speaking, the smile stays small: the visemes own the mouth, and a wide
 * smile under a rounded "oo" distorts it. A hint still shows, as a lift.
 */
export const SMILE_SPEAKING: Record<FaceHint, number> = {
  neutral:  0,
  smile:    0.2,
  warm:     0.1,
  thinking: 0,
};

/** Rates, 1/s. Out of the way fast when speech starts; expression eases in slowly. */
export const SMILE_RATE_IN  = 3.5;
export const SMILE_RATE_OUT = 9;

export function smileTarget(face: FaceHint, speaking: boolean): number {
  return (speaking ? SMILE_SPEAKING : SMILE_REST)[face];
}

/** One smile step: frame-rate independent, fast down and slow up. */
export function stepSmile(current: number, face: FaceHint, speaking: boolean, dt: number): number {
  const target = smileTarget(face, speaking);
  const rate = target < current ? SMILE_RATE_OUT : SMILE_RATE_IN;
  return current + (target - current) * (1 - Math.exp(-rate * Math.max(0, dt)));
}

// ─── Blink ───────────────────────────────────────────────────────────────────

/** Lids close faster than they open. Seconds. */
export const BLINK_CLOSE_S = 0.06;
export const BLINK_OPEN_S  = 0.12;
export const BLINK_GAP_S   = { min: 1.5, max: 5 } as const;
/** Chance a blink is followed at once by a second. */
export const BLINK_DOUBLE_CHANCE = 0.15;
export const BLINK_DOUBLE_GAP_S  = 0.22;

export interface BlinkState {
  /** When the next blink starts; while one is running, when it started. */
  at:      number;
  running: boolean;
  /** The blink that ends now is followed by another one. */
  double:  boolean;
}

export function createBlinkState(now: number, rng: () => number): BlinkState {
  return { at: now + gap(rng), running: false, double: false };
}

function gap(rng: () => number): number {
  return BLINK_GAP_S.min + rng() * (BLINK_GAP_S.max - BLINK_GAP_S.min);
}

/** Lid closure, 0 open to 1 shut, over the blink's first BLINK_CLOSE_S + BLINK_OPEN_S. */
export function blinkShape(t: number): number {
  if (t <= 0 || t >= BLINK_CLOSE_S + BLINK_OPEN_S) return 0;
  const x = t < BLINK_CLOSE_S ? t / BLINK_CLOSE_S : 1 - (t - BLINK_CLOSE_S) / BLINK_OPEN_S;
  return x * x * (3 - 2 * x); // smoothstep
}

/** The blink at time `now`: the new state and the lid closure to apply. */
export function stepBlink(s: BlinkState, now: number, rng: () => number): { state: BlinkState; closure: number } {
  if (!s.running) {
    if (now < s.at) return { state: s, closure: 0 };
    s = { at: now, running: true, double: rng() < BLINK_DOUBLE_CHANCE };
  }
  const t = now - s.at;
  if (t < BLINK_CLOSE_S + BLINK_OPEN_S) return { state: s, closure: blinkShape(t) };
  // Done: schedule the next one.
  const next = s.double ? now + BLINK_DOUBLE_GAP_S - (BLINK_CLOSE_S + BLINK_OPEN_S) : now + gap(rng);
  return { state: { at: Math.max(next, now), running: false, double: false }, closure: 0 };
}
