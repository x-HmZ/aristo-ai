import { describe, expect, it } from "vitest";
import {
  CANINO_CLIP_SET,
  CLIP_MANIFEST,
  CUSTOM_CLIP_SET,
  LEGACY_CLIP_SET,
  type ClipMask,
  type Scenario,
} from "@/lib/avatar/animationManifest";
import {
  FADE,
  GREETING_WINDOW_S,
  LONG_WAIT_S,
  OVERLAY_DOMINANCE,
  PRESENT_LOOK_S,
  REACTION_FALLBACK_S,
  baseScenario,
  createDirectorState,
  overlayBlend,
  overlayWeight,
  pickClip,
  resolvePool,
  stepDirector,
  type DirectorOutput,
  type DirectorSignals,
  type DirectorState,
} from "@/lib/avatar/director";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const DURATIONS = new Map(CLIP_MANIFEST.map((c) => [c.id, c.duration]));
const BASE_GLB = ["Idle", "Talking", "Thinking"];

/** Clips available to a rig: its clip set, optionally before its pack lands. */
function availableFor(set: readonly string[], packLoaded = true): Map<string, number> {
  return new Map(
    set
      .filter((id) => packLoaded || BASE_GLB.includes(id))
      .map((id) => [id, DURATIONS.get(id)!]),
  );
}
const CANINO = availableFor(CANINO_CLIP_SET);
const CANINO_NO_PACK = availableFor(CANINO_CLIP_SET, false);
const ALL_MASKS: ReadonlySet<ClipMask> = new Set<ClipMask>(["full", "upper", "head"]);

const quiet: DirectorSignals = {
  gesture: "idle", isLoading: false, isSpeaking: false, phase: null,
  awaitingAnswer: false, modelShown: false, modelInteracting: false,
  quizActive: false, quizResult: null, lessonComplete: false,
  sceneReady: false, reaction: null,
};
const sig = (over: Partial<DirectorSignals> = {}): DirectorSignals => ({ ...quiet, ...over });

/** A deterministic uniform sequence (LCG), so every run picks the same. */
function seededRng(seed = 1): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/**
 * Steps the director at 60 fps. `signalsAt(t)` gives the app's signals at
 * each time; every output is returned for assertions.
 */
function run(opts: {
  seconds:    number;
  signalsAt:  (t: number) => DirectorSignals;
  available?: (t: number) => ReadonlyMap<string, number>;
  masks?:     ReadonlySet<ClipMask>;
  state?:     DirectorState;
  from?:      number;
  seed?:      number;
}): { state: DirectorState; outputs: Array<DirectorOutput & { t: number }> } {
  const dt = 1 / 60;
  const rng = seededRng(opts.seed ?? 7);
  let state = opts.state ?? createDirectorState();
  const outputs: Array<DirectorOutput & { t: number }> = [];
  const from = opts.from ?? 0;
  for (let t = from + dt; t <= from + opts.seconds + 1e-9; t += dt) {
    const step = stepDirector(state, {
      now: t,
      signals: opts.signalsAt(t),
      available: opts.available?.(t) ?? CANINO,
      masks: opts.masks ?? ALL_MASKS,
      rng,
    });
    state = step.state;
    outputs.push({ ...step.output, t });
  }
  return { state, outputs };
}

/** The base clips in play order, one entry per crossfade. */
const baseSequence = (outputs: DirectorOutput[]): string[] => {
  const seq: string[] = [];
  let last = -1;
  for (const o of outputs) {
    if (o.base.seq !== last) { seq.push(o.base.clip); last = o.base.seq; }
  }
  return seq;
};

const familyOf = (id: string) => CLIP_MANIFEST.find((c) => c.id === id)!.family;

// ─── Scenario resolution ─────────────────────────────────────────────────────

describe("baseScenario", () => {
  const cases: Array<[string, Partial<DirectorSignals>, Scenario]> = [
    ["nothing active (row 1)",                {},                                                     "idle"],
    ["loading (row 4)",                       { isLoading: true },                                    "thinking"],
    ["speaking, no lesson (row 5)",           { isSpeaking: true },                                   "talking"],
    ["speaking, demonstrate phase (row 5)",   { isSpeaking: true, phase: "demonstrate" },             "talking"],
    ["speaking, activate phase (row 6)",      { isSpeaking: true, phase: "activate" },                "talkActivate"],
    ["speaking, explain phase (row 7)",       { isSpeaking: true, phase: "explain" },                 "talkExplain"],
    ["speaking, challenge phase (row 11)",    { isSpeaking: true, phase: "challenge" },               "talkChallenge"],
    ["speaking, connect phase (row 17)",      { isSpeaking: true, phase: "connect" },                 "talkConnect"],
    ["pointing (row 8)",                      { gesture: "pointing", isSpeaking: true },              "point"],
    ["pointing beats loading",                { gesture: "pointing", isLoading: true },               "point"],
    ["explaining in free mode (row 19)",      { gesture: "explaining", isSpeaking: true },            "explaining"],
    ["explaining beats loading, as before",   { gesture: "explaining", isLoading: true },             "explaining"],
    ["loading beats speaking",                { isLoading: true, isSpeaking: true },                  "thinking"],
    ["awaiting an answer (row 12)",           { awaitingAnswer: true },                               "listen"],
    ["quiz on the desk (row 15)",             { quizActive: true },                                   "quizLook"],
    ["a nod is an overlay, not a base",       { gesture: "nodding", isSpeaking: true },               "talking"],
    ["a shake is an overlay, not a base",     { gesture: "shaking" },                                 "idle"],
  ];
  it.each(cases)("%s", (_name, over, expected) => {
    expect(baseScenario(sig(over))).toBe(expected);
  });
});

describe("resolvePool", () => {
  const cases: Array<[string, Scenario, ReadonlyMap<string, number>, ReadonlySet<ClipMask>, { scenario: Scenario; clips: string[] } | null]> = [
    ["idle on Canino",                        "idle",           CANINO,         ALL_MASKS, { scenario: "idle", clips: ["Idle", "Idle2", "Idle4"] }],
    ["idle before the pack lands",            "idle",           CANINO_NO_PACK, ALL_MASKS, { scenario: "idle", clips: ["Idle"] }],
    ["talking on Canino",                     "talking",        CANINO,         ALL_MASKS, { scenario: "talking", clips: ["Talking", "Talking2", "Talking2M", "Talking3", "Talking3M", "Talking4"] }],
    ["explain phase falls back to talking",   "talkExplain",    CANINO,         ALL_MASKS, { scenario: "talking", clips: ["Talking", "Talking2", "Talking2M", "Talking3", "Talking3M", "Talking4"] }],
    ["thinking on Canino",                    "thinking",       CANINO,         ALL_MASKS, { scenario: "thinking", clips: ["Thinking", "ThinkingM"] }],
    ["pointing with its pack",                "point",          CANINO,         ALL_MASKS, { scenario: "point", clips: ["Pointing"] }],
    ["pointing before its pack: talking",     "point",          CANINO_NO_PACK, ALL_MASKS, { scenario: "talking", clips: ["Talking"] }],
    ["listening uses the idles",              "listen",         CANINO,         ALL_MASKS, { scenario: "listen", clips: ["Idle", "Idle2", "Idle4"] }],
    ["long wait (row 2)",                     "longWait",       CANINO,         ALL_MASKS, { scenario: "longWait", clips: ["Idle3"] }],
    ["greeting (row 3), either hand",         "greeting",       CANINO,         ALL_MASKS, { scenario: "greeting", clips: ["Talking6", "Talking6M"] }],
    ["correct (row 13)",                      "correct",        CANINO,         ALL_MASKS, { scenario: "correct", clips: ["Nodding"] }],
    ["wrong (row 14)",                        "wrong",          CANINO,         ALL_MASKS, { scenario: "wrong", clips: ["ShakeNo"] }],
    ["quiz passed (row 16)",                  "quizGood",       CANINO,         ALL_MASKS, { scenario: "quizGood", clips: ["Nodding"] }],
    ["quiz not passed: no clip yet (row 16)", "quizSupportive", CANINO,         ALL_MASKS, null],
    ["lesson complete falls back to a nod",   "lessonComplete", CANINO,         ALL_MASKS, { scenario: "quizGood", clips: ["Nodding"] }],
    ["present model: no clip yet (row 9)",    "presentModel",   CANINO,         ALL_MASKS, null],
    ["a rig without a head mask cannot nod",  "correct",        CANINO,         new Set<ClipMask>(["full"]), null],
    ["custom teachers keep their short list", "talking",        availableFor(CUSTOM_CLIP_SET), ALL_MASKS, { scenario: "talking", clips: ["Talking", "Talking2"] }],
    ["custom teachers have no wave",          "greeting",       availableFor(CUSTOM_CLIP_SET), ALL_MASKS, null],
    ["Ryan has no pointing: talking",         "point",          availableFor(LEGACY_CLIP_SET), ALL_MASKS, { scenario: "talking", clips: ["Talking", "Talking2"] }],
  ];
  it.each(cases)("%s", (_name, scenario, available, masks, expected) => {
    expect(resolvePool(scenario, available, masks)).toEqual(expected);
  });

  it("never offers a rejected clip, even when the rig ships it", () => {
    const withClapping = new Map([...CANINO, ["Clapping", 1.13]]);
    for (const sc of ["correct", "quizGood", "greeting", "lessonComplete"] as Scenario[]) {
      expect(resolvePool(sc, withClapping, ALL_MASKS)?.clips ?? []).not.toContain("Clapping");
    }
  });
});

// ─── Variety ─────────────────────────────────────────────────────────────────

describe("pickClip", () => {
  const base = { lastEnded: {}, now: 100, rng: () => 0 };
  const cases: Array<[string, string[], Parameters<typeof pickClip>[1], string | null]> = [
    ["never the current clip",               ["Talking", "Talking3"],   { ...base, current: "Talking" },  "Talking3"],
    ["never the current clip's mirror",      ["Talking2", "Talking2M", "Talking3"], { ...base, current: "Talking2" }, "Talking3"],
    ["a mirror when only the family is left", ["Thinking", "ThinkingM"], { ...base, current: "Thinking" }, "ThinkingM"],
    ["a pool of one repeats",                ["Pointing"],              { ...base, current: "Pointing" }, "Pointing"],
    ["an empty pool gives nothing",          [],                        { ...base, current: null },       null],
    ["skips a clip still fading out",        ["Talking", "Talking3", "Talking4"], { ...base, current: "Talking", lastEnded: { Talking3: 99.9 } }, "Talking4"],
    ["skips a clip in its cooldown",         ["Idle3", "Talking6"],     { ...base, current: null, lastEnded: { Idle3: 80 } }, "Talking6"],
    ["relaxes the cooldown when nothing is left", ["Idle3"],            { ...base, current: null, lastEnded: { Idle3: 80 } }, "Idle3"],
    ["strict: nothing while cooling down",   ["Idle3"],                 { ...base, current: null, lastEnded: { Idle3: 80 }, strict: true }, null],
    ["strict: plays once the cooldown is over", ["Idle3"],              { ...base, current: null, lastEnded: { Idle3: 30 }, strict: true }, "Idle3"],
  ];
  it.each(cases)("%s", (_name, pool, opts, expected) => {
    expect(pickClip(pool, opts)).toBe(expected);
  });

  it("follows the manifest weights", () => {
    // Idle weighs 2, Idle2 and Idle4 weigh 1 each: Idle takes rng [0, 0.5).
    const opts = { current: null, lastEnded: {}, now: 0 };
    expect(pickClip(["Idle", "Idle2", "Idle4"], { ...opts, rng: () => 0.49 })).toBe("Idle");
    expect(pickClip(["Idle", "Idle2", "Idle4"], { ...opts, rng: () => 0.51 })).toBe("Idle2");
    expect(pickClip(["Idle", "Idle2", "Idle4"], { ...opts, rng: () => 0.99 })).toBe("Idle4");
  });
});

describe("variety over a long run", () => {
  const cases: Array<[string, Partial<DirectorSignals>, string[]]> = [
    ["talking (row 5)",  { isSpeaking: true }, ["Talking", "Talking2", "Talking2M", "Talking3", "Talking3M", "Talking4"]],
    ["thinking (row 4)", { isLoading: true },  ["Thinking", "ThinkingM"]],
    ["idle (row 1)",     {},                   ["Idle", "Idle2", "Idle4"]],
    ["explaining (19)",  { gesture: "explaining", isSpeaking: true }, ["Talking", "Talking2", "Talking2M", "Talking3", "Talking3M", "Talking4"]],
  ];
  it.each(cases)("%s: every variant plays, none twice in a row", (_name, over, pool) => {
    const { outputs } = run({ seconds: 600, signalsAt: () => sig(over) });
    const played = baseSequence(outputs).slice(1); // [0] is the mount clip
    expect(new Set(played)).toEqual(new Set(pool));
    for (let i = 1; i < played.length; i++) {
      expect(played[i]).not.toBe(played[i - 1]);
    }
  });

  it("talking never follows a clip with its own mirror", () => {
    const { outputs } = run({ seconds: 600, signalsAt: () => sig({ isSpeaking: true }) });
    const played = baseSequence(outputs).slice(1);
    for (let i = 1; i < played.length; i++) {
      expect(familyOf(played[i])).not.toBe(familyOf(played[i - 1]));
    }
  });

  it("talking moves on one crossfade before each clip ends", () => {
    const { outputs } = run({ seconds: 60, signalsAt: () => sig({ isSpeaking: true }) });
    for (let i = 1; i < outputs.length; i++) {
      const prev = outputs[i - 1].base;
      const cur = outputs[i].base;
      if (cur.seq === prev.seq || prev.fade === 0) continue;
      const pass = DURATIONS.get(prev.clip)! / prev.timeScale;
      expect(cur.startedAt - prev.startedAt).toBeCloseTo(pass - FADE.base, 1);
    }
  });

  it("idle holds a variant for at least 20 s", () => {
    const { outputs } = run({ seconds: 300, signalsAt: () => sig() });
    const starts = outputs.filter((o, i) => i > 0 && o.base.seq !== outputs[i - 1].base.seq).map((o) => o.t);
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(20 - FADE.base);
  });

  it("time-warps talking and idle within the manifest range, never pointing", () => {
    const talk = run({ seconds: 120, signalsAt: () => sig({ isSpeaking: true }) }).outputs;
    for (const o of talk.slice(1)) {
      if (o.base.seq === 0) continue;
      expect(o.base.timeScale).toBeGreaterThanOrEqual(0.92);
      expect(o.base.timeScale).toBeLessThanOrEqual(1.08);
    }
    const point = run({ seconds: 30, signalsAt: () => sig({ gesture: "pointing", isSpeaking: true }) }).outputs;
    expect(point.at(-1)!.base.clip).toBe("Pointing");
    expect(point.at(-1)!.base.timeScale).toBe(1);
  });
});

// ─── Transitions that once regressed ─────────────────────────────────────────

describe("transitions", () => {
  it("does not restart a clip the new scenario can also play (V9.1d pop)", () => {
    // Pointing before its pack lands resolves to the talking pool: whatever
    // talking clip is playing keeps playing, same seq, no crossfade.
    const talking = run({ seconds: 2, signalsAt: () => sig({ isSpeaking: true }), available: () => CANINO_NO_PACK });
    const before = talking.outputs.at(-1)!.base;
    const pointing = run({
      seconds: 0.5, from: 2, state: talking.state, available: () => CANINO_NO_PACK,
      signalsAt: () => sig({ isSpeaking: true, gesture: "pointing" }),
    });
    expect(pointing.outputs[0].base.seq).toBe(before.seq);
    expect(pointing.outputs[0].base.clip).toBe(before.clip);
  });

  it("crossfades to Pointing when the pack has it", () => {
    const talking = run({ seconds: 2, signalsAt: () => sig({ isSpeaking: true }) });
    const out = run({
      seconds: 20, from: 2, state: talking.state,
      signalsAt: () => sig({ isSpeaking: true, gesture: "pointing" }),
    }).outputs;
    expect(out[0].base.clip).toBe("Pointing");
    expect(out[0].base.seq).toBeGreaterThan(talking.outputs.at(-1)!.base.seq);
    // A pool of one loops: no further crossfades.
    expect(new Set(out.map((o) => o.base.seq)).size).toBe(1);
  });

  it("upgrades to Pointing at the next clip boundary once the pack lands", () => {
    const out = run({
      seconds: 15,
      signalsAt: () => sig({ isSpeaking: true, gesture: "pointing" }),
      available: (t) => (t < 1 ? CANINO_NO_PACK : CANINO),
    }).outputs;
    expect(out[0].base.clip).toBe("Talking");
    expect(out.at(-1)!.base.clip).toBe("Pointing");
  });

  it("base clips always loop: a nod without its clip leaves the base alone (V9.2 clamp)", () => {
    const out = run({
      seconds: 3,
      signalsAt: (t) => sig({ gesture: "nodding", reaction: t > 0.5 ? { kind: "nodding", id: 1 } : null }),
      available: () => CANINO_NO_PACK,
    }).outputs;
    expect(new Set(out.map((o) => o.base.seq)).size).toBe(1);
    expect(out.at(-1)!.base.clip).toBe("Idle");
  });
});

// ─── Overlays ────────────────────────────────────────────────────────────────

describe("reactions (rows 13, 14)", () => {
  const reactionRun = (kind: "nodding" | "shaking", available: ReadonlyMap<string, number> = CANINO, masks = ALL_MASKS) =>
    run({
      seconds: 5, available: () => available, masks,
      // A lesson sets the gesture and immediately the next segment's; only
      // the latched reaction carries the event.
      signalsAt: (t) => sig({ isSpeaking: t > 1, reaction: t > 1 ? { kind, id: 1 } : null }),
    }).outputs;

  const cases: Array<[string, "nodding" | "shaking", ReadonlyMap<string, number>, ReadonlySet<ClipMask>, string | null, number]> = [
    ["correct nods",                        "nodding", CANINO,         ALL_MASKS,                   "Nodding", DURATIONS.get("Nodding")!],
    ["wrong shakes",                        "shaking", CANINO,         ALL_MASKS,                   "ShakeNo", DURATIONS.get("ShakeNo")!],
    ["nod before the pack: timing only",    "nodding", CANINO_NO_PACK, ALL_MASKS,                   null,      REACTION_FALLBACK_S.nodding],
    ["shake before the pack: timing only",  "shaking", CANINO_NO_PACK, ALL_MASKS,                   null,      REACTION_FALLBACK_S.shaking],
    ["no head mask: timing only",           "nodding", CANINO,         new Set<ClipMask>(["full"]), null,      REACTION_FALLBACK_S.nodding],
  ];
  it.each(cases)("%s", (_name, kind, available, masks, clip, length) => {
    const out = reactionRun(kind, available, masks);
    const first = out.find((o) => o.overlay)!;
    expect(first.overlay!.clip).toBe(clip);
    expect(first.overlay!.release).toBe(kind);
    if (clip) expect(first.overlay!.mask).toBe("head");
    const released = out.filter((o) => o.release === kind);
    expect(released).toHaveLength(1);
    expect(released[0].t - first.t).toBeCloseTo(length, 1);
  });

  it("the body keeps talking under a nod", () => {
    const out = reactionRun("nodding");
    const during = out.filter((o) => o.overlay?.clip === "Nodding");
    expect(during.length).toBeGreaterThan(0);
    expect(during.every((o) => o.base.scenario === "talking")).toBe(true);
  });

  it("a new reaction preempts the one playing", () => {
    const out = run({
      seconds: 3,
      signalsAt: (t) => sig({ reaction: t < 1 ? { kind: "nodding", id: 1 } : { kind: "shaking", id: 2 } }),
    }).outputs;
    expect(out.find((o) => o.t > 1.1)!.overlay!.clip).toBe("ShakeNo");
  });
});

describe("greeting (row 3)", () => {
  it("waves once, when the scene is ready and the wave has loaded", () => {
    const out = run({
      seconds: 60,
      signalsAt: () => sig({ sceneReady: true }),
      available: (t) => (t < 1.5 ? CANINO_NO_PACK : CANINO),
    }).outputs;
    const waves = out.filter((o, i) => o.overlay?.scenario === "greeting" && out[i - 1]?.overlay?.seq !== o.overlay.seq);
    expect(waves).toHaveLength(1);
    expect(waves[0].t).toBeGreaterThanOrEqual(1.5);
    expect(["Talking6", "Talking6M"]).toContain(waves[0].overlay!.clip);
    expect(waves[0].overlay!.mask).toBe("upper");
  });

  it("gives up if the pack never arrives", () => {
    const out = run({ seconds: GREETING_WINDOW_S + 5, signalsAt: () => sig({ sceneReady: true }), available: () => CANINO_NO_PACK }).outputs;
    expect(out.some((o) => o.overlay?.scenario === "greeting")).toBe(false);
  });

  it("waits for the scene", () => {
    const out = run({ seconds: 3, signalsAt: () => sig({ sceneReady: false }) }).outputs;
    expect(out.some((o) => o.overlay)).toBe(false);
  });

  it("does not wave over Pointing or thinking", () => {
    for (const over of [{ gesture: "pointing" as const }, { isLoading: true }]) {
      const out = run({ seconds: 3, signalsAt: () => sig({ sceneReady: true, ...over }) }).outputs;
      expect(out.some((o) => o.overlay?.scenario === "greeting")).toBe(false);
    }
  });
});

describe("long wait (row 2)", () => {
  it("fidgets after 25 s of quiet, over the idle base", () => {
    const out = run({ seconds: 40, signalsAt: () => sig() }).outputs;
    const first = out.find((o) => o.overlay?.scenario === "longWait")!;
    expect(first.t).toBeCloseTo(LONG_WAIT_S, 1);
    expect(first.overlay!.clip).toBe("Idle3");
    expect(first.overlay!.mask).toBe("upper");
    expect(first.base.scenario).toBe("idle");
  });

  it("counts awaiting an answer and the quiz as quiet", () => {
    for (const over of [{ awaitingAnswer: true }, { quizActive: true }]) {
      const out = run({ seconds: 30, signalsAt: () => sig(over) }).outputs;
      expect(out.some((o) => o.overlay?.scenario === "longWait")).toBe(true);
    }
  });

  it("fades out as soon as the teacher starts talking", () => {
    const out = run({ seconds: 30, signalsAt: (t) => sig({ isSpeaking: t > 27 }) }).outputs;
    const at = out.find((o) => o.t > 27.02)!;
    expect(at.overlay!.fadeOutAt).toBeLessThanOrEqual(27.02);
    expect(at.overlay!.endsAt - at.overlay!.fadeOutAt).toBeCloseTo(FADE.upperOut, 5);
    expect(out.find((o) => o.t > 27.02 + FADE.upperOut + 0.05)!.overlay).toBeNull();
  });

  it("respects Idle3's cooldown", () => {
    const out = run({ seconds: 200, signalsAt: () => sig() }).outputs;
    const starts = out.filter((o, i) => o.overlay?.scenario === "longWait" && out[i - 1]?.overlay?.seq !== o.overlay.seq).map((o) => o.t);
    expect(starts.length).toBeGreaterThan(1);
    const cooldown = CLIP_MANIFEST.find((c) => c.id === "Idle3")!.cooldown;
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(DURATIONS.get("Idle3")! + cooldown - 0.1);
    }
  });

  it("never plays on a rig without Idle3", () => {
    const out = run({ seconds: 60, signalsAt: () => sig(), available: () => availableFor(CUSTOM_CLIP_SET) }).outputs;
    expect(out.some((o) => o.overlay)).toBe(false);
  });
});

describe("quiz and lesson events (rows 16, 18)", () => {
  const cases: Array<[string, Partial<DirectorSignals>, Scenario | null, string | null]> = [
    ["quiz passed nods",                    { quizResult: { score: 3, total: 5 } }, "quizGood",       "Nodding"],
    ["quiz not passed: no clip yet",  { quizResult: { score: 2, total: 5 } }, null,             null],
    ["lesson complete nods",                { lessonComplete: true },               "quizGood",       "Nodding"],
  ];
  it.each(cases)("%s", (_name, over, scenario, clip) => {
    const out = run({ seconds: 2, signalsAt: (t) => sig(t > 0.5 ? over : {}) }).outputs;
    const hit = out.find((o) => o.overlay);
    if (!scenario) { expect(hit).toBeUndefined(); return; }
    expect(hit!.overlay!.scenario).toBe(scenario);
    expect(hit!.overlay!.clip).toBe(clip);
  });

  it("a teacher mounted after the result does not react to it", () => {
    const seed = sig({ quizResult: { score: 5, total: 5 }, lessonComplete: true });
    const out = run({ seconds: 2, state: createDirectorState("Idle", seed), signalsAt: () => seed }).outputs;
    expect(out.some((o) => o.overlay)).toBe(false);
  });
});

// ─── Look and face ───────────────────────────────────────────────────────────

describe("look target", () => {
  const cases: Array<[string, Partial<DirectorSignals>, number, string]> = [
    ["the student by default (row 21)",   {},                                                   1,  "camera"],
    ["the student while speaking",        { isSpeaking: true },                                 1,  "camera"],
    ["the board while pointing (row 8)",  { gesture: "pointing", isSpeaking: true },            1,  "board"],
    ["the clip's own gaze while thinking",{ isLoading: true },                                  1,  "none"],
    ["the desk during a quiz (row 15)",   { quizActive: true },                                 1,  "desk"],
    ["the model while it is handled (10)",{ modelShown: true, modelInteracting: true },         10, "model"],
    ["the student while awaiting (12)",   { awaitingAnswer: true },                             1,  "camera"],
  ];
  it.each(cases)("%s", (_name, over, at, expected) => {
    const out = run({ seconds: at, signalsAt: () => sig(over) }).outputs;
    expect(out.at(-1)!.look).toBe(expected);
  });

  it("turns to a new model for a moment, then back (row 9)", () => {
    const out = run({ seconds: 10, signalsAt: (t) => sig({ modelShown: t > 1 }) }).outputs;
    expect(out.find((o) => o.t > 1.1)!.look).toBe("model");
    expect(out.find((o) => o.t > 1 + PRESENT_LOOK_S + 0.1)!.look).toBe("camera");
  });
});

// ─── Blend helpers ───────────────────────────────────────────────────────────

describe("overlayBlend", () => {
  const play = { startedAt: 10, fadeIn: 0.2, fadeOutAt: 12, endsAt: 12.3 };
  const cases: Array<[number, number]> = [
    [9.9, 0], [10, 0], [10.1, 0.5], [10.2, 1], [11, 1], [12, 1], [12.15, 0.5], [12.3, 0], [13, 0],
  ];
  it.each(cases)("at %s is %s", (now, expected) => {
    expect(overlayBlend(play, now)).toBeCloseTo(expected, 5);
  });
});

describe("overlayWeight", () => {
  it("shows the asked share of the overlay over a base of weight 1", () => {
    for (const blend of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const w = overlayWeight(blend);
      expect(w / (w + 1)).toBeCloseTo(blend * OVERLAY_DOMINANCE, 5);
    }
  });
  it("is 0 at 0 and finite at 1", () => {
    expect(overlayWeight(0)).toBe(0);
    expect(Number.isFinite(overlayWeight(1))).toBe(true);
    expect(overlayWeight(1)).toBeGreaterThan(50);
  });
});
