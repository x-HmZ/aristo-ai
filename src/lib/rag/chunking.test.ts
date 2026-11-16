import { describe, expect, it } from "vitest";
import { chunkPages, estimateTokens, looksLikeHeading } from "./chunking";
import { planBatches, estimateIngest, splitOversizedPage, sumEstimates } from "./batching";

const para = (n: number, word = "alpha") => `${word} `.repeat(n).trim() + ".";

describe("chunkPages", () => {
  it("returns nothing for empty or tiny input", () => {
    expect(chunkPages([])).toEqual([]);
    expect(chunkPages([{ page: 1, text: "short" }])).toEqual([]);
  });

  it("keeps paragraphs whole and records the page range", () => {
    const pages = [
      { page: 3, text: [para(120), para(120)].join("\n\n") },
      { page: 4, text: [para(120, "beta")].join("\n\n") },
    ];
    const chunks = chunkPages(pages, { chunkSize: 1000, overlap: 0 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.pageStart).not.toBeNull();
      expect(c.pageEnd as number).toBeGreaterThanOrEqual(c.pageStart as number);
    }
    expect(chunks[0].pageStart).toBe(3);
    expect(chunks[chunks.length - 1].pageEnd).toBe(4);
  });

  it("keeps a heading with the paragraph that follows it", () => {
    const body = para(150);
    const text = [body, "Chapter 2: Fractions", para(60, "gamma")].join("\n\n");
    const chunks = chunkPages([{ page: 1, text }], { chunkSize: body.length + 40, overlap: 0 });
    const withHeading = chunks.find((c) => c.text.includes("Chapter 2: Fractions"));
    expect(withHeading).toBeDefined();
    expect(withHeading!.text.startsWith("Chapter 2: Fractions")).toBe(true);
    expect(withHeading!.text).toContain("gamma");
  });

  it("splits a paragraph longer than a chunk and never loops", () => {
    const long = para(2000);
    const chunks = chunkPages([{ page: 1, text: long }], { chunkSize: 800, overlap: 100 });
    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks.every((c) => c.text.length <= 800 + 100 + 4)).toBe(true);
  });

  it("is deterministic and gives null pages for plain text", () => {
    const pages = [{ page: null, text: [para(100), para(100, "b"), para(100, "c")].join("\n\n") }];
    const a = chunkPages(pages, { chunkSize: 700 });
    const b = chunkPages(pages, { chunkSize: 700 });
    expect(a).toEqual(b);
    expect(a.every((c) => c.pageStart === null && c.pageEnd === null)).toBe(true);
  });

  it("keeps a trailing heading instead of dropping it", () => {
    const chunks = chunkPages([{ page: 1, text: [para(80), "The End Of Everything"].join("\n\n") }]);
    expect(chunks[chunks.length - 1].text).toContain("The End Of Everything");
  });
});

describe("looksLikeHeading", () => {
  it("accepts short unpunctuated lines only", () => {
    expect(looksLikeHeading("Chapter 1")).toBe(true);
    expect(looksLikeHeading("This is a sentence.")).toBe(false);
    expect(looksLikeHeading("x".repeat(120))).toBe(false);
  });
});

describe("estimates", () => {
  it("uses four characters per token and the price table", () => {
    expect(estimateTokens("abcdefgh")).toBe(2);
    const chunks = [{ text: "a".repeat(1800), pageStart: 1, pageEnd: 1 }];
    const e = estimateIngest(chunks);
    expect(e.chunks).toBe(1);
    expect(e.tokens).toBe(450);
    expect(e.usd).toBeCloseTo((450 / 1_000_000) * 0.02, 10);
  });

  it("sums estimates", () => {
    const one = estimateIngest([{ text: "a".repeat(400), pageStart: 1, pageEnd: 1 }]);
    const sum = sumEstimates([one, one]);
    expect(sum.chunks).toBe(2);
    expect(sum.tokens).toBe(200);
  });
});

describe("planBatches", () => {
  const book = Array.from({ length: 120 }, (_, i) => ({
    page: i + 1,
    text: [para(150, `w${i}`), para(150, `x${i}`)].join("\n\n"),
  }));

  it("respects the chunk limit and keeps every page once, in order", () => {
    const batches = planBatches(book, { maxChunks: 10 });
    expect(batches.length).toBeGreaterThan(5);
    for (const b of batches) expect(chunkPages(b.pages).length).toBeLessThanOrEqual(10);
    const pageOrder = batches.flatMap((b) => b.pages.map((p) => p.page));
    expect(pageOrder).toEqual(book.map((p) => p.page));
    expect(batches.map((b) => b.index)).toEqual(batches.map((_, i) => i));
  });

  it("respects the byte limit", () => {
    const batches = planBatches(book, { maxChunks: 1000, maxBytes: 6000 });
    expect(batches.length).toBeGreaterThan(10);
    for (const b of batches) {
      if (b.pages.length > 1) expect(b.bytes).toBeLessThanOrEqual(6000);
    }
  });

  it("puts a small book in one batch", () => {
    expect(planBatches(book.slice(0, 2), { maxChunks: 40 })).toHaveLength(1);
  });

  it("splits a single oversized page", () => {
    const huge = { page: 9, text: Array.from({ length: 200 }, (_, i) => para(100, `p${i}`)).join("\n\n") };
    const parts = splitOversizedPage(huge, 10);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.page === 9)).toBe(true);
    const batches = planBatches([huge], { maxChunks: 10 });
    for (const b of batches) expect(chunkPages(b.pages).length).toBeLessThanOrEqual(12);
  });
});
