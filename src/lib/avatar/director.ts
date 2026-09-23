/**
 * Avatar director (V9.3): turns the lesson's signals into what each layer of
 * the teacher plays. Pure -- no three.js, no React, no clock of its own. The
 * renderer (`Teacher.tsx`) calls `stepDirector` every frame with the mixer's
 * clock and applies the output; everything here is unit-tested.
 *
 * Layers:
 * - base: one full-body clip, always looping, crossfaded on change;
 * - overlay: at most one upper-body or head clip over the base, played once
 *   (greeting, long wait, answer reactions), blended in and out by weight;
 * - look: where the head aims (camera, board, model, desk, or nowhere);
 * - face: an expression hint for V9.4.
 *
 * The rules that each fixed a real regression before this module existed,
 * kept here so they cannot come back:
 * - a scenario change never restarts a clip the new scenario can also play
 *   (V9.1d: resetting the playing clip on Talking -> Pointing popped the arm);
 * - base clips always loop, reactions live on the overlay, so a reaction
 *   that has no clip can never freeze the base clamped (V9.2);
 * - the next variant comes from the director's own record of what plays,
 *   not from a render that may lag the frame (V9.2: the cycler skipped).
 */
import {
  CLIP_MANIFEST,
  MOUNT_CLIP,
  SCENARIOS,
  type ClipMask,
  type ClipSpec,
  type FaceHint,
  type LookTarget,
  type Scenario,
} from "./animationManifest";

// ─── Tuning ───────────────────────────────────────────────────────────────────

/** Crossfade durations, seconds. The programme's bar is <= 0.4 s. */
export const FADE = {
  base:     0.4,
  upperIn:  0.3,
  upperOut: 0.3,
  headIn:   0.2,
  headOut:  0.3,
} as const;

/** Idle keeps one variant at least this long, then moves on at a loop boundary. */
export const DWELL_S = 20;
/** Quiet this long and the long-wait overlay plays (catalogue row 2). */
export const LONG_WAIT_S = 25;
/** The greeting waits this long for its clip pack after sceneReady, then drops. */
export const GREETING_WINDOW_S = 8;
/** The head turns to a newly shown model for this long (row 9). */
export const PRESENT_LOOK_S = 4;
/**
 * How long a reaction without a clip holds its gesture before release. The
 * store's nod and shake auto-revert used these before V9.3.
 */
export const REACTION_FALLBACK_S = { nodding: 2.0, shaking: 1.5 } as const;
/** Same pass mark as CourseAdvanceBar ("Nice work!" vs "Keep going!"). */
export const QUIZ_PASS_RATIO = 0.6;

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "activate" | "explain" | "demonstrate" | "challenge" | "connect";
export type ReactionKind = "nodding" | "shaking";

export interface DirectorSignals {
  /** The store's gesture. Nod and shake arrive through `reaction` instead. */
  gesture:          "idle" | "pointing" | "nodding" | "shaking" | "explaining";
  isLoading:        boolean;
  isSpeaking:       boolean;
  /** Phase of the segment being narrated, if a lesson is playing. */
  phase:            Phase | null;
  awaitingAnswer:   boolean;
  /** A generated model is on screen (activeModelUrl set and in 3D view). */
  modelShown:       boolean;
  modelInteracting: boolean;
  quizActive:       boolean;
  quizResult:       { score: number; total: number } | null;
  lessonComplete:   boolean;
  sceneReady:       boolean;
  /**
   * The latest nod or shake, latched by the renderer from the store's
   * gesture changes. A lesson sets "nodding" and then the next segment's
   * gesture in the same tick, so sampling `gesture` once a frame can miss
   * it; a new `id` is a new reaction.
   */
  reaction:         { kind: ReactionKind; id: number } | null;
}

export interface DirectorInput {
  /** Seconds, on the same clock that advances the mixer. */
  now:       number;
  signals:   DirectorSignals;
  /**
   * Clips that can play right now -- loaded, and in the avatar's clip set --
   * with their durations in seconds. Pack clips appear when the pack lands.
   */
  available: ReadonlyMap<string, number>;
  /** Overlay masks this rig supports. An overlay clip needing another never plays. */
  masks:     ReadonlySet<ClipMask>;
  /** Uniform in [0, 1). Injected so tests are deterministic. */
  rng:       () => number;
}

export interface BasePlay {
  clip:      string;
  scenario:  Scenario;
  /** Changes exactly when the renderer must crossfade to `clip`. */
  seq:       number;
  startedAt: number;
  timeScale: number;
  fade:      number;
}

export interface OverlayPlay {
  /** Null for a reaction the rig has no clip for: timing and face only. */
  clip:      string | null;
  mask:      ClipMask;
  scenario:  Scenario;
  seq:       number;
  startedAt: number;
  timeScale: number;
  fadeIn:    number;
  fadeOut:   number;
  /** The weight starts down here... */
  fadeOutAt: number;
  /** ...and is gone here. */
  endsAt:    number;
  /** Gesture to hand back to the store when this ends, if it still holds it. */
  release:   ReactionKind | null;
}

export interface DirectorState {
  seq:            number;
  base:           BasePlay;
  overlay:        OverlayPlay | null;
  /** When each clip last stopped (or began fading out), for cooldowns. */
  lastEnded:      Readonly<Record<string, number>>;
  /** The previous overlay clip, so two overlays in a row differ when they can. */
  lastOverlay:    string | null;
  greeting:       "waiting" | "pending" | "done";
  greetingSince:  number;
  /** Start of the current quiet stretch, null while not quiet. */
  quietSince:     number | null;
  presentUntil:   number;
  prev: {
    reactionId:     number | null;
    quizKey:        string | null;
    lessonComplete: boolean;
    modelShown:     boolean;
  };
}

export interface DirectorOutput {
  base:    BasePlay;
  overlay: OverlayPlay | null;
  look:    LookTarget;
  face:    FaceHint;
  /**
   * Set on the one step a reaction ends. The renderer resets the store's
   * gesture to idle if it still holds this value, as the old auto-revert did.
   */
  release: ReactionKind | null;
}

// ─── Manifest queries ─────────────────────────────────────────────────────────

const specOf = (manifest: readonly ClipSpec[], id: string): ClipSpec | undefined =>
  manifest.find((c) => c.id === id);

const familyOf = (manifest: readonly ClipSpec[], id: string | null): string | null =>
  id === null ? null : specOf(manifest, id)?.family ?? id;

/**
 * The clips that can play `scenario` now, following the scenario's fallback
 * chain until one has any. Returns the scenario that supplied them.
 */
export function resolvePool(
  scenario: Scenario,
  available: ReadonlyMap<string, number>,
  masks: ReadonlySet<ClipMask>,
  manifest: readonly ClipSpec[] = CLIP_MANIFEST,
): { scenario: Scenario; clips: string[] } | null {
  const seen = new Set<Scenario>();
  for (let sc: Scenario | undefined = scenario; sc && !seen.has(sc); sc = SCENARIOS[sc].fallback) {
    seen.add(sc);
    const layer = SCENARIOS[sc].layer;
    const clips = manifest
      .filter((c) =>
        c.scenarios.includes(sc!) &&
        c.layer === layer &&
        available.has(c.id) &&
        (layer === "base" || masks.has(c.mask)))
      .map((c) => c.id);
    if (clips.length) return { scenario: sc, clips };
  }
  return null;
}

/**
 * Picks the next clip from `pool`: never `current` or its mirror while
 * anything else is left, never a clip inside its cooldown (or still fading
 * out) while anything else is left, then by weight. With `strict`, a pool
 * whose every clip is cooling down returns null instead.
 */
export function pickClip(
  pool: readonly string[],
  opts: {
    current:   string | null;
    lastEnded: Readonly<Record<string, number>>;
    now:       number;
    rng:       () => number;
    strict?:   boolean;
    manifest?: readonly ClipSpec[];
  },
): string | null {
  const manifest = opts.manifest ?? CLIP_MANIFEST;
  let cands = [...pool];
  if (!cands.length) return null;

  const fam = familyOf(manifest, opts.current);
  const notFamily = cands.filter((id) => id !== opts.current && familyOf(manifest, id) !== fam);
  const notCurrent = cands.filter((id) => id !== opts.current);
  if (notFamily.length) cands = notFamily;
  else if (notCurrent.length) cands = notCurrent;

  const cooled = cands.filter((id) => {
    const ended = opts.lastEnded[id];
    if (ended === undefined) return true;
    const wait = Math.max(specOf(manifest, id)?.cooldown ?? 0, FADE.base);
    return opts.now >= ended + wait;
  });
  if (cooled.length) cands = cooled;
  else if (opts.strict) return null;

  const weights = cands.map((id) => Math.max(0, specOf(manifest, id)?.weight ?? 1));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return cands[Math.floor(opts.rng() * cands.length) % cands.length];
  let r = opts.rng() * total;
  for (let i = 0; i < cands.length; i++) {
    r -= weights[i];
    if (r < 0) return cands[i];
  }
  return cands[cands.length - 1];
}

function timeScaleFor(manifest: readonly ClipSpec[], id: string, rng: () => number): number {
  const warp = specOf(manifest, id)?.timeWarp;
  return warp ? warp[0] + (warp[1] - warp[0]) * rng() : 1;
}

// ─── Scenario resolution ──────────────────────────────────────────────────────

const TALK_BY_PHASE: Record<Phase, Scenario> = {
  activate:    "talkActivate",
  explain:     "talkExplain",
  demonstrate: "talking",
  challenge:   "talkChallenge",
  connect:     "talkConnect",
};

/**
 * The base scenario, highest priority first. The order is the pre-V9.3 state
 * machine's: a gesture override, then loading, then speaking, then rest.
 */
export function baseScenario(s: DirectorSignals): Scenario {
  if (s.gesture === "pointing")   return "point";
  if (s.gesture === "explaining") return "explaining";
  if (s.isLoading)                return "thinking";
  if (s.isSpeaking)               return s.phase ? TALK_BY_PHASE[s.phase] : "talking";
  if (s.quizActive)               return "quizLook";
  if (s.awaitingAnswer)           return "listen";
  return "idle";
}

const overlayAllowed = (overlay: Scenario, base: Scenario): boolean => {
  const over = SCENARIOS[overlay].over;
  return !over || over.includes(base);
};

function lookFor(s: DirectorSignals, base: Scenario, now: number, presentUntil: number): LookTarget {
  if (s.quizActive) return "desk";
  const own = SCENARIOS[base].look;
  if (own === "board" || own === "none") return own;
  if (s.modelShown && (s.modelInteracting || now < presentUntil)) return "model";
  return own ?? "camera";
}

// ─── State ────────────────────────────────────────────────────────────────────

/**
 * A fresh director for a newly mounted teacher. `seed` is the signals at
 * mount: a result or a finished lesson already on screen is not news to a
 * teacher swapped in after it, so it does not react. The greeting still
 * plays -- a new teacher arriving says hello.
 */
export function createDirectorState(mountClip: string = MOUNT_CLIP, seed?: DirectorSignals): DirectorState {
  return {
    seq:           0,
    base:          { clip: mountClip, scenario: "idle", seq: 0, startedAt: 0, timeScale: 1, fade: 0 },
    overlay:       null,
    lastEnded:     {},
    lastOverlay:   null,
    greeting:      "waiting",
    greetingSince: 0,
    quietSince:    null,
    presentUntil:  -Infinity,
    prev: {
      reactionId:     seed?.reaction?.id ?? null,
      quizKey:        seed ? quizKeyOf(seed.quizResult) : null,
      lessonComplete: seed?.lessonComplete ?? false,
      modelShown:     seed?.modelShown ?? false,
    },
  };
}

function quizKeyOf(r: DirectorSignals["quizResult"]): string | null {
  return r ? `${r.score}/${r.total}` : null;
}

/** Seconds of one pass of `clip` at `timeScale`; 0 if unknown. */
const passOf = (available: ReadonlyMap<string, number>, clip: string, timeScale: number): number =>
  (available.get(clip) ?? 0) / (timeScale || 1);

// ─── Step ─────────────────────────────────────────────────────────────────────

export function stepDirector(
  state: DirectorState,
  input: DirectorInput,
  manifest: readonly ClipSpec[] = CLIP_MANIFEST,
): { state: DirectorState; output: DirectorOutput } {
  const { now, signals: sig, available, masks, rng } = input;
  let seq = state.seq;
  const lastEnded: Record<string, number> = { ...state.lastEnded };
  let release: ReactionKind | null = null;

  // ── Base ──
  const scenario = baseScenario(sig);
  let base = state.base;
  const pool = resolvePool(scenario, available, masks, manifest);

  const startBase = (clip: string): BasePlay => {
    lastEnded[base.clip] = now;
    seq += 1;
    return {
      clip, scenario, seq, startedAt: now,
      timeScale: timeScaleFor(manifest, clip, rng),
      fade: FADE.base,
    };
  };

  if (pool) {
    if (base.scenario !== scenario || !available.has(base.clip)) {
      // Keep a clip the new scenario can play too: restarting it is a pop.
      if (pool.clips.includes(base.clip)) base = { ...base, scenario };
      else base = startBase(pickClip(pool.clips, { current: base.clip, lastEnded, now, rng, manifest })!);
    } else {
      const pass = passOf(available, base.clip, base.timeScale);
      const mode = SCENARIOS[scenario].play;
      const passes = mode === "dwell" ? Math.max(1, Math.ceil(DWELL_S / Math.max(pass, 1e-3))) : 1;
      // Start the next clip one crossfade before this one ends, so the fade
      // covers its tail instead of a wrap back to frame 0.
      const dueAt = base.startedAt + passes * pass - FADE.base;
      if (pass > 0 && now >= dueAt) {
        const next = pickClip(pool.clips, { current: base.clip, lastEnded, now, rng, manifest });
        if (next && next !== base.clip) base = startBase(next);
        // A pool of one keeps looping; count the next pass from here.
        else base = { ...base, startedAt: base.startedAt + passes * pass };
      }
    }
  }

  // ── Overlay: end, or cancel if the base moved out from under it ──
  let overlay = state.overlay;
  let quietSince = state.quietSince;
  if (overlay && now >= overlay.endsAt) {
    if (overlay.clip) lastEnded[overlay.clip] = now;
    release = overlay.release;
    overlay = null;
    quietSince = null; // the quiet stretch restarts after an overlay
  }
  if (overlay && !overlayAllowed(overlay.scenario, scenario) && overlay.fadeOutAt > now) {
    overlay = { ...overlay, fadeOutAt: now, endsAt: now + overlay.fadeOut };
  }

  const startOverlay = (
    sc: Scenario,
    opts: { release?: ReactionKind; fallbackS?: number; strict?: boolean } = {},
  ): OverlayPlay | null => {
    const found = resolvePool(sc, available, masks, manifest);
    const clip = found
      ? pickClip(found.clips, { current: state.lastOverlay, lastEnded, now, rng, strict: opts.strict, manifest })
      : null;
    if (!clip && opts.fallbackS === undefined) return null;
    const spec = clip ? specOf(manifest, clip) : undefined;
    const mask = spec?.mask ?? "head";
    const head = mask === "head";
    const timeScale = clip ? timeScaleFor(manifest, clip, rng) : 1;
    const length = clip ? passOf(available, clip, timeScale) : opts.fallbackS!;
    const fadeIn = clip ? (head ? FADE.headIn : FADE.upperIn) : 0;
    const fadeOut = clip ? (head ? FADE.headOut : FADE.upperOut) : 0;
    if (overlay?.clip) lastEnded[overlay.clip] = now;
    seq += 1;
    return {
      clip, mask, scenario: found?.scenario ?? sc, seq, startedAt: now, timeScale,
      fadeIn, fadeOut, fadeOutAt: now + Math.max(0, length - fadeOut), endsAt: now + length,
      release: opts.release ?? null,
    };
  };

  // ── Events (edges), highest priority first; each preempts any overlay ──
  const quizKey = quizKeyOf(sig.quizResult);
  let event: Scenario | null = null;
  let eventRelease: ReactionKind | undefined;
  if (sig.reaction && sig.reaction.id !== state.prev.reactionId) {
    event = sig.reaction.kind === "nodding" ? "correct" : "wrong";
    eventRelease = sig.reaction.kind;
  } else if (sig.quizResult && quizKey !== state.prev.quizKey) {
    const { score, total } = sig.quizResult;
    event = score >= Math.ceil(total * QUIZ_PASS_RATIO) ? "quizGood" : "quizSupportive";
  } else if (sig.lessonComplete && !state.prev.lessonComplete) {
    event = "lessonComplete";
  }
  if (event) {
    const started = startOverlay(event, {
      release:   eventRelease,
      fallbackS: eventRelease ? REACTION_FALLBACK_S[eventRelease] : undefined,
    });
    if (started) overlay = started;
  }

  // ── Row 9: a model appears, the head turns to it for a moment ──
  let presentUntil = state.presentUntil;
  if (sig.modelShown && !state.prev.modelShown) {
    presentUntil = now + PRESENT_LOOK_S;
    if (!overlay && overlayAllowed("presentModel", scenario)) overlay = startOverlay("presentModel");
  }

  // ── Row 3: greeting, once per mount, when the scene is up and a wave is loaded ──
  let greeting = state.greeting;
  let greetingSince = state.greetingSince;
  if (greeting === "waiting" && sig.sceneReady) {
    greeting = "pending";
    greetingSince = now;
  }
  if (greeting === "pending") {
    if (now - greetingSince > GREETING_WINDOW_S) greeting = "done";
    else if (!overlay && overlayAllowed("greeting", scenario)) {
      const started = startOverlay("greeting");
      if (started) { overlay = started; greeting = "done"; }
    }
  }

  // ── Row 2: long wait ──
  if (overlayAllowed("longWait", scenario)) {
    if (quietSince === null) quietSince = now;
    if (!overlay && now - quietSince >= LONG_WAIT_S) {
      const started = startOverlay("longWait", { strict: true });
      if (started) overlay = started;
    }
  } else {
    quietSince = null;
  }

  const lastOverlay = overlay?.clip && overlay.seq !== state.overlay?.seq ? overlay.clip : state.lastOverlay;
  const face: FaceHint = (overlay && SCENARIOS[overlay.scenario].face) || SCENARIOS[scenario].face || "neutral";

  const next: DirectorState = {
    seq, base, overlay, lastEnded, lastOverlay, greeting, greetingSince, quietSince, presentUntil,
    prev: {
      reactionId:     sig.reaction?.id ?? state.prev.reactionId,
      quizKey,
      lessonComplete: sig.lessonComplete,
      modelShown:     sig.modelShown,
    },
  };
  return {
    state: next,
    output: { base, overlay, look: lookFor(sig, scenario, now, presentUntil), face, release },
  };
}

// ─── Blend helpers for the renderer ───────────────────────────────────────────

const smoothstep = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** How much of the overlay shows at `now`, 0..1, eased in and out. */
export function overlayBlend(play: Pick<OverlayPlay, "startedAt" | "fadeIn" | "fadeOutAt" | "endsAt">, now: number): number {
  if (now < play.startedAt || now >= play.endsAt) return 0;
  const fadeIn = play.fadeIn > 0 ? smoothstep((now - play.startedAt) / play.fadeIn) : 1;
  const outLen = play.endsAt - play.fadeOutAt;
  const fadeOut = now <= play.fadeOutAt ? 1 : outLen > 0 ? smoothstep((play.endsAt - now) / outLen) : 0;
  return Math.min(fadeIn, fadeOut);
}

/** Share of the overlay at full blend; the base keeps the rest. */
export const OVERLAY_DOMINANCE = 0.985;

/**
 * The action weight that makes an overlay show `blend` of the pose over a
 * base of total weight 1. three's PropertyMixer averages every action on a
 * property by weight (PropertyMixer.accumulate), and has no bone masks, so
 * an overlay filtered to upper-body tracks wins those bones by outweighing
 * the base: weight w over base 1 shows w / (w + 1) of the overlay.
 */
export function overlayWeight(blend: number): number {
  const b = Math.min(OVERLAY_DOMINANCE, Math.max(0, blend * OVERLAY_DOMINANCE));
  return b / (1 - b);
}
