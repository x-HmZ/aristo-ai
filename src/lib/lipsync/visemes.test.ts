import { describe, it, expect } from "vitest";
import { mapCharacter, buildVisemeTimeline, visemeAt, parseAlignment, alignmentUrlFor } from "./visemes";

/** Compact helper: evenly spaced character timings for a string. */
function timings(text: string, msPerChar = 60) {
  return [...text].map((ch, i) => ({
    text:  ch,
    start: (i * msPerChar) / 1000,
    end:   ((i + 1) * msPerChar) / 1000,
  }));
}

describe("mapCharacter", () => {
  it("consumes digraphs as one sound", () => {
    expect(mapCharacter("t", "h")).toEqual({ viseme: "viseme_TH", consumed: 2 });
    expect(mapCharacter("s", "h")).toEqual({ viseme: "viseme_CH", consumed: 2 });
    expect(mapCharacter("c", "k")).toEqual({ viseme: "viseme_kk", consumed: 2 });
    expect(mapCharacter("p", "h")).toEqual({ viseme: "viseme_FF", consumed: 2 });
  });

  it("does not treat a digraph pair as one when the second letter differs", () => {
    expect(mapCharacter("t", "o")).toEqual({ viseme: "viseme_DD", consumed: 1 });
  });

  it("closes the lips on bilabials", () => {
    for (const c of ["b", "p", "m"]) {
      expect(mapCharacter(c).viseme).toBe("viseme_PP");
    }
  });

  it("is case insensitive", () => {
    expect(mapCharacter("A").viseme).toBe("viseme_aa");
    expect(mapCharacter("T", "H")).toEqual({ viseme: "viseme_TH", consumed: 2 });
  });

  it("maps whitespace and punctuation to silence", () => {
    expect(mapCharacter(" ").viseme).toBe("viseme_sil");
    expect(mapCharacter(".").viseme).toBe("viseme_sil");
    expect(mapCharacter(",").viseme).toBe("viseme_sil");
  });

  it("keeps the jaw open on digits rather than closing the mouth mid-speech", () => {
    expect(mapCharacter("7").viseme).toBe("viseme_aa");
  });
});

describe("buildVisemeTimeline", () => {
  it("collapses a run of identical visemes into one sustained span", () => {
    // "hello" -> aa E nn O, with the double-l merged
    const spans = buildVisemeTimeline(timings("hello"));
    expect(spans.map((s) => s.viseme)).toEqual([
      "viseme_aa", "viseme_E", "viseme_nn", "viseme_O",
    ]);
    const nn = spans[2];
    expect(nn.start).toBeCloseTo(0.12);
    expect(nn.end).toBeCloseTo(0.24);
  });

  it("spans a digraph across both of its characters", () => {
    const spans = buildVisemeTimeline(timings("the"));
    expect(spans.map((s) => s.viseme)).toEqual(["viseme_TH", "viseme_E"]);
    expect(spans[0].start).toBeCloseTo(0);
    expect(spans[0].end).toBeCloseTo(0.12);   // covers t AND h
    expect(spans[1].start).toBeCloseTo(0.12);
  });

  it("carries the previous shape through an apostrophe instead of going silent", () => {
    const spans = buildVisemeTimeline(timings("don't"));
    expect(spans.some((s) => s.viseme === "viseme_sil")).toBe(false);
    expect(spans.map((s) => s.viseme)).toEqual([
      "viseme_DD", "viseme_O", "viseme_nn", "viseme_DD",
    ]);
  });

  it("absorbs a short inter-word gap but keeps a real pause", () => {
    const short = buildVisemeTimeline([
      { text: "a", start: 0,    end: 0.10 },
      { text: " ", start: 0.10, end: 0.15 },   // 50ms — below MIN_SILENCE
      { text: "b", start: 0.15, end: 0.25 },
    ]);
    expect(short.map((s) => s.viseme)).toEqual(["viseme_aa", "viseme_PP"]);
    expect(short[0].end).toBeCloseTo(0.15);

    const long = buildVisemeTimeline([
      { text: "a", start: 0,    end: 0.10 },
      { text: " ", start: 0.10, end: 0.50 },   // 400ms — a real pause
      { text: "b", start: 0.50, end: 0.60 },
    ]);
    expect(long.map((s) => s.viseme)).toEqual(["viseme_aa", "viseme_sil", "viseme_PP"]);
  });

  it("produces a sorted, non-overlapping timeline", () => {
    const spans = buildVisemeTimeline(timings("the quick brown fox jumps"));
    expect(spans.length).toBeGreaterThan(5);
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i].start).toBeGreaterThanOrEqual(spans[i - 1].end - 1e-9);
      expect(spans[i].end).toBeGreaterThan(spans[i].start);
    }
  });

  it("survives an empty or malformed character list", () => {
    expect(buildVisemeTimeline([])).toEqual([]);
    // @ts-expect-error deliberately malformed
    expect(buildVisemeTimeline([{ text: "a" }])).toEqual([]);
  });
});

describe("visemeAt", () => {
  const timeline = buildVisemeTimeline(timings("hello"));

  it("returns nothing outside the clip", () => {
    expect(visemeAt(timeline, -1)).toBeNull();
    expect(visemeAt(timeline, 99)).toBeNull();
    expect(visemeAt([], 0.1)).toBeNull();
  });

  it("finds the span covering the given time", () => {
    expect(visemeAt(timeline, 0.02)?.viseme).toBe("viseme_aa");
    expect(visemeAt(timeline, 0.08)?.viseme).toBe("viseme_E");
    expect(visemeAt(timeline, 0.20)?.viseme).toBe("viseme_nn");
    expect(visemeAt(timeline, 0.28)?.viseme).toBe("viseme_O");
  });

  it("reports silence as nothing so the mouth closes", () => {
    const withPause = buildVisemeTimeline([
      { text: "a", start: 0,    end: 0.10 },
      { text: " ", start: 0.10, end: 0.60 },
      { text: "b", start: 0.60, end: 0.70 },
    ]);
    expect(visemeAt(withPause, 0.3)).toBeNull();
  });

  it("eases in and out rather than popping to full influence", () => {
    const mid  = visemeAt(timeline, 0.18)!.intensity;   // middle of the nn span
    const edge = visemeAt(timeline, 0.1205)!.intensity; // just inside its start
    expect(mid).toBeGreaterThan(edge);
    expect(edge).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });
});

describe("parseAlignment", () => {
  const good = {
    characters: [
      { text: "h", start: 0,    end: 0.05 },
      { text: "i", start: 0.05, end: 0.20 },
    ],
  };

  it("accepts a well-formed alignment", () => {
    const t = parseAlignment(good);
    expect(t).not.toBeNull();
    expect(t!.map((s) => s.viseme)).toEqual(["viseme_aa", "viseme_I"]);
  });

  it("rejects anything that is not a usable alignment", () => {
    expect(parseAlignment(null)).toBeNull();
    expect(parseAlignment("<!doctype html>")).toBeNull();
    expect(parseAlignment({})).toBeNull();
    expect(parseAlignment({ characters: [] })).toBeNull();
    expect(parseAlignment({ characters: [{ text: "a", start: 0 }] })).toBeNull();
    expect(parseAlignment({ characters: [{ text: "a", start: NaN, end: 1 }] })).toBeNull();
    expect(parseAlignment({ characters: [{ text: "a", start: 1, end: 0 }] })).toBeNull();
  });

  it("refuses a file that did not come from a real alignment run", () => {
    expect(parseAlignment({ ...good, generator: "synthetic-test-fixture" })).toBeNull();
    expect(parseAlignment({ ...good, generator: "elevenlabs-forced-alignment" })).not.toBeNull();
  });
});

describe("playback simulation", () => {
  // Sample the timeline the way Teacher.tsx's useFrame loop will: once per
  // rendered frame. Catches failure modes the per-call tests cannot see --
  // a mouth that chatters every frame, or one that sticks open for a second.
  const sentence = "The quick brown fox jumps over the lazy dog.";
  const chars = [...sentence].map((ch, i) => ({
    text:  ch,
    start: (i * 65) / 1000,
    end:   ((i + 1) * 65) / 1000,
  }));
  const timeline = buildVisemeTimeline(chars);
  const duration = chars[chars.length - 1].end;

  const frames: (string | null)[] = [];
  for (let t = 0; t < duration; t += 1 / 60) {
    frames.push(visemeAt(timeline, t)?.viseme ?? null);
  }

  it("keeps the mouth active through most of the clip", () => {
    const speaking = frames.filter((f) => f !== null).length;
    expect(speaking / frames.length).toBeGreaterThan(0.7);
  });

  it("changes shape often enough to read as speech, without chattering", () => {
    let changes = 0;
    for (let i = 1; i < frames.length; i++) if (frames[i] !== frames[i - 1]) changes++;
    const perSecond = changes / duration;
    expect(perSecond).toBeGreaterThan(3);
    expect(perSecond).toBeLessThan(25);
  });

  it("never holds one shape long enough to look frozen", () => {
    let run = 1, longest = 1;
    for (let i = 1; i < frames.length; i++) {
      run = frames[i] === frames[i - 1] ? run + 1 : 1;
      if (frames[i] !== null && run > longest) longest = run;
    }
    expect(longest / 60).toBeLessThan(0.6); // seconds
  });
});

describe("alignmentUrlFor", () => {
  it("swaps the extension of a pre-rendered segment URL", () => {
    expect(alignmentUrlFor("/demo/black-holes/seg_001.mp3"))
      .toBe("/demo/black-holes/seg_001.align.json");
  });

  it("drops any query or hash", () => {
    expect(alignmentUrlFor("/demo/x/seg_1.mp3?v=2")).toBe("/demo/x/seg_1.align.json");
    expect(alignmentUrlFor("/demo/x/seg_1.mp3#t=1")).toBe("/demo/x/seg_1.align.json");
  });

  it("is case insensitive about the extension", () => {
    expect(alignmentUrlFor("/demo/x/A.MP3")).toBe("/demo/x/A.align.json");
  });

  it("returns null for anything that is not an mp3, so no fetch is made", () => {
    expect(alignmentUrlFor("blob:http://localhost/abc-123")).toBeNull();
    expect(alignmentUrlFor("/demo/x/seg_1.wav")).toBeNull();
    expect(alignmentUrlFor("")).toBeNull();
  });
});

describe("parseAlignment — with-timestamps shape", () => {
  // What /v1/text-to-speech/{id}/with-timestamps returns: parallel arrays.
  const wts = {
    characters: ["h", "i", " ", "t", "h", "e", "r", "e"],
    character_start_times_seconds: [0.00, 0.05, 0.20, 0.25, 0.30, 0.36, 0.42, 0.48],
    character_end_times_seconds:   [0.05, 0.20, 0.25, 0.30, 0.36, 0.42, 0.48, 0.60],
  };

  it("reads the parallel-array form", () => {
    const t = parseAlignment(wts);
    expect(t).not.toBeNull();
    // "hi there" -> aa I (short gap absorbed) TH E RR E
    expect(t!.map((s) => s.viseme)).toEqual([
      "viseme_aa", "viseme_I", "viseme_TH", "viseme_E", "viseme_RR", "viseme_E",
    ]);
  });

  it("agrees with the object form for the same timings", () => {
    const asObjects = {
      characters: wts.characters.map((text, i) => ({
        text,
        start: wts.character_start_times_seconds[i],
        end:   wts.character_end_times_seconds[i],
      })),
    };
    expect(parseAlignment(asObjects)).toEqual(parseAlignment(wts));
  });

  it("rejects mismatched or malformed parallel arrays", () => {
    expect(parseAlignment({ ...wts, character_end_times_seconds: [0.05] })).toBeNull();
    expect(parseAlignment({ characters: ["a"], character_start_times_seconds: [0] })).toBeNull();
    expect(parseAlignment({
      characters: ["a"], character_start_times_seconds: [1], character_end_times_seconds: [0],
    })).toBeNull();
    expect(parseAlignment({
      characters: ["a"], character_start_times_seconds: ["x"], character_end_times_seconds: [1],
    })).toBeNull();
  });
});
