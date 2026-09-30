/**
 * A round of spoken lines on a clock (V8.3b, the hero's line card): each line plays for its own length, holds, and
 * hands over to the next, round again. Pure; unit-tested.
 */

/** How long a finished line stays up before the next (plan section 3). */
export const LINE_HOLD_S = 2.5;

export interface LineSlot {
  /** Which line, 0-based into `lengths`. */
  index: number;
  /** Seconds into that line (past its length while it holds). */
  lineT: number;
  /** The clock time the line started at. */
  start: number;
}

/**
 * The line on screen at clock time `t` (seconds since the round began), starting with line `first`. A line with no
 * length (its timings failed to load) still holds, so the round moves on.
 */
export function lineAt(t: number, lengths: readonly number[], first = 0, hold = LINE_HOLD_S): LineSlot {
  const n = lengths.length;
  const slot = (i: number) => Math.max(0, lengths[i]) + hold;
  const round = lengths.reduce((a, _, i) => a + slot(i), 0);
  let rest = Math.max(0, t) % round;
  const base = Math.max(0, t) - rest;
  let index = first % n;
  let start = base;
  while (rest >= slot(index)) {
    rest -= slot(index);
    start += slot(index);
    index = (index + 1) % n;
  }
  return { index, lineT: rest, start };
}

/**
 * A word's look for `lit` words spoken of `total`: said ("on"), being said ("now", the last one started), or not
 * yet (""). `total + 1` is the whole line, as held after it is spoken and as shown before the round starts.
 */
export function wordState(k: number, lit: number, total: number): "on" | "now" | "" {
  if (lit > total) return "on";
  if (k < lit - 1) return "on";
  return k === lit - 1 ? "now" : "";
}
