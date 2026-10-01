import { describe, expect, it } from "vitest";
import { CLIPS_BY_ID } from "@/lib/avatar/animationManifest";
import {
  AIM_PICTURE, ROOM_ASPECT, ROOM_FOV, ROOM_PICTURE, ROOM_PRESENT_TIP, ROOM_T, VOLCANO, lineAt, roomAimAt, roomFov,
  roomSignals, roomStateAt, shotAt,
} from "./room";
import { LESSON, OUTSIDE, lookAround, roomCameraAt } from "./roomCamera";

const near = (a: readonly number[], b: readonly number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 9));
const pitchOf = (p: { pos: readonly number[]; target: readonly number[] }) => {
  const d = [0, 1, 2].map((i) => p.target[i] - p.pos[i]);
  return Math.asin(d[1] / Math.hypot(d[0], d[1], d[2]));
};

describe("roomCameraAt", () => {
  it("holds the first frame (outside, looking in) a moment, so going live never jumps from the poster", () => {
    near(roomCameraAt(0).pos, OUTSIDE.pos);
    near(roomCameraAt(0).target, OUTSIDE.target);
    near(roomCameraAt(0.6).pos, OUTSIDE.pos);
    near(roomCameraAt(0.6).target, OUTSIDE.target);
  });

  it("is at the classroom's own lesson camera once in, and back there at the end", () => {
    near(roomCameraAt(ROOM_T.shots[0]).pos, LESSON.pos);
    near(roomCameraAt(ROOM_T.length).pos, LESSON.pos);
    near(roomCameraAt(ROOM_T.length).target, LESSON.target);
  });

  it("tilts down to the desk and back up without the view swinging past either end (a head tilting)", () => {
    const from = pitchOf(roomCameraAt(24.7)), to = pitchOf(roomCameraAt(25.6));
    for (let t = 24.7; t <= 25.6; t += 0.05) {
      const p = pitchOf(roomCameraAt(t));
      expect(p).toBeLessThanOrEqual(from + 1e-9);
      expect(p).toBeGreaterThanOrEqual(to - 1e-9);
    }
  });
});

describe("roomFov", () => {
  it("is the classroom's 40 degrees up to the composition aspect", () => {
    expect(roomFov(1)).toBe(ROOM_FOV);
    expect(roomFov(ROOM_ASPECT)).toBe(ROOM_FOV);
  });

  it("keeps the composition's horizontal view in a wider box, as the poster covers it", () => {
    const hfov = (fov: number, aspect: number) => Math.atan(Math.tan((fov * Math.PI) / 360) * aspect);
    for (const a of [1.9, 2.2, 2.6]) expect(hfov(roomFov(a), a)).toBeCloseTo(hfov(ROOM_FOV, ROOM_ASPECT), 10);
  });
});

describe("lookAround", () => {
  it("is the tour's own target with no look, and keeps the distance when turned", () => {
    expect(lookAround(LESSON, 0, 0)).toEqual(LESSON.target);
    const t = lookAround(LESSON, 0.4, 0.2);
    const d = (p: readonly number[]) => Math.hypot(p[0] - LESSON.pos[0], p[1] - LESSON.pos[1], p[2] - LESSON.pos[2]);
    expect(d(t)).toBeCloseTo(d(LESSON.target), 10);
    expect(t[0]).toBeGreaterThan(LESSON.target[0]);
    expect(t[1]).toBeGreaterThan(LESSON.target[1]);
  });
});

describe("the tour's timeline", () => {
  it("has its shots in order and its lines one after another, never overlapping", () => {
    for (let i = 1; i < ROOM_T.shots.length; i++) expect(ROOM_T.shots[i]).toBeGreaterThan(ROOM_T.shots[i - 1]);
    for (let i = 1; i < ROOM_T.lines.length; i++) {
      const a = ROOM_T.lines[i - 1], b = ROOM_T.lines[i];
      expect(b.at).toBeGreaterThan(a.at + a.until);
    }
    const last = ROOM_T.lines[ROOM_T.lines.length - 1];
    expect(last.at + last.until).toBeLessThan(ROOM_T.length);
  });

  it("says each line in its own shot", () => {
    ROOM_T.lines.forEach((l, i) => {
      expect(shotAt(l.at)).toBe(i);
      expect(shotAt(l.at + l.until - 0.01)).toBe(i);
    });
  });

  it("finds the line being said", () => {
    expect(lineAt(0)).toBeNull();
    const l = ROOM_T.lines[1];
    expect(lineAt(l.at + 1)).toEqual({ index: 1, t: 1 });
    expect(lineAt(l.at + l.until)).toBeNull();
  });

  it("points while he says 'Take a look at this cross-section' (the first 1.62 s of seg_008), with the picture up", () => {
    const l = ROOM_T.lines[1];
    expect(ROOM_T.point[0]).toBeLessThanOrEqual(l.at);
    expect(ROOM_T.point[1]).toBeGreaterThan(l.at + 1.62);
    expect(roomStateAt(ROOM_T.point[0]).picture).toBe(true);
    expect(roomAimAt(l.at + 1)).toEqual(AIM_PICTURE);
    expect(roomAimAt(ROOM_T.point[1])).toBeNull();
  });

  it("shows the model as the picture goes, and the quiz only in the desk shot", () => {
    expect(roomStateAt(ROOM_T.model - 0.01)).toMatchObject({ picture: true, model: false });
    expect(roomStateAt(ROOM_T.model)).toMatchObject({ picture: false, model: true });
    expect(shotAt(ROOM_T.quiz[0])).toBe(3);
    expect(roomStateAt(ROOM_T.quiz[1]).quiz).toBe(false);
  });
});

describe("roomSignals", () => {
  it("speaks each line in its lesson phase, as its own segment", () => {
    const s = roomSignals(ROOM_T.lines[0].at + 0.5, true);
    expect(s).toMatchObject({ isSpeaking: true, phase: "explain", segmentId: "room:seg_003" });
    expect(roomSignals(ROOM_T.lines[2].at + 0.5, false).phase).toBe("demonstrate");
  });

  it("points, shows the model (PresentModel's edge) and puts the quiz on the desk at their times", () => {
    expect(roomSignals(ROOM_T.point[0], false).gesture).toBe("pointing");
    expect(roomSignals(ROOM_T.model - 0.01, false).modelShown).toBe(false);
    expect(roomSignals(ROOM_T.model, false).modelShown).toBe(true);
    expect(roomSignals(ROOM_T.quiz[0], false).quizActive).toBe(true);
  });

  it("never greets: the waves are the hero's and the close's", () => {
    for (let t = 0; t < ROOM_T.length; t += 0.5) expect(roomSignals(t, false).sceneReady).toBe(false);
  });

  it("uses only signals whose clips Jake has (pointing's pool, PresentModel, HoldIdea)", () => {
    for (const id of ["PointNear", "PresentModel", "HoldIdea"]) expect(CLIPS_BY_ID.has(id)).toBe(true);
  });
});

describe("placement", () => {
  it("puts the model's near edge 2 cm past his presenting fingertip, its base level with it", () => {
    expect(VOLCANO.position[0] - VOLCANO.half - ROOM_PRESENT_TIP[0]).toBeCloseTo(VOLCANO.gap, 10);
    const base = VOLCANO.position[1] - VOLCANO.height / 2;
    expect(Math.abs(base - ROOM_PRESENT_TIP[1])).toBeLessThan(0.05);
  });

  it("aims his finger at the picture's middle, on the picture", () => {
    expect(AIM_PICTURE[2]).toBe(ROOM_PICTURE.position[2]);
    expect(Math.abs(AIM_PICTURE[0] - ROOM_PICTURE.position[0])).toBeLessThan(ROOM_PICTURE.size / 2);
  });
});
