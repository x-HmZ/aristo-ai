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
  /** The reader's mouse pointer in viewport CSS px, or null (a touch, or it has left the page). */
  pointer: { x: number; y: number } | null;
  /**
   * The hero's reactions (Hero.tsx writes them, the stage reads them):
   * - `hover`: the call to action under the pointer or focus, and `seq`, bumped once per reaction it earns;
   * - `greet`: bumped for a fresh wave (a tap on Jake, the reader coming back to the page).
   */
  hero: { hover: "try" | null; seq: number; greet: number };
} = {
  mode: "lite", live: false, speaking: false, heart: { turn: 0, user: false }, pointer: null,
  hero: { hover: null, seq: 0, greet: 0 },
};
