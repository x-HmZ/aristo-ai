/**
 * The landing's small maths (V8.3b): progress through a span, easing, and frame-rate independent damping. Pure;
 * unit-tested.
 */

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Progress of `v` through [a, b], clamped. */
export const seg = (v: number, a: number, b: number): number => clamp01((v - a) / (b - a));
export const smooth = (t: number): number => t * t * (3 - 2 * t);
export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Frame-rate independent exponential approach (the classroom's CameraController damping); a long frame is capped. */
export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  current + (target - current) * (1 - Math.exp(-lambda * Math.min(dt, 0.1)));
