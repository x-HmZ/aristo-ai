import { describe, expect, it } from "vitest";
import { getMasteryTier, PREREQ_THRESHOLD } from "@/lib/mastery/thresholds";

describe("getMasteryTier", () => {
  it("puts each boundary score in the tier it opens", () => {
    expect(getMasteryTier(0)).toBe("not_learned");
    expect(getMasteryTier(0.29)).toBe("not_learned");
    expect(getMasteryTier(0.3)).toBe("in_progress");
    expect(getMasteryTier(0.69)).toBe("in_progress");
    expect(getMasteryTier(0.7)).toBe("learned");
    expect(getMasteryTier(0.89)).toBe("learned");
    expect(getMasteryTier(0.9)).toBe("mastered");
    expect(getMasteryTier(1)).toBe("mastered");
  });

  it("treats the prerequisite threshold as learned", () => {
    expect(getMasteryTier(PREREQ_THRESHOLD)).toBe("learned");
  });
});
