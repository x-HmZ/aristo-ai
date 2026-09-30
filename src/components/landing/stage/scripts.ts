/**
 * What Jake does at each spot (V8.3b), as the director's own signals: every gesture is the one the product plays
 * for the same signal in a lesson, so it means the same thing here. Pure; unit-tested.
 *
 * The teacher is mounted fresh each time the canvas moves to a spot, so each spot starts from idle and its one-shot
 * gestures (the greeting, PresentModel) fire on their own edges.
 */
import type { DirectorSignals } from "@/lib/avatar/director";
import type { SpotId } from "./spots";

export const IDLE: DirectorSignals = {
  gesture: "idle", isLoading: false, isSpeaking: false, phase: null, role: null, segmentId: null,
  awaitingAnswer: false, modelShown: false, modelInteracting: false, previewImage: null, quizActive: false,
  quizResult: null, lessonComplete: false, sceneReady: false, reaction: null,
};

/** A wave waits this long after the teacher appears, so it is seen, not caught mid-fade. */
export const WAVE_AFTER_S = 0.6;
/** He does not wave at the same spot twice within this (plan note 6: every entry, with a cool-down). */
export const WAVE_COOLDOWN_S = 8;

/**
 * The model section's timeline, in seconds of its clock. The build starts with the picture, lifts it into points,
 * and settles on the model; he presents as the points lift, so his open hand is out beside the heart while it forms.
 */
export const MODEL_T = {
  lift: 0.9,
  present: 1.1,
  built: 4.6,
  length: 5.2,
} as const;

export interface SpotContext {
  /** Seconds since the teacher appeared at this spot (the first frame drawn there). */
  liveFor: number;
  /** The section's clock (play.ts), in seconds. */
  t: number;
  /** This visit may wave (the cool-down has passed). */
  mayWave: boolean;
  /** A line is being spoken (the hero's caption, silent or with sound). */
  speaking: boolean;
}

export function signalsFor(spot: SpotId, ctx: SpotContext): DirectorSignals {
  const s: DirectorSignals = { ...IDLE, isSpeaking: ctx.speaking };
  switch (spot) {
    case "hero":
    case "close":
      // The product's greeting: sceneReady's rising edge plays the wave, once per mount.
      s.sceneReady = ctx.mayWave && ctx.liveFor >= WAVE_AFTER_S;
      break;
    case "model":
      // The product's "a model appears": modelShown's rising edge plays PresentModel and turns the head to it.
      s.modelShown = ctx.t >= MODEL_T.present;
      break;
  }
  return s;
}
