import type { LandingMode } from "./gate";

/**
 * What the 3D stage tells the DOM each frame, and the page's mode. A plain object on purpose: the stage writes it
 * inside its render loop and the DOM writers read it in the same frame, so nothing here goes through React.
 */
export const shared: {
  mode: LandingMode;
  /** The live stage has painted the room with the teacher in it. */
  live: boolean;
  /** The classroom display's rectangle on screen, in CSS px (null until the stage has projected it). */
  display: { x: number; y: number; w: number; h: number } | null;
  /** The opt-in sound is playing a line. */
  speaking: boolean;
  /**
   * The lens shift in CSS px: how far the view's centre moves towards the framed window (the opening's or the
   * close's), so the room is composed inside the window rather than behind the text beside it. 0 at full bleed.
   */
  lens: { x: number; y: number };
} = { mode: "lite", live: false, display: null, speaking: false, lens: { x: 0, y: 0 } };
