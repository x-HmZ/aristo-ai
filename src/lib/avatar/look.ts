/**
 * Look-at maths for the head (V9.3, catalogue rows 8-10, 12, 15, 21). Pure:
 * vectors are plain objects, angles radians. The renderer converts the
 * target into the teacher's own space (+Z forward, +Y up, the glTF
 * convention the rigs are exported in) and applies the result to the head
 * bone after the mixer each frame.
 *
 * The head keeps the clip's own motion and is turned only part of the way
 * toward the target, inside a clamp: a full lock reads as a mannequin, and
 * a target behind the shoulder must not wring the neck.
 */

export interface Vec3 { x: number; y: number; z: number }

export interface LookLimits {
  /** Largest yaw from the body's forward, either side. */
  yaw:   number;
  /** Largest pitch, up or down. */
  pitch: number;
}

const DEG = Math.PI / 180;

export const LOOK_LIMITS: LookLimits = { yaw: 40 * DEG, pitch: 25 * DEG };

/**
 * Share of the way the head turns toward each target. The camera is the
 * student: steady but not locked. Board, model and desk are things the
 * teacher is deliberately looking at.
 */
export const LOOK_WEIGHT = { camera: 0.5, board: 0.7, model: 0.7, desk: 0.7, none: 0 } as const;

/** Response rate of the head, 1/s: about 0.3 s to settle most of the way. */
export const LOOK_RATE = 8;

/** Yaw (about +Y, positive toward +X) and pitch (positive up) of a direction. */
export function yawPitchOf(dir: Vec3): { yaw: number; pitch: number } {
  const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
  return {
    yaw:   Math.atan2(dir.x, dir.z),
    pitch: Math.asin(Math.max(-1, Math.min(1, dir.y / len))),
  };
}

/**
 * The head's aim toward `target` (a direction in the teacher's space), or
 * null when it is out of reach: behind the shoulder, well past the clamp.
 * Just past the clamp the head stops at the limit; far past it, turning
 * that far would read as straining after something, so it lets go.
 */
export function aimAngles(target: Vec3, limits: LookLimits = LOOK_LIMITS): { yaw: number; pitch: number } | null {
  const { yaw, pitch } = yawPitchOf(target);
  if (Math.abs(yaw) > limits.yaw * 2 || Math.abs(pitch) > limits.pitch * 2) return null;
  return {
    yaw:   Math.max(-limits.yaw, Math.min(limits.yaw, yaw)),
    pitch: Math.max(-limits.pitch, Math.min(limits.pitch, pitch)),
  };
}

/**
 * The extra rotation to add on top of the clip's head: `weight` of the way
 * from where the clip aims to `aim`. Both in the teacher's space.
 */
export function lookOffset(
  clip: { yaw: number; pitch: number },
  aim: { yaw: number; pitch: number } | null,
  weight: number,
): { yaw: number; pitch: number } {
  if (!aim || weight <= 0) return { yaw: 0, pitch: 0 };
  return { yaw: (aim.yaw - clip.yaw) * weight, pitch: (aim.pitch - clip.pitch) * weight };
}

/** Frame-rate independent approach of `current` to `target`. */
export function damp(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * Math.max(0, dt)));
}
