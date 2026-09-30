import type { LandingMode } from "./gate";

/**
 * What the page and the 3D stage share each frame, and the page's mode. A plain object on purpose: one side writes
 * it and the other reads it in its own loop, so nothing here goes through React.
 */
export const shared: {
  mode: LandingMode;
  /** The live stage has painted the teacher. */
  live: boolean;
  /** A line is being spoken (sound.ts), silent or heard. */
  speaking: boolean;
  /** The heart's turn by the reader (radians; a drag or Turn it), and whether they have turned it at all. */
  heart: { turn: number; user: boolean };
} = { mode: "lite", live: false, speaking: false, heart: { turn: 0, user: false } };
