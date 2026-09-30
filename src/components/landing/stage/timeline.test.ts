import { describe, expect, it } from "vitest";
import {
  LESSON, OUTSIDE, SECTIONS, actAt, cameraAt, damp, moveAt, roomAt, sceneTime, seg, teacherSignals, teacherYaw,
  TURN_FROM, window01, type Pose,
} from "./timeline";

const DESK: Pose = { pos: [0, 0.133, 0.083], target: [0, -1.05, -0.6] };
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const ctx = { greeted: true, speaking: false };

describe("sceneTime", () => {
  it("is the last started section's index plus its progress", () => {
    expect(sceneTime([0, 0, 0, 0, 0, 0, 0])).toBe(0);
    expect(sceneTime([0.5, 0, 0, 0, 0, 0, 0])).toBe(0.5);
    expect(sceneTime([1, 1, 0.25, 0, 0, 0, 0])).toBe(2.25);
    expect(sceneTime([1, 1, 1, 1, 1, 1, 1])).toBe(7);
  });
  it("covers every section in page order", () => {
    expect(SECTIONS.map((s) => s.id)).toEqual(["top", "idea", "how", "moves", "map", "parents", "start"]);
  });
});

describe("helpers", () => {
  it("seg clamps, window01 ramps", () => {
    expect(seg(-1, 0, 1)).toBe(0);
    expect(seg(0.5, 0, 1)).toBe(0.5);
    expect(seg(2, 0, 1)).toBe(1);
    expect(window01(0.5, 0.4, 0.6, 0.1)).toBe(1);
    expect(window01(0.35, 0.4, 0.6, 0.1)).toBeCloseTo(0.5);
    expect(window01(0.8, 0.4, 0.6, 0.1)).toBe(0);
  });
  it("damp approaches without overshoot and caps a long frame", () => {
    const v = damp(0, 1, 10, 0.016);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1);
    expect(damp(0, 1, 10, 5)).toBeCloseTo(damp(0, 1, 10, 0.1));
  });
});

describe("cameraAt", () => {
  it("starts outside and lands on the lesson framing", () => {
    expect(cameraAt(0, DESK)).toEqual({ pos: OUTSIDE.pos, target: OUTSIDE.target });
    expect(dist(cameraAt(0.62, DESK).pos, LESSON.pos)).toBeLessThan(1e-9);
    expect(dist(cameraAt(1, DESK).pos, LESSON.pos)).toBeLessThan(1e-9);
  });
  it("is at the desk in the middle of the challenge and off it by connect", () => {
    expect(dist(cameraAt(3.74, DESK).pos, DESK.pos)).toBeLessThan(1e-9);
    expect(dist(cameraAt(3.82, DESK).pos, DESK.pos)).toBeGreaterThan(0.3);
  });
  it("never jumps: a 1/2000 step of S (about 3px of scroll) moves the camera less than 2 cm", () => {
    let prev = cameraAt(0, DESK);
    let worst = 0;
    for (let i = 1; i <= 14000; i++) {
      const next = cameraAt(i / 2000, DESK);
      worst = Math.max(worst, dist(prev.pos, next.pos), dist(prev.target, next.target) / 5);
      prev = next;
    }
    expect(worst).toBeLessThan(0.02);
  });
});

describe("roomAt", () => {
  it("opens the window through the opening and closes it again for the close", () => {
    expect(roomAt(0).open).toBe(0);
    expect(roomAt(0.7).open).toBe(1);
    expect(roomAt(3).open).toBe(1);
    expect(roomAt(6.8).open).toBe(0);
  });
  it("hides the room for the map and the parents, and brings it back for the close", () => {
    expect(roomAt(3.9).canvas).toBe(1);
    expect(roomAt(4.5).canvas).toBe(0);
    expect(roomAt(5.5).canvas).toBe(0);
    expect(roomAt(6.2).canvas).toBe(1);
  });
  it("resolves the diagram, sends it to the wall for the model, and brings it back for Demonstrate", () => {
    expect(roomAt(2.4).diagram).toBe(0);
    expect(roomAt(2.64).diagram).toBe(1);
    expect(roomAt(2.6).diagramPlace).toBe(0);
    expect(roomAt(2.8).diagramPlace).toBe(1);
    expect(roomAt(3.5).diagramPlace).toBe(0);
    expect(roomAt(3.5).model).toBe(0);
    expect(roomAt(3.7).diagramPlace).toBe(1);
    expect(roomAt(3.7).model).toBe(1);
  });
  it("builds the model from the photo in the fifth beat", () => {
    expect(roomAt(2.6).build).toBe(0);
    expect(roomAt(2.9).build).toBe(1);
  });
});

describe("moveAt", () => {
  it("splits the five moves evenly", () => {
    expect(moveAt(2.99)).toBeNull();
    expect(moveAt(3)).toEqual({ index: 0, q: 0 });
    expect(moveAt(3.5)!.index).toBe(2);
    expect(moveAt(3.99)!.index).toBe(4);
    expect(moveAt(4)).toBeNull();
  });
});

describe("teacherSignals", () => {
  it("holds the greeting until the turn is done", () => {
    expect(teacherSignals(0.1, { greeted: false, speaking: false }).sceneReady).toBe(false);
    expect(teacherSignals(0.1, ctx).sceneReady).toBe(true);
  });
  it("generates: loading while the question is asked and the ideas are found", () => {
    expect(teacherSignals(2.1, ctx).isLoading).toBe(true);
    expect(teacherSignals(2.35, ctx).isLoading).toBe(false);
    expect(teacherSignals(2.35, ctx).phase).toBe("explain");
  });
  it("leaves a segment gap between the cards and the moves, so the explain beat can fire again", () => {
    expect(teacherSignals(2.55, ctx).segmentId).toBeNull();
    expect(teacherSignals(3.25, ctx).segmentId).toBe("moves:seg_004");
  });
  it("points at the diagram, presents the model, opens the lesson on the hook", () => {
    expect(teacherSignals(2.66, ctx).gesture).toBe("pointing");
    expect(teacherSignals(2.66, ctx).previewImage).not.toBeNull();
    expect(teacherSignals(2.8, ctx).modelShown).toBe(false);
    expect(teacherSignals(2.86, ctx).modelShown).toBe(true);
    expect(teacherSignals(2.95, ctx).role).toBe("hook");
  });
  it("maps each move to the product's own signal", () => {
    expect(teacherSignals(3.05, ctx).role).toBe("hook");
    expect(teacherSignals(3.25, ctx).phase).toBe("explain");
    expect(teacherSignals(3.42, ctx).role).toBe("demo_step");
    expect(teacherSignals(3.52, ctx).gesture).toBe("pointing");
    expect(teacherSignals(3.62, ctx).role).toBe("challenge_setup");
    expect(teacherSignals(3.74, ctx).quizActive).toBe(true);
    expect(teacherSignals(3.85, ctx).quizActive).toBe(false);
    expect(teacherSignals(3.85, ctx).role).toBeNull();
    expect(teacherSignals(3.85, ctx).phase).toBe("connect");
    expect(teacherSignals(3.99, ctx).lessonComplete).toBe(true);
  });
  it("keeps modelShown steady through the moves, so PresentModel cannot preempt YourTurn", () => {
    for (let S = 2.86; S < 4; S += 0.01) expect(teacherSignals(S, ctx).modelShown).toBe(true);
  });
  it("plays the close as a fresh act that waves goodbye on arrival", () => {
    expect(actAt(4.9)).toBe("page");
    expect(actAt(5.2)).toBe("close");
    expect(teacherSignals(5.5, ctx).sceneReady).toBe(false);
    expect(teacherSignals(6, ctx).sceneReady).toBe(true);
  });
  it("speaks only when the opt-in sound plays", () => {
    expect(teacherSignals(3.05, ctx).isSpeaking).toBe(false);
    expect(teacherSignals(3.05, { greeted: true, speaking: true }).isSpeaking).toBe(true);
  });
});

describe("teacherYaw", () => {
  it("turns from the board to the student", () => {
    expect(teacherYaw(0)).toBe(TURN_FROM);
    expect(teacherYaw(10)).toBe(0);
    expect(teacherYaw(0.9)).toBeLessThan(TURN_FROM);
  });
});
