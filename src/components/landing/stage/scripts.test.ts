import { describe, expect, it } from "vitest";
import { CLIPS_BY_ID } from "@/lib/avatar/animationManifest";
import { HEART, IDEAS_T, IDEA_T, MODEL_T, MOVES_T, MOVE_IDS, PICTURE_AIM, PICTURE_PLACE, PICTURE_T, PRESENT_PEAK, WAVE_AFTER_S, heartBox, heartBuildAt, moveBeatAt, signalsFor } from "./scripts";
import { BOARD, EYE } from "./spots";

const ctx = { liveFor: 0, t: 0, mayWave: true, speaking: false };

describe("signalsFor", () => {
  it("greets at the hero and the close once the teacher has been seen, if the cool-down allows", () => {
    for (const spot of ["hero", "close"] as const) {
      expect(signalsFor(spot, ctx).sceneReady).toBe(false);
      expect(signalsFor(spot, { ...ctx, liveFor: WAVE_AFTER_S }).sceneReady).toBe(true);
      expect(signalsFor(spot, { ...ctx, liveFor: 5, mayWave: false }).sceneReady).toBe(false);
    }
  });

  it("never greets at the model spot", () => {
    expect(signalsFor("model", { ...ctx, liveFor: 5, t: 5 }).sceneReady).toBe(false);
  });

  it("shows the model (PresentModel's edge) at its cue, and holds it", () => {
    expect(signalsFor("model", { ...ctx, t: MODEL_T.present - 0.01 }).modelShown).toBe(false);
    expect(signalsFor("model", { ...ctx, t: MODEL_T.present }).modelShown).toBe(true);
    expect(signalsFor("model", { ...ctx, t: MODEL_T.length }).modelShown).toBe(true);
  });

  it("passes speaking through", () => {
    expect(signalsFor("hero", { ...ctx, speaking: true }).isSpeaking).toBe(true);
  });
});

describe("the heart's placement from the hand", () => {
  it("puts its near edge just past the fingertip at the peak, not behind or through it", () => {
    const edge = HEART.position[0] - HEART.half;
    expect(edge - PRESENT_PEAK.index[0]).toBeGreaterThan(0);
    expect(edge - PRESENT_PEAK.index[0]).toBeLessThan(0.05);
  });
  it("has the open hand level with its lower third", () => {
    const bottom = HEART.position[1] - HEART.height / 2;
    const k = (PRESENT_PEAK.index[1] - bottom) / HEART.height;
    expect(k).toBeGreaterThan(0.25);
    expect(k).toBeLessThan(0.45);
  });
  it("keeps it inside the model spot's box, turning included", () => {
    const b = heartBox();
    expect(b.left).toBeGreaterThan(0);
    expect(b.top).toBeGreaterThan(0);
    expect(b.left + b.width).toBeLessThan(100);
    expect(b.top + b.height).toBeLessThan(100);
  });
  it("builds from the picture to the model over the section's clock", () => {
    expect(heartBuildAt(0)).toEqual({ build: 0, show: 0 });
    expect(heartBuildAt(MODEL_T.lift).build).toBe(0);
    expect(heartBuildAt(MODEL_T.built).build).toBe(1);
    expect(heartBuildAt(MODEL_T.present).show).toBe(1);
  });
});

describe("the hero's reactions", () => {
  it("offers a hand towards Try a lesson on each hover (PresentModel on modelShown's edge)", () => {
    expect(signalsFor("hero", { ...ctx, hover: "try", seq: 3 }).modelShown).toBe(true);
    expect(signalsFor("hero", { ...ctx, hover: null, seq: 3 }).modelShown).toBe(false);
  });
  it("does nothing extra with no hover, and never outside the hero", () => {
    const s = signalsFor("hero", { ...ctx, hover: null, seq: 5 });
    expect(s.segmentId).toBeNull();
    expect(s.reaction).toBeNull();
    expect(signalsFor("close", { ...ctx, hover: "try", seq: 5 }).modelShown).toBe(false);
  });
});

describe("the idea, the ideas and the picture", () => {
  it("holds the idea with the product's explain beat, from its cue", () => {
    expect(signalsFor("idea", { ...ctx, t: IDEA_T.hold - 0.01 }).segmentId).toBeNull();
    const s = signalsFor("idea", { ...ctx, t: IDEA_T.hold });
    expect(s.phase).toBe("explain");
    expect(s.segmentId).toBe("idea:hold");
  });
  it("thinks while the topic is read, then points while the ideas link", () => {
    expect(signalsFor("ideas", { ...ctx, t: IDEAS_T.think[0] }).isLoading).toBe(true);
    expect(signalsFor("ideas", { ...ctx, t: IDEAS_T.think[1] }).isLoading).toBe(false);
    expect(signalsFor("ideas", { ...ctx, t: IDEAS_T.point[0] }).gesture).toBe("pointing");
    expect(signalsFor("ideas", { ...ctx, t: IDEAS_T.point[1] }).gesture).toBe("idle");
  });
  it("points at the picture only once it has mostly resolved", () => {
    expect(PICTURE_T.point[0]).toBeGreaterThan(PICTURE_T.resolve[0] + 0.7 * (PICTURE_T.resolve[1] - PICTURE_T.resolve[0]));
    expect(signalsFor("picture", { ...ctx, t: PICTURE_T.point[0] }).gesture).toBe("pointing");
    expect(signalsFor("picture", { ...ctx, t: PICTURE_T.point[0] - 0.01 }).gesture).toBe("idle");
  });
  it("aims at a point on the picture", () => {
    const half = PICTURE_PLACE.size / 2;
    expect(Math.abs(PICTURE_AIM[0] - PICTURE_PLACE.position[0])).toBeLessThan(half);
    expect(Math.abs(PICTURE_AIM[1] - PICTURE_PLACE.position[1])).toBeLessThan(half);
    expect(PICTURE_AIM[2]).toBe(PICTURE_PLACE.position[2]);
  });
  it("sets the picture back behind his hand, looking exactly like the board from the eye", () => {
    expect(PICTURE_PLACE.position[2]).toBeLessThan(BOARD.center[2]);
    const seen = (x: number, z: number) => x / (EYE[2] - z);
    expect(seen(PICTURE_PLACE.position[0], PICTURE_PLACE.position[2])).toBeCloseTo(seen(BOARD.center[0], BOARD.center[2]));
    expect(seen(PICTURE_PLACE.size, PICTURE_PLACE.position[2])).toBeCloseTo(seen(BOARD.size, BOARD.center[2]));
  });
});

describe("One Lesson, Five Moves", () => {
  it("plays nothing before the first move, so a replay re-arms the sparse beats", () => {
    expect(moveBeatAt(0)).toBeNull();
    expect(signalsFor("moves", { ...ctx, t: MOVES_T.at[0] - 0.01 }).segmentId).toBeNull();
  });

  it("sends each move as the lesson's own segment: its phase, its role, a new id", () => {
    const at = (t: number) => signalsFor("moves", { ...ctx, t });
    expect(MOVE_IDS.map((_, i) => at(MOVES_T.at[i] + 0.1).phase)).toEqual(["activate", "explain", "demonstrate", "challenge", "connect"]);
    expect(MOVE_IDS.map((_, i) => at(MOVES_T.at[i] + 0.1).role)).toEqual(["hook", null, "demo_step", "challenge_setup", null]);
    const ids = new Set(MOVES_T.at.map((t) => at(t + 0.1).segmentId));
    expect(ids.size).toBe(5);
  });

  it("gives each step of Demonstrate its own segment, so each one chops", () => {
    const ids = MOVES_T.steps.map((t) => signalsFor("moves", { ...ctx, t: t + 0.1 }).segmentId);
    expect(new Set(ids).size).toBe(3);
    expect(MOVES_T.steps[0]).toBe(MOVES_T.at[2]);
    expect(MOVES_T.steps[2]).toBeLessThan(MOVES_T.at[3]);
  });

  it("leaves each gesture time to finish before the next move starts", () => {
    // The longest move gesture: YourTurn at its 0.85 rate; every other is shorter.
    const longest = Math.max(...["Imagine", "HoldIdea", "YourTurn", "BringTogether"].map((id) => {
      const c = CLIPS_BY_ID.get(id)!;
      return c.duration / (c.timeWarp?.[0] ?? 1);
    }));
    for (let i = 1; i < MOVES_T.at.length; i++) expect(MOVES_T.at[i] - MOVES_T.at[i - 1]).toBeGreaterThan(longest + 0.5);
    const step = CLIPS_BY_ID.get("StepBeat")!.duration;
    for (let i = 1; i < MOVES_T.steps.length; i++) expect(MOVES_T.steps[i] - MOVES_T.steps[i - 1]).toBeGreaterThan(step);
    expect(MOVES_T.length - MOVES_T.at[4]).toBeGreaterThan(longest + 0.5);
  });

  it("says that's right once, after the answer, and is done before Connect", () => {
    expect(signalsFor("moves", { ...ctx, t: MOVES_T.nod - 0.01 }).reaction).toBeNull();
    expect(signalsFor("moves", { ...ctx, t: MOVES_T.nod }).reaction).toEqual({ kind: "nodding", id: 1 });
    expect(signalsFor("moves", { ...ctx, t: MOVES_T.length }).reaction).toEqual({ kind: "nodding", id: 1 });
    expect(MOVES_T.nod).toBeGreaterThan(MOVES_T.answer);
    const longest = Math.max(...["Nodding", "Exactly"].map((id) => CLIPS_BY_ID.get(id)!.duration));
    expect(MOVES_T.at[4] - MOVES_T.nod).toBeGreaterThan(longest + 0.2);
  });

  it("never waves or shows a model there", () => {
    const s = signalsFor("moves", { ...ctx, liveFor: 5, t: 10 });
    expect(s.sceneReady).toBe(false);
    expect(s.modelShown).toBe(false);
  });
});
