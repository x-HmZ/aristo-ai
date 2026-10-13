/**
 * A sliding-window limit on widget GENERATIONS per learner (cache hits are free
 * and never counted). Instance-local and best effort: a serverless instance
 * forgets, which is acceptable for a cost guard behind the approval gate.
 */

export interface Throttle {
  /** Records an attempt for `key` at `now`; false when the key is over the limit. */
  take(key: string, now?: number): boolean;
}

export function createThrottle(limit: number, windowMs: number): Throttle {
  const hits = new Map<string, number[]>();
  return {
    take(key, now = Date.now()) {
      const live = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (live.length >= limit) {
        hits.set(key, live);
        return false;
      }
      live.push(now);
      hits.set(key, live);
      return true;
    },
  };
}
