import { describe, expect, it } from "vitest";
import {
  AVATURN_CLIP_SET,
  CANINO_CLIP_SET,
  CLIPS_BY_ID,
  CLIP_MANIFEST,
  CUSTOM_CLIP_SET,
  LEGACY_CLIP_SET,
  MOUNT_CLIP,
  SCENARIOS,
  type ClipMask,
  type Scenario,
} from "@/lib/avatar/animationManifest";
import { phaseOf, resolvePool } from "@/lib/avatar/director";

const CLIP_SETS = {
  canino:  CANINO_CLIP_SET,
  avaturn: AVATURN_CLIP_SET,
  custom:  CUSTOM_CLIP_SET,
  legacy:  LEGACY_CLIP_SET,
} as const;

describe("phaseOf", () => {
  const lesson = {
    segments: [
      { id: "seg_001", phase: "activate" as const },
      { id: "seg_002", phase: "explain" as const },
      { id: "seg_003", phase: "demonstrate" as const },
      { id: "seg_004", phase: "challenge" as const },
      { id: "seg_005", phase: "connect" as const },
    ],
  };
  it.each([
    ["seg_001", "activate"],
    ["seg_002", "explain"],
    ["seg_003", "demonstrate"],
    ["seg_004", "challenge"],
    ["seg_005", "connect"],
  ])("%s is %s", (id, phase) => {
    expect(phaseOf(lesson, id)).toBe(phase);
  });
  it("is null with no lesson", () => {
    expect(phaseOf(null, "seg_001")).toBeNull();
    expect(phaseOf(undefined, "seg_001")).toBeNull();
  });
  it("is null with no segment id", () => {
    expect(phaseOf(lesson, null)).toBeNull();
    expect(phaseOf(lesson, undefined)).toBeNull();
  });
  it("is null for an unknown id", () => {
    expect(phaseOf(lesson, "seg_999")).toBeNull();
  });
  it("is null for a legacy lesson without segments", () => {
    expect(phaseOf({}, "seg_001")).toBeNull();
  });
});

describe("manifest integrity", () => {
  it.each(Object.entries(CLIP_SETS))("every clip in the %s set has a manifest row", (_, set) => {
    for (const id of set) expect(CLIPS_BY_ID.has(id), id).toBe(true);
  });

  it.each(Object.entries(CLIP_SETS))("%s set has the mount clip and no duplicates", (_, set) => {
    expect(set).toContain(MOUNT_CLIP);
    expect(new Set(set).size).toBe(set.length);
  });

  it("clip ids are unique", () => {
    expect(new Set(CLIP_MANIFEST.map((c) => c.id)).size).toBe(CLIP_MANIFEST.length);
  });

  it("upper clips use an upper or head mask, base clips the full one", () => {
    for (const c of CLIP_MANIFEST) {
      if (c.layer === "upper") expect(["upper", "head"], c.id).toContain(c.mask);
      else expect(c.mask, c.id).toBe("full");
    }
  });

  it("a clip serves scenarios of its own layer only", () => {
    for (const c of CLIP_MANIFEST) {
      for (const sc of c.scenarios) expect(SCENARIOS[sc].layer, `${c.id} -> ${sc}`).toBe(c.layer);
    }
  });

  it("every scenario's fallback chain terminates", () => {
    for (const start of Object.keys(SCENARIOS) as Scenario[]) {
      const seen = new Set<Scenario>();
      let sc: Scenario | undefined = start;
      while (sc) {
        expect(seen.has(sc), `${start} loops at ${sc}`).toBe(false);
        seen.add(sc);
        sc = SCENARIOS[sc].fallback;
      }
    }
  });

  it("no clip has a non-positive weight unless it has no scenarios", () => {
    for (const c of CLIP_MANIFEST) {
      if (c.scenarios.length) expect(c.weight, c.id).toBeGreaterThan(0);
    }
  });

  it("a base scenario has a clip on every rig, so the base never has nothing to play", () => {
    const masks = new Set<ClipMask>(["full"]);
    for (const [rig, set] of Object.entries(CLIP_SETS)) {
      const avail = new Map(set.map((id) => [id, 1]));
      for (const sc of Object.keys(SCENARIOS) as Scenario[]) {
        if (SCENARIOS[sc].layer !== "base") continue;
        expect(resolvePool(sc, avail, masks), `${rig}/${sc}`).not.toBeNull();
      }
    }
  });
});

// How many clips each catalogue row resolves to per rig, and which scenario
// supplied them when it is not the row's own. A pack change shows up here.
describe("coverage", () => {
  const ALL = new Set<ClipMask>(["full", "upper", "head"]);
  const rows = (Object.keys(SCENARIOS) as Scenario[]).sort((a, b) => SCENARIOS[a].row - SCENARIOS[b].row);
  const table = (set: readonly string[]): Record<string, string> => {
    const avail = new Map(set.map((id) => [id, 1]));
    const out: Record<string, string> = {};
    for (const sc of rows) {
      const found = resolvePool(sc, avail, ALL);
      const key = `${String(SCENARIOS[sc].row).padStart(2, "0")} ${sc}`;
      out[key] = !found ? "0" : found.scenario === sc ? `${found.clips.length}` : `${found.clips.length} via ${found.scenario}`;
    }
    return out;
  };

  it("canino (Jake, MJ)", () => {
    expect(table(CANINO_CLIP_SET)).toMatchInlineSnapshot(`
      {
        "01 idle": "3",
        "02 longWait": "1",
        "03 greeting": "2",
        "04 thinking": "2",
        "05 talking": "6",
        "06 talkActivate": "6 via talking",
        "07 talkExplain": "6 via talking",
        "08 point": "1",
        "09 presentModel": "0",
        "11 talkChallenge": "6 via talking",
        "12 listen": "3",
        "13 correct": "1",
        "14 wrong": "1",
        "15 quizLook": "3",
        "16 quizGood": "1",
        "16 quizSupportive": "0",
        "17 talkConnect": "6 via talking",
        "18 lessonComplete": "1 via quizGood",
        "19 explaining": "6 via talking",
      }
    `);
  });
  it("avaturn (Marcus, Priya)", () => {
    expect(table(AVATURN_CLIP_SET)).toMatchInlineSnapshot(`
      {
        "01 idle": "3",
        "02 longWait": "1",
        "03 greeting": "1",
        "04 thinking": "2",
        "05 talking": "5",
        "06 talkActivate": "5 via talking",
        "07 talkExplain": "5 via talking",
        "08 point": "1",
        "09 presentModel": "0",
        "11 talkChallenge": "5 via talking",
        "12 listen": "3",
        "13 correct": "1",
        "14 wrong": "1",
        "15 quizLook": "3",
        "16 quizGood": "1",
        "16 quizSupportive": "0",
        "17 talkConnect": "5 via talking",
        "18 lessonComplete": "1 via quizGood",
        "19 explaining": "5 via talking",
      }
    `);
  });
  it("custom teachers", () => {
    expect(table(CUSTOM_CLIP_SET)).toMatchInlineSnapshot(`
      {
        "01 idle": "1",
        "02 longWait": "0",
        "03 greeting": "0",
        "04 thinking": "1",
        "05 talking": "2",
        "06 talkActivate": "2 via talking",
        "07 talkExplain": "2 via talking",
        "08 point": "1",
        "09 presentModel": "0",
        "11 talkChallenge": "2 via talking",
        "12 listen": "1",
        "13 correct": "1",
        "14 wrong": "1",
        "15 quizLook": "1",
        "16 quizGood": "1",
        "16 quizSupportive": "0",
        "17 talkConnect": "2 via talking",
        "18 lessonComplete": "1 via quizGood",
        "19 explaining": "2 via talking",
      }
    `);
  });
  it("legacy (Ryan, Sonia)", () => {
    expect(table(LEGACY_CLIP_SET)).toMatchInlineSnapshot(`
      {
        "01 idle": "1",
        "02 longWait": "0",
        "03 greeting": "0",
        "04 thinking": "1",
        "05 talking": "2",
        "06 talkActivate": "2 via talking",
        "07 talkExplain": "2 via talking",
        "08 point": "2 via talking",
        "09 presentModel": "0",
        "11 talkChallenge": "2 via talking",
        "12 listen": "1",
        "13 correct": "0",
        "14 wrong": "0",
        "15 quizLook": "1",
        "16 quizGood": "0",
        "16 quizSupportive": "0",
        "17 talkConnect": "2 via talking",
        "18 lessonComplete": "0",
        "19 explaining": "2 via talking",
      }
    `);
  });
});
