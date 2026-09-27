/**
 * Animation manifest (V9.3): every clip a teacher can play, what it is for,
 * and how it plays. Data only -- the avatar director (`director.ts`) decides
 * when; `Teacher.tsx` renders the result. No three.js here.
 *
 * Clips are referenced by the name they carry inside the GLB. One name can
 * exist on several rigs (the Canino pair's own GLBs, the shared Avaturn pack
 * `animations_Avaturn.glb`, the legacy Ryan/Sonia files); it means the same
 * scenario on each, and each avatar lists the names it ships in a clip set
 * below. Durations are the Canino bakes (V9.2) and are reference only: the
 * director times everything from the loaded clip's own duration.
 *
 * Upgrade path: buying clips later (ActorCore's conversation and presenter
 * bundles, roughly $50-150 for the 20-30 that carry the teaching feel) or
 * hand-keying the Tier 2 gestures is a data change. Bake the clips into a
 * pack, add one row per clip here with its scenario tags, add the names to
 * the avatar's clip set. No director or renderer code changes.
 */

// ─── Scenarios (the V9 catalogue rows) ────────────────────────────────────────

/**
 * One tag per catalogue row that plays clips. Rows 10, 20 and 21 have no
 * clips (look target, blink, eye contact) and live in the director and the
 * renderer instead. The row numbers in the comments below and in
 * `ScenarioSpec.row` are this original V9 catalogue's; the six V9.7 entries
 * did not exist in it, so they cite `.claude/plans/V96-GESTURE-CATALOGUE.md`
 * instead (its own, unrelated row numbering) and are given fresh `row`
 * numbers (20-25) rather than reusing either catalogue's. V9.8 adds three
 * more this same way (26-28), citing `.claude/plans/NEXT-SESSION-V98-WIRING.md`
 * (its own row numbers 4, 15, 17b). PointNear (V9.8) needs no new scenario:
 * it is a second base clip in the existing "point" pool (row 8).
 */
export type Scenario =
  | "idle"           // 1  attentive idle
  | "longWait"       // 2  idle for 25 s
  | "greeting"       // 3  sceneReady
  | "thinking"       // 4  isLoading
  | "talking"        // 5  isSpeaking, neutral
  | "talkActivate"   // 6  isSpeaking in the activate phase
  | "talkExplain"    // 7  isSpeaking in the explain phase
  | "point"          // 8  gesture === "pointing"
  | "presentModel"   // 9  a generated model appears
  | "listen"         // 12 awaitingAnswer
  | "correct"        // 13 gesture === "nodding"
  | "wrong"          // 14 gesture === "shaking"
  | "quizLook"       // 15 activeQuiz
  | "quizGood"       // 16 quizResult, passed
  | "quizSupportive" // 16 quizResult, not passed
  | "talkChallenge"  // 11 isSpeaking in the challenge phase
  | "talkConnect"    // 17 isSpeaking in the connect phase
  | "lessonComplete" // 18 lessonComplete
  | "explaining"     // 19 gesture === "explaining" (free mode)
  // V9.7 teaching moves (V96-GESTURE-CATALOGUE.md rows 5, 6, 9, 12, 13, 14):
  // upper-body beats keyed off the narrating segment's role or phase, on top
  // of whatever base scenario above is already playing.
  | "hook"            // segment role "hook"
  | "explainBeat"     // phase "explain", sparse (once per phase per lesson)
  | "demoStep"        // segment role "demo_step"
  | "transition"      // segment role "transition"
  | "connectBeat"     // phase "connect", sparse (once per phase per lesson)
  | "challengeSetup"  // segment role "challenge_setup"
  // V9.8 batch 3 (V96-GESTURE-CATALOGUE.md rows 4, 15, 17b):
  | "oneMoment"       // 26 isLoading rising edge, over thinking (the base it hands off to)
  | "listenBeat"      // 27 PatientTilt: once per question, ~4s into listen, re-armed by a new question
  | "wrongBoard";     // 28 wrong while previewImage is set: turn back to the board instead

/**
 * Which bones a clip drives when it plays over the base layer. `full` is the
 * whole body (base clips); `upper` is the spine from the chest up, arms and
 * head; `head` is the neck and everything above it. See `skeletonMasks`.
 */
export type ClipMask = "full" | "upper" | "head";

export type Layer = "base" | "upper" | "face" | "look";

/** Where the head aims. `none` hands the head back to the clip. */
export type LookTarget = "camera" | "board" | "model" | "desk" | "none";

/** Expression hint for the face layer: a smile level plus, for `thinking`, averted eyes (face.ts, gaze.ts). */
export type FaceHint = "neutral" | "smile" | "warm" | "thinking";

export interface ScenarioSpec {
  /** The catalogue row, for humans and tests. */
  row:       number;
  layer:     "base" | "upper";
  /**
   * How a base scenario moves through its pool:
   * - `cycle`: next variant as each clip ends (talking, thinking);
   * - `dwell`: keep looping, move on at a clip boundary after `DWELL_S`
   *   (idle: a 3 s clip is too short to be a whole idle);
   * - `once`: an upper overlay that plays one clip and fades out.
   */
  play:      "cycle" | "dwell" | "once";
  /**
   * Scenario whose pool stands in when this one has no playable clip.
   * The chain ends at a scenario with no fallback. Upper scenarios without
   * a fallback simply play nothing: a missing clip is a missing gesture,
   * never a wrong one.
   */
  fallback?: Scenario;
  look?:     LookTarget;
  face?:     FaceHint;
  /**
   * Upper scenarios only: the base scenarios this overlay may play over.
   * It does not start over any other, and fades out early if the base moves
   * to one (a wave cannot share an arm with Pointing). Unset: any base.
   */
  over?:     readonly Scenario[];
}

const TALKING_BASES = ["talking", "talkActivate", "talkExplain", "talkChallenge", "talkConnect", "explaining"] as const;
const QUIET_BASES   = ["idle", "listen", "quizLook"] as const;

export const SCENARIOS: Record<Scenario, ScenarioSpec> = {
  idle:           { row: 1,  layer: "base",  play: "dwell", look: "camera" },
  longWait:       { row: 2,  layer: "upper", play: "once",  over: QUIET_BASES },
  greeting:       { row: 3,  layer: "upper", play: "once",  face: "smile", over: [...QUIET_BASES, ...TALKING_BASES] },
  thinking:       { row: 4,  layer: "base",  play: "cycle", fallback: "idle", look: "none", face: "thinking" },
  talking:        { row: 5,  layer: "base",  play: "cycle", fallback: "idle", look: "camera" },
  talkActivate:   { row: 6,  layer: "base",  play: "cycle", fallback: "talking", look: "camera" },
  talkExplain:    { row: 7,  layer: "base",  play: "cycle", fallback: "talking", look: "camera" },
  // Pointing stays a full-body base clip, not the catalogue's upper overlay:
  // its fingertip was placed on the panel edge with the clip's own hips
  // (V9.2b), and a talking base's hips would swing that aim. `play: "dwell"`
  // (V9.8, was "cycle"): PointNear joins the pool beside it, and Hmz wants one
  // hand picked per pointing stretch, not swapped at every clip loop -- dwell
  // holds the pick for DWELL_S (20s), longer than a pointing stretch runs.
  point:          { row: 8,  layer: "base",  play: "dwell", fallback: "talking", look: "board" },
  presentModel:   { row: 9,  layer: "upper", play: "once",  over: [...QUIET_BASES, ...TALKING_BASES] },
  listen:         { row: 12, layer: "base",  play: "dwell", fallback: "idle", look: "camera" },
  correct:        { row: 13, layer: "upper", play: "once",  face: "smile" },
  wrong:          { row: 14, layer: "upper", play: "once",  face: "warm" },
  quizLook:       { row: 15, layer: "base",  play: "dwell", fallback: "idle", look: "desk" },
  quizGood:       { row: 16, layer: "upper", play: "once",  face: "smile" },
  quizSupportive: { row: 16, layer: "upper", play: "once",  face: "warm" },
  talkChallenge:  { row: 11, layer: "base",  play: "cycle", fallback: "talking", look: "camera" },
  talkConnect:    { row: 17, layer: "base",  play: "cycle", fallback: "talking", look: "camera" },
  lessonComplete: { row: 18, layer: "upper", play: "once",  fallback: "quizGood", face: "smile" },
  explaining:     { row: 19, layer: "base",  play: "cycle", fallback: "talking", look: "camera" },

  // V9.7 teaching moves. All wire from a segment role or phase (director.ts),
  // play once over the same bases as presentModel and the greeting, and
  // never over Pointing or Thinking (neither is in TALKING_BASES/QUIET_BASES).
  hook:           { row: 20, layer: "upper", play: "once", over: [...QUIET_BASES, ...TALKING_BASES] },
  explainBeat:    { row: 21, layer: "upper", play: "once", over: [...QUIET_BASES, ...TALKING_BASES] },
  demoStep:       { row: 22, layer: "upper", play: "once", over: [...QUIET_BASES, ...TALKING_BASES] },
  transition:     { row: 23, layer: "upper", play: "once", over: [...QUIET_BASES, ...TALKING_BASES] },
  connectBeat:    { row: 24, layer: "upper", play: "once", over: [...QUIET_BASES, ...TALKING_BASES] },
  challengeSetup: { row: 25, layer: "upper", play: "once", over: [...QUIET_BASES, ...TALKING_BASES] },

  // V9.8 batch 3.
  // Thinking is not in QUIET_BASES/TALKING_BASES (it has its own look/face),
  // so oneMoment needs its own `over`: it plays right as isLoading flips the
  // base to thinking.
  oneMoment:      { row: 26, layer: "upper", play: "once", over: ["thinking"] },
  // Head only, over the listen base only -- director.ts times the 4s wait.
  listenBeat:     { row: 27, layer: "upper", play: "once", over: ["listen"] },
  // Falls back to the plain wrong-answer pool (ShakeNo/Almost) on a rig
  // without BackToBoard, the same pattern lessonComplete uses for quizGood.
  wrongBoard:     { row: 28, layer: "upper", play: "once", fallback: "wrong", face: "warm" },
};

// ─── Clips ────────────────────────────────────────────────────────────────────

export interface ClipSpec {
  /** The clip's name inside the GLB. */
  id:          string;
  source:      string;
  licence:     string;
  scenarios:   readonly Scenario[];
  /** Layer the clip plays on. A clip serves one layer only. */
  layer:       "base" | "upper";
  /** Bones driven when `layer` is `upper`; always `full` on base. */
  mask:        ClipMask;
  play:        "loop" | "once";
  /** Seconds, Canino bake. Reference only, see the header. */
  duration:    number;
  /** Relative pick weight inside a pool. */
  weight:      number;
  /** Seconds after the clip ends before it may be picked again. */
  cooldown:    number;
  /** True if a baked left-right mirror exists or could be baked. */
  mirrorable:  boolean;
  /**
   * Clips that read as the same motion (a clip and its mirror). The
   * director avoids following a clip with anything from its family.
   */
  family:      string;
  /** Playback-rate range, picked per play (Tier 1 runtime time-warp). */
  timeWarp?:   readonly [number, number];
  /**
   * Overlays only: where the head aims while this clip plays, until it starts
   * fading out, over any other target (the quiz desk included). Unset: the
   * base scenario's target. For a gesture whose meaning is where it looks
   * (a glance at the board): the look layer would otherwise pull the head
   * back toward the base's target, the student.
   */
  look?:       LookTarget;
  notes?:      string;
}

const MIXAMO = "Mixamo (Adobe), retargeted in scripts/ (V9.1-V9.2)";
const MIXAMO_MIRROR = "Mixamo (Adobe), mirrored by scripts/v9_mirror.py (V9.2)";
const MIXAMO_LICENCE = "Mixamo terms: royalty-free, commercial use, not redistributable as raw files";
const AUTHORED = "authored in Blender for Aristo (V9.6), scripts/v9_gesture.py";
const AUTHORED_V97 = "authored in Blender for Aristo (V9.7), scripts/v9_gesture.py";
const AUTHORED_V98 = "authored in Blender for Aristo (V9.8), scripts/v9_gesture.py";
const AUTHORED_LICENCE = "Aristo's own";

/** Talking and idle read as new beats at a slightly different rate. */
const WARP = [0.92, 1.08] as const;

/** The greeting wave plays slower than recorded; one fixed rate, not a range. */
const GREETING_WARP = [0.75, 0.75] as const;

/** YourTurn plays slower too, the same choice Hmz made for the wave (V9.7). */
const YOUR_TURN_WARP = [0.85, 0.85] as const;

export const CLIP_MANIFEST: readonly ClipSpec[] = [
  // Row 1: attentive idle
  { id: "Idle",  source: MIXAMO, licence: MIXAMO_LICENCE, scenarios: ["idle", "listen", "quizLook"], layer: "base", mask: "full", play: "loop", duration: 8.38,  weight: 2, cooldown: 0, mirrorable: true, family: "Idle",  timeWarp: WARP,
    notes: "Mount clip: lives in every base GLB, so a teacher always has it" },
  { id: "Idle2", source: MIXAMO, licence: MIXAMO_LICENCE, scenarios: ["idle", "listen", "quizLook"], layer: "base", mask: "full", play: "loop", duration: 11.13, weight: 1, cooldown: 0, mirrorable: true, family: "Idle2", timeWarp: WARP },
  { id: "Idle4", source: MIXAMO, licence: MIXAMO_LICENCE, scenarios: ["idle", "listen", "quizLook"], layer: "base", mask: "full", play: "loop", duration: 3.04,  weight: 1, cooldown: 0, mirrorable: true, family: "Idle4", timeWarp: WARP },

  // Row 2: long wait. Too restless for the attentive pool (hands at 78 cm/s,
  // V9.2); Hmz saw it in motion and called it fine for this row.
  { id: "Idle3", source: MIXAMO, licence: MIXAMO_LICENCE, scenarios: ["longWait"], layer: "upper", mask: "upper", play: "once", duration: 10.42, weight: 1, cooldown: 60, mirrorable: true, family: "Idle3" },
  { id: "GlanceBoard", source: AUTHORED, licence: AUTHORED_LICENCE, scenarios: ["longWait"], layer: "upper", mask: "upper", play: "once", duration: 2.83, weight: 1, cooldown: 30, mirrorable: false, family: "GlanceBoard", look: "board",
    notes: "Turns to the board as if rereading it; `look` keeps the head there, the look layer would pull it back to the student" },

  // Row 3: greeting, a one-second wave with either hand, played at 0.75
  // (Hmz: full speed felt too fast, V9.6).
  { id: "Talking6",  source: MIXAMO,        licence: MIXAMO_LICENCE, scenarios: ["greeting"], layer: "upper", mask: "upper", play: "once", duration: 1.04, weight: 1, cooldown: 0, mirrorable: true, family: "Talking6",  timeWarp: GREETING_WARP },
  { id: "Talking6M", source: MIXAMO_MIRROR, licence: MIXAMO_LICENCE, scenarios: ["greeting"], layer: "upper", mask: "upper", play: "once", duration: 1.04, weight: 1, cooldown: 0, mirrorable: true, family: "Talking6", timeWarp: GREETING_WARP },

  // Row 4: thinking. On the Canino rigs "Thinking" is baked from the pack's
  // Thinking2 (looking up); on the Avaturn pack it is hand-to-chin.
  { id: "Thinking",  source: MIXAMO,        licence: MIXAMO_LICENCE, scenarios: ["thinking"], layer: "base", mask: "full", play: "loop", duration: 4.13, weight: 1, cooldown: 0, mirrorable: true, family: "Thinking" },
  { id: "ThinkingM", source: MIXAMO_MIRROR, licence: MIXAMO_LICENCE, scenarios: ["thinking"], layer: "base", mask: "full", play: "loop", duration: 4.13, weight: 1, cooldown: 0, mirrorable: true, family: "Thinking" },
  { id: "Thinking2", source: MIXAMO,        licence: MIXAMO_LICENCE, scenarios: ["thinking"], layer: "base", mask: "full", play: "loop", duration: 4.13, weight: 1, cooldown: 0, mirrorable: true, family: "Thinking2",
    notes: "Avaturn pack only; the Canino rigs ship it as Thinking/ThinkingM" },

  // Row 5 (and 6, 7, 11, 17, 19 through their fallbacks): talking.
  { id: "Talking",   source: MIXAMO,        licence: MIXAMO_LICENCE, scenarios: ["talking"], layer: "base", mask: "full", play: "loop", duration: 3.96,  weight: 1, cooldown: 0, mirrorable: true, family: "Talking",  timeWarp: WARP },
  { id: "Talking2",  source: MIXAMO,        licence: MIXAMO_LICENCE, scenarios: ["talking"], layer: "base", mask: "full", play: "loop", duration: 3.38,  weight: 1, cooldown: 0, mirrorable: true, family: "Talking2", timeWarp: WARP },
  { id: "Talking2M", source: MIXAMO_MIRROR, licence: MIXAMO_LICENCE, scenarios: ["talking"], layer: "base", mask: "full", play: "loop", duration: 3.38,  weight: 1, cooldown: 0, mirrorable: true, family: "Talking2", timeWarp: WARP },
  { id: "Talking3",  source: MIXAMO,        licence: MIXAMO_LICENCE, scenarios: ["talking"], layer: "base", mask: "full", play: "loop", duration: 2.96,  weight: 1, cooldown: 0, mirrorable: true, family: "Talking3", timeWarp: WARP },
  { id: "Talking3M", source: MIXAMO_MIRROR, licence: MIXAMO_LICENCE, scenarios: ["talking"], layer: "base", mask: "full", play: "loop", duration: 2.96,  weight: 1, cooldown: 0, mirrorable: true, family: "Talking3", timeWarp: WARP },
  { id: "Talking4",  source: MIXAMO,        licence: MIXAMO_LICENCE, scenarios: ["talking"], layer: "base", mask: "full", play: "loop", duration: 10.42, weight: 1, cooldown: 0, mirrorable: true, family: "Talking4", timeWarp: WARP,
    notes: "Hand to hip, the other rises in front of the chest" },
  { id: "Talking5",  source: MIXAMO,        licence: MIXAMO_LICENCE, scenarios: ["talking"], layer: "base", mask: "full", play: "loop", duration: 8.70,  weight: 1, cooldown: 0, mirrorable: true, family: "Talking5", timeWarp: WARP,
    notes: "Avaturn pack only. Rejected for the Canino rigs: a deep crouch that splits MJ's skirt (V9.2)" },

  // Row 8: pointing at the board. Never time-warped: its peak is what lands
  // the fingertip on the panel.
  { id: "Pointing", source: MIXAMO, licence: MIXAMO_LICENCE, scenarios: ["point"], layer: "base", mask: "full", play: "loop", duration: 3.75, weight: 1, cooldown: 0, mirrorable: true, family: "Pointing",
    notes: "Mirroring would point away from the board; variants need new clips (Tier 2). Hand fixed in V9.8: the other fingers folded, index straightened (was bent back 9deg, splayed 12.5deg)" },
  { id: "PointNear", source: AUTHORED_V98, licence: AUTHORED_LICENCE, scenarios: ["point"], layer: "base", mask: "full", play: "loop", duration: 6.04, weight: 1, cooldown: 0, mirrorable: false, family: "PointNear",
    notes: "Left index into the near third of the panel, chest and head turned to it; two passes of Idle4, loop seam 0.00deg. Never time-warped, like Pointing: the aim is the point. Half the point pool, picked once per stretch by the scenario's dwell mode" },

  // Row 9: a generated model appears. Left palm up and out towards where the
  // model floats; the head is left to the look layer.
  { id: "PresentModel", source: AUTHORED, licence: AUTHORED_LICENCE, scenarios: ["presentModel"], layer: "upper", mask: "upper", play: "once", duration: 2.63, weight: 1, cooldown: 0, mirrorable: false, family: "PresentModel" },

  // Rows 13, 14, 16, 18: reactions. Nodding and ShakeNo are head only so the
  // body keeps talking or idling underneath; the authored gestures use the
  // upper body (the other arm keeps the base's motion).
  { id: "Nodding", source: MIXAMO, licence: MIXAMO_LICENCE, scenarios: ["correct", "quizGood"], layer: "upper", mask: "head", play: "once", duration: 2.63, weight: 1, cooldown: 0, mirrorable: false, family: "Nodding",
    notes: "Also the demo's scripted nod: /demo accepts any answer with an encouraging nod (useLessonPlayback submitAnswer, demoMode branch)" },
  { id: "ShakeNo", source: MIXAMO, licence: MIXAMO_LICENCE, scenarios: ["wrong"], layer: "upper", mask: "head", play: "once", duration: 3.08, weight: 1, cooldown: 0, mirrorable: false, family: "ShakeNo",
    notes: "Kept at a third of Almost's weight, about one wrong answer in four (Hmz: lower, V9.6). For grade 6-8 a head shake reads as scolding" },

  // V9.6 authored reactions, beside the shipped ones.
  { id: "Almost", source: AUTHORED, licence: AUTHORED_LICENCE, scenarios: ["wrong"], layer: "upper", mask: "upper", play: "once", duration: 2.04, weight: 3, cooldown: 0, mirrorable: false, family: "Almost",
    notes: "Warm tilt and a palm-down 'so-so' rock. LookAgain (tilt and nod) was rejected: a nod says yes" },
  { id: "Exactly", source: AUTHORED, licence: AUTHORED_LICENCE, scenarios: ["correct"], layer: "upper", mask: "upper", play: "once", duration: 1.83, weight: 1, cooldown: 0, mirrorable: false, family: "Exactly" },
  { id: "WellDone", source: AUTHORED, licence: AUTHORED_LICENCE, scenarios: ["quizGood"], layer: "upper", mask: "upper", play: "once", duration: 2.46, weight: 1, cooldown: 0, mirrorable: false, family: "WellDone" },
  { id: "Encourage", source: AUTHORED, licence: AUTHORED_LICENCE, scenarios: ["quizSupportive"], layer: "upper", mask: "upper", play: "once", duration: 2.54, weight: 1, cooldown: 0, mirrorable: false, family: "Encourage" },
  { id: "ThatsIt", source: AUTHORED, licence: AUTHORED_LICENCE, scenarios: ["lessonComplete"], layer: "upper", mask: "upper", play: "once", duration: 2.63, weight: 1, cooldown: 0, mirrorable: false, family: "ThatsIt" },

  // V9.7 teaching moves: wordless beats keyed off the narrating segment's
  // role or phase (director.ts). Durations read from the shipped packs with
  // gltf-transform; both packs bake to the same lengths.
  { id: "Imagine", source: AUTHORED_V97, licence: AUTHORED_LICENCE, scenarios: ["hook"], layer: "upper", mask: "upper", play: "once", duration: 2.25, weight: 1, cooldown: 0, mirrorable: false, family: "Imagine",
    notes: "Both palms open outward and slightly apart, a curious head tilt. The hook, 'imagine if...'" },
  { id: "HoldIdea", source: AUTHORED_V97, licence: AUTHORED_LICENCE, scenarios: ["explainBeat"], layer: "upper", mask: "upper", play: "once", duration: 2.54, weight: 1, cooldown: 0, mirrorable: false, family: "HoldIdea",
    notes: "Hands in front of the chest, palms facing with a gap, as if holding the idea. Fires once per explain phase, not every segment" },
  { id: "StepBeat", source: AUTHORED_V97, licence: AUTHORED_LICENCE, scenarios: ["demoStep"], layer: "upper", mask: "upper", play: "once", duration: 1.46, weight: 1, cooldown: 0, mirrorable: false, family: "StepBeat",
    notes: "One chop of the right hand, lands about 0.6 s in: 'first... then...'" },
  { id: "MoveOn", source: AUTHORED_V97, licence: AUTHORED_LICENCE, scenarios: ["transition"], layer: "upper", mask: "upper", play: "once", duration: 1.63, weight: 1, cooldown: 0, mirrorable: false, family: "MoveOn",
    notes: "Forward roll of the right hand, opens palm up: 'now, next'. Hmz picked this over a palm-down brush" },
  { id: "YourTurn", source: AUTHORED_V97, licence: AUTHORED_LICENCE, scenarios: ["challengeSetup"], layer: "upper", mask: "upper", play: "once", duration: 2.04, weight: 1, cooldown: 0, mirrorable: false, family: "YourTurn", timeWarp: YOUR_TURN_WARP,
    notes: "Both palms offered forward, a small lean: 'your turn'. Plays at 0.85, like the greeting wave (Hmz)" },
  { id: "BringTogether", source: AUTHORED_V97, licence: AUTHORED_LICENCE, scenarios: ["connectBeat"], layer: "upper", mask: "upper", play: "once", duration: 2.46, weight: 1, cooldown: 0, mirrorable: false, family: "BringTogether",
    notes: "Wide to close, never nearer than 182 mm: 'it all fits'. Fires once per connect phase, not every segment" },

  // V9.8 batch 3: event clips (isLoading, listen, a wrong answer with an
  // image on the board). Durations read from the shipped packs the same way.
  { id: "OneMoment", source: AUTHORED_V98, licence: AUTHORED_LICENCE, scenarios: ["oneMoment"], layer: "upper", mask: "upper", play: "once", duration: 2.04, weight: 1, cooldown: 0, mirrorable: false, family: "OneMoment",
    notes: "Right index raised in front of the shoulder, palm to the student, other fingers folded: 'one moment'. Plays as isLoading rises, over the thinking base it hands off to" },
  { id: "PatientTilt", source: AUTHORED_V98, licence: AUTHORED_LICENCE, scenarios: ["listenBeat"], layer: "upper", mask: "head", play: "once", duration: 3.04, weight: 1, cooldown: 0, mirrorable: false, family: "PatientTilt",
    notes: "Head tilts ~12deg to his left, chin a touch down. Neck and head only on purpose: a chest lean put MJ's hip hand 12mm into her skirt over Talking4. Once per question, ~4s after the teacher stops talking (director.ts), re-armed by a new question" },
  { id: "BackToBoard", source: AUTHORED_V98, licence: AUTHORED_LICENCE, scenarios: ["wrongBoard"], layer: "upper", mask: "upper", play: "once", duration: 2.04, weight: 1, cooldown: 0, mirrorable: false, family: "BackToBoard", look: "board",
    notes: "Chest and head turn back to the board, a light open left hand to it, on a wrong answer while the lesson image is still up. `look: board` keeps the head there, like GlanceBoard" },

  // Shipped in animations_Avaturn.glb, never played.
  { id: "Clapping", source: MIXAMO, licence: MIXAMO_LICENCE, scenarios: [], layer: "upper", mask: "upper", play: "once", duration: 1.13, weight: 0, cooldown: 0, mirrorable: false, family: "Clapping",
    notes: "Rejected: the hands never meet, even on Marcus (V9.2)" },
];

export const CLIPS_BY_ID: ReadonlyMap<string, ClipSpec> = new Map(CLIP_MANIFEST.map((c) => [c.id, c]));

// ─── Clip sets (what each avatar ships) ───────────────────────────────────────

/** Jake and MJ: base GLB (Idle, Talking, Thinking) plus their clip pack. */
export const CANINO_CLIP_SET = [
  "Idle", "Idle2", "Idle3", "Idle4",
  "Thinking", "ThinkingM",
  "Talking", "Talking2", "Talking2M", "Talking3", "Talking3M", "Talking4",
  "Talking6", "Talking6M",
  "Pointing", "Nodding", "ShakeNo",
  // Authored in Blender for the Canino rigs only (V9.6).
  "PresentModel", "Encourage", "Almost", "Exactly", "WellDone", "ThatsIt", "GlanceBoard",
  // Authored in Blender for the Canino rigs only (V9.7).
  "Imagine", "HoldIdea", "StepBeat", "MoveOn", "YourTurn", "BringTogether",
  // Authored in Blender for the Canino rigs only (V9.8).
  "OneMoment", "PointNear", "PatientTilt", "BackToBoard",
] as const;

/** Marcus and Priya, on the shared Avaturn pack. */
export const AVATURN_CLIP_SET = [
  "Idle", "Idle2", "Idle3", "Idle4",
  "Thinking", "Thinking2",
  "Talking", "Talking2", "Talking3", "Talking4", "Talking5",
  "Talking6",
  "Pointing", "Nodding", "ShakeNo",
] as const;

/**
 * `/create-teacher` avatars, also on the Avaturn pack. The same short list
 * they have always played; widening it to AVATURN_CLIP_SET is a one-line
 * change once someone checks those clips on a generated body.
 */
export const CUSTOM_CLIP_SET = [
  "Idle", "Thinking", "Talking", "Talking2", "Pointing", "Nodding", "ShakeNo",
] as const;

/** Ryan and Sonia: their own four-clip files. */
export const LEGACY_CLIP_SET = ["Idle", "Thinking", "Talking", "Talking2"] as const;

/** The clip every teacher mounts on. It must live in the base GLB. */
export const MOUNT_CLIP = "Idle";
