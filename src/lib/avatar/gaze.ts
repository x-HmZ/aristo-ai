/**
 * Eye gaze maths (V9.4). The head turns partway toward the look target
 * (look.ts); the eyes make up the rest of the way, inside a small clamp, and
 * add the two things that make eyes read as alive: saccades (tiny quick jumps
 * to a new point, then a hold) and a slow drift. All subtle on purpose: a
 * teacher whose eyes dart reads as anxious.
 *
 * Pure, angles in radians, yaw positive toward +X and pitch positive up, the
 * same convention as look.ts. The renderer turns the result into rotations of
 * the two eye bones.
 */
import { yawPitchOf, type Vec3 } from "./look";

const DEG = Math.PI / 180;

export interface Gaze { yaw: number; pitch: number }

/** How far the eyes can turn from the head's forward. Small: no wall-eyed stare. */
export const GAZE_LIMITS: Gaze = { yaw: 14 * DEG, pitch: 9 * DEG };

/** Share of the remaining error the eyes close toward the target (the head did part). */
export const EYE_WEIGHT = { camera: 0.8, board: 0.8, model: 0.8, desk: 0.8, none: 0 } as const;

/** Response rate of the eyes, 1/s. Eyes are quick: a saccade lands in about 0.05 s. */
export const EYE_RATE = 30;

/** Largest saccade from the held point, each axis. */
export const SACCADE_AMPLITUDE: Gaze = { yaw: 3.5 * DEG, pitch: 2 * DEG };
/** Seconds between saccades. */
export const SACCADE_GAP_S = { min: 0.6, max: 2.8 } as const;
/** The averted gaze of "thinking": up and to one side, like recalling something. */
export const THINK_AVERT: Gaze = { yaw: 13 * DEG, pitch: 8 * DEG };
/** Drift amplitude. */
export const DRIFT: Gaze = { yaw: 1 * DEG, pitch: 0.6 * DEG };

export interface GazeState {
  /** When the next saccade fires. */
  nextAt: number;
  /** The saccade's held offset. */
  hold:   Gaze;
  /** Which side "thinking" looks to: 1 or -1. Chosen once per teacher. */
  side:   1 | -1;
}

export function createGazeState(now: number, rng: () => number): GazeState {
  return { nextAt: now + gap(rng), hold: { yaw: 0, pitch: 0 }, side: rng() < 0.5 ? -1 : 1 };
}

function gap(rng: () => number): number {
  return SACCADE_GAP_S.min + rng() * (SACCADE_GAP_S.max - SACCADE_GAP_S.min);
}

/** A saccade fires when its time comes: a new held offset, uniform inside the amplitude. */
export function stepSaccade(s: GazeState, now: number, rng: () => number): GazeState {
  if (now < s.nextAt) return s;
  return {
    ...s,
    nextAt: now + gap(rng),
    hold: {
      yaw:   (rng() * 2 - 1) * SACCADE_AMPLITUDE.yaw,
      pitch: (rng() * 2 - 1) * SACCADE_AMPLITUDE.pitch,
    },
  };
}

/** Slow drift at time `t` (seconds): two incommensurate sines per axis, so it never loops visibly. */
export function driftAt(t: number): Gaze {
  return {
    yaw:   DRIFT.yaw   * (0.6 * Math.sin(0.37 * t) + 0.4 * Math.sin(0.91 * t + 1.3)),
    pitch: DRIFT.pitch * (0.6 * Math.sin(0.29 * t + 0.7) + 0.4 * Math.sin(0.83 * t)),
  };
}

/**
 * The angles from the head's forward to a target: `dir` is the direction to
 * it in the head's bind-pose frame (+Z forward, +Y up). Null when there is no
 * target, or it is behind the head: the eyes then only idle.
 */
export function eyeAim(dir: Vec3 | null): Gaze | null {
  if (!dir) return null;
  const a = yawPitchOf(dir);
  return Math.abs(a.yaw) > Math.PI / 2 ? null : a;
}

function clamp(v: number, lim: number): number {
  return Math.max(-lim, Math.min(lim, v));
}

/**
 * The eye target for this frame: the pull toward the look target (weighted,
 * clamped), the saccade's held offset, the drift, and the averted gaze when
 * thinking, clamped again as a whole.
 */
export function gazeTarget(
  aim: Gaze | null,
  weight: number,
  s: GazeState,
  t: number,
  thinking: boolean,
): Gaze {
  const pull = aim && weight > 0
    ? { yaw: clamp(aim.yaw, GAZE_LIMITS.yaw) * weight, pitch: clamp(aim.pitch, GAZE_LIMITS.pitch) * weight }
    : { yaw: 0, pitch: 0 };
  const d = driftAt(t);
  const avert = thinking ? { yaw: THINK_AVERT.yaw * s.side, pitch: THINK_AVERT.pitch } : { yaw: 0, pitch: 0 };
  return {
    yaw:   clamp(pull.yaw   + s.hold.yaw   + d.yaw   + avert.yaw,   GAZE_LIMITS.yaw),
    pitch: clamp(pull.pitch + s.hold.pitch + d.pitch + avert.pitch, GAZE_LIMITS.pitch),
  };
}
