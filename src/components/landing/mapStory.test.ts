import { describe, expect, it } from "vitest";
import {
  CURVE_REVIEWS, EDGES, NEWEST, NODES, ORDER, REVIEWS, dayAt, learnedAt, masteryAt, pulseAt, recallOn, routeTo, stateAt,
} from "./mapStory";

describe("the example learner", () => {
  it("learns every concept after the ones it builds on", () => {
    for (const [from, to] of EDGES) expect(learnedAt(from)).toBeLessThan(learnedAt(to));
    expect(ORDER).toHaveLength(NODES.length);
  });
  it("starts with nothing mastered and ends with everything mastered", () => {
    for (const n of NODES) {
      expect(masteryAt(n.id, 0)).toBe(0);
      expect(masteryAt(n.id, 1)).toBeGreaterThan(0.9);
    }
  });
  it("lets three concepts fade, and each review brings its concept back", () => {
    for (const r of REVIEWS) {
      expect(masteryAt(r.id, 0.52)).toBeGreaterThan(0.9);
      expect(masteryAt(r.id, r.at)).toBeLessThan(0.6);
      expect(masteryAt(r.id, r.at + 0.1)).toBeGreaterThan(0.9);
    }
  });
  it("marks the frontier: ready when everything it builds on is mastered", () => {
    expect(stateAt(ORDER[0], 0)).toBe("ready");
    expect(stateAt(ORDER[ORDER.length - 1], 0)).toBe("later");
    expect(stateAt(ORDER[0], 0.2)).toBe("done");
  });
  it("counts days 1 to 21", () => {
    expect(dayAt(0)).toBe(1);
    expect(dayAt(1)).toBe(21);
  });
  it("routes each pulse along the links, from the newest concept to the faded one", () => {
    for (const r of REVIEWS) {
      const route = routeTo(NEWEST, r.id);
      expect(route[0]).toBe(NEWEST);
      expect(route[route.length - 1]).toBe(r.id);
      for (let i = 1; i < route.length; i++) {
        const a = route[i - 1], b = route[i];
        expect(EDGES.some(([x, y]) => (x === a && y === b) || (x === b && y === a))).toBe(true);
      }
    }
    expect(pulseAt(0, REVIEWS[0].at - 0.01)).toBeNull();
    expect(pulseAt(0, REVIEWS[0].at + 0.025)).toBeCloseTo(0.5);
  });
});

describe("recallOn", () => {
  it("is full at each review and decays more slowly after each one", () => {
    for (const d of CURVE_REVIEWS) expect(recallOn(d)).toBe(1);
    const drop = (i: number) => 1 - recallOn(CURVE_REVIEWS[i] + 1);
    expect(drop(1)).toBeLessThan(drop(0));
    expect(drop(2)).toBeLessThan(drop(1));
    expect(drop(3)).toBeLessThan(drop(2));
  });
});
