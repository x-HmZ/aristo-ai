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
   * - `greet`: bumped for a fresh wave (a tap on Jake, the reader coming back to the page);
   * - `look`: while a gesture goes to an element, he looks at it (its centre) instead of the pointer, until `until`
   *   (performance.now ms).
   */
  hero: { hover: "try" | null; seq: number; greet: number; look: { el: HTMLElement; until: number } | null };
  /**
   * His hands where something is held in them (A Teacher of Your Own, One Lesson, Five Moves), written by the stage
   * each frame at those spots: his palms' centres on the page (viewport px), whether both hands are up in front of
   * him, and which spot wrote them.
   */
  hands: {
    spot: string | null;
    palms: { l: { x: number; y: number }; r: { x: number; y: number } } | null;
    raised: boolean;
    /** Each wrist's height in world metres (at rest about -0.45; a gesture lifts it above -0.3). */
    lift: { l: number; r: number };
    /** Each hand's lowest point on the page (viewport px): of the wrist, the fingertips and the thumb tip. */
    low: { l: { x: number; y: number }; r: { x: number; y: number } } | null;
    /**
     * Called by the stage right after it writes these, in the same frame it renders: what the page draws at his hands
     * moves in step with them (a rAF of its own would run a frame behind, about 10 px while a hand moves).
     */
    onReport: (() => void) | null;
  };
  /** One Lesson, Five Moves: the section's run, bumped by Replay, so the teacher there starts again from rest. */
  moves: { run: number };
  /**
   * Step Into the Classroom: `near`, the reader is near the section (the room loads from then on); `ready`, the room
   * is loaded and warm (until then the spot keeps its poster); the reader's look
   * around (radians, a drag over the room: `yaw` right, `pitch` up) and whether they are dragging. A tab or Replay
   * only moves the tour's clock: the director takes the new signals from wherever he is, as in a lesson.
   */
  room: { near: boolean; ready: boolean; yaw: number; pitch: number; dragging: boolean };
  /**
   * When each spot's greeting was last on (performance.now seconds), for the wave's cool-down; and the close's entries,
   * bumped each time the close comes into view once the cool-down has passed, so the teacher there remounts and waves,
   * with when the teacher there last mounted (seconds; an entry that brings him there fresh needs no remount).
   */
  waves: Partial<Record<string, number>>;
  close: { enter: number; mountedAt: number };
} = {
  mode: "lite", live: false, speaking: false, heart: { turn: 0, user: false }, pointer: null,
  hero: { hover: null, seq: 0, greet: 0, look: null },
  hands: { spot: null, palms: null, raised: false, lift: { l: -0.45, r: -0.45 }, low: null, onReport: null },
  moves: { run: 0 },
  room: { near: false, ready: false, yaw: 0, pitch: 0, dragging: false },
  waves: {},
  close: { enter: 0, mountedAt: Number.NEGATIVE_INFINITY },
};
