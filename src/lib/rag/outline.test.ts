import { describe, expect, it } from "vitest";
import { flattenOutline, normaliseOutline, outlineIsUsable, outlineForCurriculum } from "./outline";
import {
  detectHeadings, isScanned, itemsToLines, layoutPages, linesToParagraphs, stripRepeatedLines,
  type Line, type TextItem,
} from "./pdfLayout";

describe("outline normalisation", () => {
  it("flattens nested nodes depth first", () => {
    const flat = flattenOutline([
      { title: "Ch 1", page: 1, items: [{ title: "1.1", page: 2 }, { title: "1.2", page: 5 }] },
      { title: "Ch 2", page: 9 },
    ]);
    expect(flat.map((f) => [f.title, f.depth])).toEqual([["Ch 1", 0], ["1.1", 1], ["1.2", 1], ["Ch 2", 0]]);
  });

  it("cleans titles, drops empties and duplicates, clamps pages", () => {
    const out = normaliseOutline(
      [
        { title: "  Chapter   One ", page: 1, depth: 0 },
        { title: "Chapter One", page: 1, depth: 0 },
        { title: "   ", page: 3, depth: 0 },
        { title: "Beyond", page: 999, depth: 0 },
        { title: "Zero", page: 0, depth: 9 },
        { title: "No page", page: null, depth: 0 },
      ],
      100,
    );
    expect(out.map((o) => o.title)).toEqual(["Chapter One", "Beyond", "Zero", "No page"]);
    expect(out[1].page).toBe(100);
    expect(out[2].page).toBe(1);
    expect(out[2].depth).toBe(3);
    expect(out[3].page).toBeNull();
    expect(out[3].endPage).toBeNull();
  });

  it("computes page ranges from the next entry at the same or shallower depth", () => {
    const out = normaliseOutline(
      [
        { title: "Ch 1", page: 1, depth: 0 },
        { title: "1.1", page: 3, depth: 1 },
        { title: "1.2", page: 6, depth: 1 },
        { title: "Ch 2", page: 10, depth: 0 },
      ],
      50,
    );
    const by = Object.fromEntries(out.map((o) => [o.title, [o.page, o.endPage]]));
    expect(by["Ch 1"]).toEqual([1, 9]);
    expect(by["1.1"]).toEqual([3, 5]);
    expect(by["1.2"]).toEqual([6, 9]);
    expect(by["Ch 2"]).toEqual([10, 50]);
  });

  it("keeps an entry on one page when the next starts on the same page", () => {
    const out = normaliseOutline(
      [{ title: "A", page: 4, depth: 0 }, { title: "B", page: 4, depth: 0 }],
      10,
    );
    expect(out[0]).toMatchObject({ page: 4, endPage: 4 });
  });

  it("judges whether an outline can seed a course", () => {
    const few = normaliseOutline([{ title: "A", page: 1, depth: 0 }], 10);
    expect(outlineIsUsable(few)).toBe(false);
    const many = normaliseOutline(
      ["A", "B", "C", "D"].map((t, i) => ({ title: t, page: i * 5 + 1, depth: 0 })),
      30,
    );
    expect(outlineIsUsable(many)).toBe(true);
    expect(outlineForCurriculum(many, 0)).toHaveLength(4);
  });
});

function item(str: string, x: number, y: number, size = 10, width = str.length * 5): TextItem {
  return { str, x, y, size, width };
}

describe("pdf layout", () => {
  it("builds lines and paragraphs from positioned fragments", () => {
    const lines = itemsToLines([
      item("world", 60, 700), item("Hello", 10, 700),
      item("Second line", 10, 688),
      item("New paragraph", 10, 640),
    ]);
    expect(lines.map((l) => l.text)).toEqual(["Hello world", "Second line", "New paragraph"]);
    expect(linesToParagraphs(lines)).toBe("Hello world Second line\n\nNew paragraph");
  });

  it("undoes line-end hyphenation", () => {
    const lines: Line[] = [
      { text: "a frac-", y: 700, size: 10 },
      { text: "tion of the whole", y: 688, size: 10 },
    ];
    expect(linesToParagraphs(lines)).toBe("a fraction of the whole");
  });

  it("removes lines repeated on most pages, including page numbers", () => {
    const pages = Array.from({ length: 10 }, (_, i) => ({
      page: i + 1,
      lines: [
        { text: "Grade 7 Mathematics", y: 780, size: 9 },
        { text: `Unique body text ${["alpha","beta","gamma","delta","omega","sigma","theta","kappa","zeta","iota"][i]} here`, y: 700, size: 10 },
        { text: String(i + 1), y: 20, size: 9 },
      ],
    }));
    const out = stripRepeatedLines(pages);
    for (const p of out) {
      expect(p.lines).toHaveLength(1);
      expect(p.lines[0].text).toContain("Unique body text");
    }
  });

  it("does not filter repeated lines in a very short document", () => {
    const pages = [1, 2].map((p) => ({ page: p, lines: [{ text: "Same", y: 1, size: 10 }] }));
    expect(stripRepeatedLines(pages)[0].lines).toHaveLength(1);
  });

  it("detects headings by font size when there is no outline", () => {
    const body = (t: string, y: number): Line => ({ text: t, y, size: 10 });
    const pages = [
      { page: 1, lines: [{ text: "Fractions", y: 750, size: 20 }, body("Body text here is long enough to count.", 700), body("More body text of the usual size here.", 688)] },
      { page: 2, lines: [body("Lots of ordinary body text on this page for weight.", 700), { text: "Adding Fractions", y: 650, size: 14 }, body("Even more ordinary body text goes here too.", 630)] },
    ];
    const h = detectHeadings(pages);
    expect(h.map((x) => x.title)).toEqual(["Fractions", "Adding Fractions"]);
    expect(h[0].depth).toBe(0);
    expect(h[1].depth).toBe(1);
    expect(h[1].page).toBe(2);
  });

  it("flags a PDF with almost no text as scanned", () => {
    expect(isScanned([{ page: 1, text: "" }, { page: 2, text: "12" }])).toBe(true);
    expect(isScanned([{ page: 1, text: "x".repeat(2000) }])).toBe(false);
    const res = layoutPages([{ page: 1, items: [] }, { page: 2, items: [item("p. 2", 1, 1)] }]);
    expect(res.scanned).toBe(true);
  });
});
