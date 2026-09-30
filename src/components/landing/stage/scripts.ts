/**
 * What Jake does at each spot (V8.3b), as the director's own signals: every gesture is the one the product plays
 * for the same signal in a lesson, so it means the same thing here. Pure; unit-tested.
 *
 * The teacher is mounted fresh each time the canvas moves to a spot, so each spot starts from idle and its one-shot
 * gestures (the greeting, PresentModel) fire on their own edges.
 */
import type { DirectorSignals } from "@/lib/avatar/director";
import { SPOTS, frustumFor, project, type SpotId, type V3 } from "./spots";

export const IDLE: DirectorSignals = {
  gesture: "idle", isLoading: false, isSpeaking: false, phase: null, role: null, segmentId: null,
  awaitingAnswer: false, modelShown: false, modelInteracting: false, previewImage: null, quizActive: false,
  quizResult: null, lessonComplete: false, sceneReady: false, reaction: null,
};

/** A wave waits this long after the teacher appears, so it is seen, not caught mid-fade. */
export const WAVE_AFTER_S = 0.6;
/**
 * The plane the reader's pointer is taken to be on, for where Jake looks (world z; he stands at -3, the eye is at
 * 0.9). Nearer him, the same pointer move turns his head further.
 */
export const VIEWER_Z = -0.6;

/** He does not wave at the same spot twice within this (plan note 6: every entry, with a cool-down). */
export const WAVE_COOLDOWN_S = 8;

/**
 * The model section's timeline, in seconds of its clock. The build starts with the picture, lifts it into points,
 * and settles on the model; he presents as the points lift, so his open hand is out beside the heart while it forms.
 */
export const MODEL_T = {
  lift: 1.3,
  present: 1.8,
  built: 5.0,
  length: 5.6,
} as const;

/**
 * Jake's left hand at PresentModel's peak, in world space: a palm-up offer at shoulder height, held from about 0.8s to
 * 2.1s after the cue. Read from his bones in the running stage (`?probe`; the V8.3b eval's
 * `build/probe/model-light-1280/peaks.json`, frames 14 to 23), not by eye.
 */
export const PRESENT_PEAK = { hand: [-0.2, 0.21, -2.86] as V3, index: [0.01, 0.34, -2.8] as V3 };

/**
 * The heart, placed from that hand (Hmz's second hard requirement): at the product's own spawn scale (Experience
 * FloatingModel, 0.825: 0.49 m wide, 0.83 m tall, 0.53 m deep), so it is in the lesson's proportion to him. At the
 * peak it faces the reader (it turns only once built, after his hand is down), so its near edge is its front
 * half-width from its centre: that edge sits 2 cm past his fingertip, and his open hand is at its lower-left, level
 * with its lower third. He offers it; he never reaches through it or past it.
 */
export const HEART = (() => {
  const scale = 0.825;
  /** Half the model's width seen from the front (its bounds are +-0.298 local). */
  const half = 0.298 * scale;
  const height = 1.0 * scale;
  const gap = 0.02;
  const [ix, iy, iz] = PRESENT_PEAK.index;
  return {
    scale,
    half,
    height,
    gap,
    /** The model's centre (its bounding box is centred on its origin). */
    position: [ix + gap + half, iy - 0.3 + height / 2, iz - 0.05] as V3,
  };
})();

/** The model spot's box aspect (width / height): fixed, so its composition, and its still, are the same at every width. */
export const MODEL_ASPECT = 1.1;

/**
 * The heart's area in the model spot, as percentages of the box (for the drag surface over it): its bounds seen
 * from the classroom eye through the spot's frustum, with a margin, and wide enough to cover it while it turns.
 */
export function heartBox(): { left: number; top: number; width: number; height: number } {
  const f = frustumFor(SPOTS.model, MODEL_ASPECT);
  const [x, y, z] = HEART.position;
  const rx = HEART.half + 0.1, ry = HEART.height / 2 + 0.04;
  const a = project(f, [x - rx, y + ry, z]), b = project(f, [x + rx, y - ry, z]);
  return { left: a.u * 100, top: a.v * 100, width: (b.u - a.u) * 100, height: (b.v - a.v) * 100 };
}

/** The build at section time `t`: 0 the picture, 1 the finished model; `show` fades the picture in first. */
export function heartBuildAt(t: number): { build: number; show: number } {
  const build = Math.min(1, Math.max(0, (t - MODEL_T.lift) / (MODEL_T.built - MODEL_T.lift)));
  return { build, show: Math.min(1, Math.max(0, t / 0.4)) };
}

export interface SpotContext {
  /** Seconds since the teacher appeared at this spot (the first frame drawn there). */
  liveFor: number;
  /** The section's clock (play.ts), in seconds. */
  t: number;
  /** This visit may wave (the cool-down has passed). */
  mayWave: boolean;
  /** A line is being spoken (silent or with sound). */
  speaking: boolean;
  /** The hero's call to action under the reader's pointer or focus, and its reaction count (shared.hero). */
  hover?: "try" | null;
  seq?: number;
}

export function signalsFor(spot: SpotId, ctx: SpotContext): DirectorSignals {
  const s: DirectorSignals = { ...IDLE, isSpeaking: ctx.speaking };
  switch (spot) {
    case "hero":
      s.sceneReady = ctx.mayWave && ctx.liveFor >= WAVE_AFTER_S;
      // Try a lesson: the product's "your turn" (both palms offered forward), once per hover, as a new challenge
      // segment. (Create an account earns nothing: the product's "that's right" pool can pick a one-hand offer to
      // his left, away from the button.)
      if (ctx.hover === "try") { s.role = "challenge_setup"; s.segmentId = `hero:try:${ctx.seq ?? 0}`; }
      break;
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
