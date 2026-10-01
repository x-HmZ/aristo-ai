/**
 * What Jake does at each spot (V8.3b), as the director's own signals: every gesture is the one the product plays
 * for the same signal in a lesson, so it means the same thing here. Pure; unit-tested.
 *
 * The teacher is mounted fresh each time the canvas moves to a spot, so each spot starts from idle and its one-shot
 * gestures (the greeting, PresentModel) fire on their own edges.
 */
import type { DirectorSignals } from "@/lib/avatar/director";
import { BOARD, BOARD_ASPECT, EYE, SPOTS, frustumFor, project, type SpotId, type V3 } from "./spots";

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
/** Where a thing his hand goes to is taken to be: at his offering hand's depth (PRESENT_PEAK), beside him. */
export const GESTURE_Z = -2.8;

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

/**
 * The classroom board's square in a volcano spot's box, as percentages (BOARD through the spot's frustum at
 * BOARD_ASPECT): where the ideas panel sits, under the canvas, so his pointing hand is drawn in front of it.
 */
export function boardBox(spot: "ideas" | "picture" | "moves"): { left: number; top: number; width: number; height: number } {
  const f = frustumFor(SPOTS[spot], BOARD_ASPECT);
  const [x, y, z] = BOARD.center, h = BOARD.size / 2;
  const a = project(f, [x - h, y + h, z]), b = project(f, [x + h, y - h, z]);
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
      // Try a lesson: the product's palm-up offer (PresentModel, his left hand: the buttons are to his left in the
      // hero), once per hover, on modelShown's rising edge. While it plays his head turns to the button and his eyes
      // stay on it (LandingStage points the look at it), so the hand and the gaze go to the same place. (Create an
      // account earns nothing: one offer per row of buttons reads better than two.)
      s.modelShown = ctx.hover === "try";
      break;
    case "close":
      // The product's greeting: sceneReady's rising edge plays the wave, once per mount.
      s.sceneReady = ctx.mayWave && ctx.liveFor >= WAVE_AFTER_S;
      break;
    case "idea":
      // The product's explain beat: a new explain segment plays HoldIdea once (hands in front of the chest, palms
      // facing with a gap), and the lit flute appears between them (Idea.tsx).
      if (ctx.t >= IDEA_T.hold) { s.phase = "explain"; s.segmentId = "idea:hold"; }
      break;
    case "ideas":
      // The product's "it is thinking" (OneMoment, then Thinking) while the topic is read, then its pointing clip
      // while the ideas link up, the hand aimed at one of them (LandingStage, aim.ts).
      s.isLoading = ctx.t >= IDEAS_T.think[0] && ctx.t < IDEAS_T.think[1];
      if (ctx.t >= IDEAS_T.point[0] && ctx.t < IDEAS_T.point[1]) s.gesture = "pointing";
      break;
    case "picture":
      // Pointing at the picture once it has mostly resolved, the hand aimed at its crater (PICTURE_AIM).
      if (ctx.t >= PICTURE_T.point[0] && ctx.t < PICTURE_T.point[1]) s.gesture = "pointing";
      break;
    case "model":
      // The product's "a model appears": modelShown's rising edge plays PresentModel and turns the head to it.
      s.modelShown = ctx.t >= MODEL_T.present;
      break;
    case "moves": {
      // Each move as the lesson's own segment: its phase and role, under a new segment id, so the director plays the
      // move's own gesture once (Imagine, HoldIdea, StepBeat per step, YourTurn, BringTogether). Before the first
      // move the id is null, which re-arms the sparse explain and connect beats for a replay.
      const beat = moveBeatAt(ctx.t);
      if (beat) {
        const m = MOVE_SIGNALS[beat.move];
        s.phase = m.phase;
        s.role = m.role;
        s.segmentId = `moves:${beat.move}:${beat.step}`;
      }
      // The answer on the board is right: the product's "that's right" (Nodding, or Exactly towards the board).
      if (ctx.t >= MOVES_T.nod) s.reaction = { kind: "nodding", id: 1 };
      break;
    }
  }
  return s;
}

/** The five moves, in lesson order. */
export const MOVE_IDS = ["activate", "explain", "demonstrate", "challenge", "connect"] as const;
export type MoveId = (typeof MOVE_IDS)[number];

/**
 * The director signals that make each move's gesture, as a lesson sends them: Activate opens with a hook (Imagine),
 * Explain is the phase's beat (HoldIdea), each step of Demonstrate is a demo step (StepBeat), Challenge sets up the
 * question (YourTurn), and Connect is the phase's beat (BringTogether).
 */
const MOVE_SIGNALS: Record<MoveId, Pick<DirectorSignals, "phase" | "role">> = {
  activate: { phase: "activate", role: "hook" },
  explain: { phase: "explain", role: null },
  demonstrate: { phase: "demonstrate", role: "demo_step" },
  challenge: { phase: "challenge", role: "challenge_setup" },
  connect: { phase: "connect", role: null },
};

/**
 * One Lesson, Five Moves, in seconds of its clock: when each move starts (`at`), and Demonstrate's three steps
 * (`steps`, each a StepBeat chop). Each move's gesture makes its piece in his hands, which is then set on the board
 * (Moves.tsx). In Challenge an answer arrives on the board (`answer`) and he says "that's right" (`nod`), which ends
 * before Connect starts. The clock stops at `length` with the whole lesson on the board.
 */
export const MOVES_T = { at: [0.6, 4.2, 7.8, 13.2, 19.8], steps: [7.8, 9.5, 11.2], answer: 16.3, nod: 16.9, length: 24 } as const;

/** The move playing at section time `t`, and its step (0 except within Demonstrate), or null before the first. */
export function moveBeatAt(t: number): { move: MoveId; index: number; step: number } | null {
  let index = -1;
  while (index + 1 < MOVES_T.at.length && t >= MOVES_T.at[index + 1]) index++;
  if (index < 0) return null;
  let step = 0;
  if (MOVE_IDS[index] === "demonstrate") while (step + 1 < MOVES_T.steps.length && t >= MOVES_T.steps[step + 1]) step++;
  return { move: MOVE_IDS[index], index, step };
}

/**
 * A Teacher of Your Own, in seconds of its clock: the three beats rise (0, 1.2, 2.4) and the colonnade draws itself;
 * at `hold` he holds the idea (his hands are up about 1.6 s later). The idea, an orb of light, shows between his
 * palms while they are up, then flies (`flyS`) into the column's empty place and lights it. If his hands are not up
 * by `giveUp` (the clip pack has not loaded), the place just lights.
 */
export const IDEA_T = { beats: [0, 1.2, 2.4], draw: [0.3, 2.6], hold: 2.9, flyS: 0.7, giveUp: 6.4, length: 8 } as const;

/**
 * It Finds the Ideas (the volcano lesson): the topic types, he thinks, the ideas appear one by one and link up, and
 * he points at them.
 */
export const IDEAS_T = { type: [0.2, 1.4], think: [0.5, 2.4], ideas: 2.3, step: 0.22, point: [2.7, 6.0], length: 6.6 } as const;

/**
 * It Draws the Picture (the volcano lesson's cross-section): it resolves from noise to lines to colour on the
 * classroom board's own place, and he points at it once it has mostly formed.
 */
export const PICTURE_T = { resolve: [0.5, 3.6], point: [2.9, 6.1], length: 6.6 } as const;
/** The picture: the volcano lesson's own cross-section (seg_008), resized for the landing. */
export const PICTURE_URL = "/landing/volcano-picture.webp";
/**
 * Where the picture is: the board's place (BOARD), set back 0.3 m and enlarged to look exactly the same size and in
 * the same place from the classroom eye (3.9 m from the board), so the hand PointNear brings to the board's plane
 * passes in front of it rather than into it.
 */
export const PICTURE_PLACE = (() => {
  const z = BOARD.center[2] - 0.3;
  const k = (EYE[2] - z) / (EYE[2] - BOARD.center[2]);
  return { position: [BOARD.center[0] * k, BOARD.center[1] * k, z] as V3, size: BOARD.size * k, k };
})();
/**
 * Where his pointing lands on it: the crater, at about 34% down the image and in its middle. Level with his
 * shoulder, so the aim correction stays small.
 */
export const PICTURE_AIM: V3 = [
  PICTURE_PLACE.position[0],
  PICTURE_PLACE.position[1] + (0.5 - 0.34) * PICTURE_PLACE.size,
  PICTURE_PLACE.position[2],
];
