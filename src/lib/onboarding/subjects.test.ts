import { describe, expect, it } from "vitest";
import { isOfferedDomain, onboardingBodySchema, subjectsFromCourses } from "./subjects";

const course = (domain: string, title: string, ids: string[]) => ({
  domain, title, structure: { modules: [{ lessons: ids.map((i) => ({ concept_ids: [i] })) }] },
});

describe("subjectsFromCourses", () => {
  it("lists one subject per published domain with its concept count", () => {
    const s = subjectsFromCourses([
      course("python_programming", "Python", ["a", "b"]),
      course("math_7", "Maths 7", ["x"]),
      course("python_programming", "Python (old)", ["b", "c"]),
    ]);
    expect(s).toEqual([
      { domain: "python_programming", title: "Python", conceptCount: 3 },
      { domain: "math_7", title: "Maths 7", conceptCount: 1 },
    ]);
  });

  it("is empty when nothing is published or courses have no concepts", () => {
    expect(subjectsFromCourses([])).toEqual([]);
    expect(subjectsFromCourses([{ domain: "x", title: "t", structure: { modules: [] } }, { domain: "y", title: "t", structure: null }])).toEqual([]);
  });

  it("no longer offers the old hardcoded science subject unless published", () => {
    const s = subjectsFromCourses([course("python_programming", "Python", ["a"])]);
    expect(isOfferedDomain("middle_school_science", s)).toBe(false);
    expect(isOfferedDomain("python_programming", s)).toBe(true);
  });
});

describe("onboardingBodySchema", () => {
  it("rejects a bad goal or missing domain and defaults the time", () => {
    expect(onboardingBodySchema.safeParse({ goal: "nope", domain: "x" }).success).toBe(false);
    expect(onboardingBodySchema.safeParse({ goal: "refresher" }).success).toBe(false);
    const ok = onboardingBodySchema.safeParse({ goal: "refresher", domain: "x" });
    expect(ok.success && ok.data.daily_time_minutes).toBe(20);
  });
});
