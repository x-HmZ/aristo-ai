/**
 * Pure layout logic for PDF text: positioned text items in, paragraphs out.
 *
 * pdf.js gives text as small positioned fragments. This module groups them
 * into lines and paragraphs, removes running headers and footers, detects
 * headings by font size (the fallback when a PDF has no outline) and decides
 * whether a PDF is a scan with no text layer.
 *
 * No pdf.js import here, so it runs in Vitest without a browser.
 */

import type { PageText } from "./chunking";

export interface TextItem {
  str:   string;
  x:     number;
  y:     number;      // PDF space: larger y is higher on the page
  size:  number;      // font height
  width: number;
}

export interface RawPage {
  page:  number;      // 1-based
  items: TextItem[];
}

export interface Line {
  text: string;
  y:    number;
  size: number;
}

/** A scan averages far below this; real prose pages are 1,500 to 3,000. */
export const SCANNED_AVG_CHARS_PER_PAGE = 200;
/** A line seen on more than this share of pages is a running header or footer. */
export const REPEATED_LINE_SHARE = 0.4;
export const MIN_PAGES_FOR_REPEAT_FILTER = 5;

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Groups fragments into lines, top to bottom, left to right. */
export function itemsToLines(items: TextItem[]): Line[] {
  const real = items.filter((i) => i.str.trim().length > 0);
  const sorted = [...real].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: TextItem[][] = [];
  for (const it of sorted) {
    const row = rows[rows.length - 1];
    const tol = Math.max(2, it.size * 0.4);
    if (row && Math.abs(row[0].y - it.y) <= tol) row.push(it);
    else rows.push([it]);
  }
  return rows.map((row) => {
    const cells = [...row].sort((a, b) => a.x - b.x);
    let text = "";
    let prevEnd = -Infinity;
    for (const c of cells) {
      const gap = c.x - prevEnd;
      const needSpace =
        text.length > 0 && gap > c.size * 0.15 && !/\s$/.test(text) && !/^\s/.test(c.str);
      text += (needSpace ? " " : "") + c.str;
      prevEnd = c.x + c.width;
    }
    const biggest = cells.reduce((m, c) => (c.str.length > m.str.length ? c : m), cells[0]);
    return { text: text.replace(/\s+/g, " ").trim(), y: row[0].y, size: biggest.size };
  }).filter((l) => l.text.length > 0);
}

function repeatKey(text: string): string {
  return text.replace(/\d+/g, "#").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Drops lines that recur on most pages (headers, footers, page numbers). */
export function stripRepeatedLines(pages: Array<{ page: number; lines: Line[] }>): Array<{ page: number; lines: Line[] }> {
  if (pages.length < MIN_PAGES_FOR_REPEAT_FILTER) return pages;
  const seen = new Map<string, number>();
  for (const p of pages) {
    for (const k of new Set(p.lines.map((l) => repeatKey(l.text)))) {
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
  }
  const limit = pages.length * REPEATED_LINE_SHARE;
  return pages.map((p) => ({
    page:  p.page,
    lines: p.lines.filter((l) => (seen.get(repeatKey(l.text)) ?? 0) <= limit),
  }));
}

/** Joins lines into paragraphs separated by blank lines. */
export function linesToParagraphs(lines: Line[]): string {
  if (lines.length === 0) return "";
  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) gaps.push(lines[i - 1].y - lines[i].y);
  const typical = median(gaps.filter((g) => g > 0)) || 12;

  const paras: string[] = [];
  let cur = lines[0].text;
  for (let i = 1; i < lines.length; i++) {
    const prev = lines[i - 1];
    const line = lines[i];
    const gap = prev.y - line.y;
    const sizeShift = Math.abs(line.size - prev.size) / Math.max(prev.size, 1) > 0.15;
    if (gap > typical * 1.5 || sizeShift) {
      paras.push(cur);
      cur = line.text;
    } else if (/[a-z]-$/.test(cur) && /^[a-z]/.test(line.text)) {
      cur = cur.slice(0, -1) + line.text;          // undo a line-end hyphenation
    } else {
      cur += " " + line.text;
    }
  }
  paras.push(cur);
  return paras.join("\n\n");
}

/** Body text size: the most common font size, weighted by characters. */
export function bodySize(pages: Array<{ lines: Line[] }>): number {
  const weight = new Map<number, number>();
  for (const p of pages) {
    for (const l of p.lines) {
      const k = Math.round(l.size * 2) / 2;
      weight.set(k, (weight.get(k) ?? 0) + l.text.length);
    }
  }
  let best = 0, bestW = -1;
  for (const [k, w] of weight) if (w > bestW) { best = k; bestW = w; }
  return best;
}

/**
 * Headings by font size: lines clearly larger than body text, short, and not
 * ending like a sentence. Larger sizes are shallower (chapter before section).
 * Consecutive heading lines of one size on a page are one title.
 */
export interface FlatHeading { title: string; page: number; depth: number }

export function detectHeadings(pages: Array<{ page: number; lines: Line[] }>): FlatHeading[] {
  const body = bodySize(pages);
  if (body <= 0) return [];
  const threshold = body * 1.2;

  const found: Array<{ title: string; page: number; size: number }> = [];
  for (const p of pages) {
    let last: { title: string; page: number; size: number } | null = null;
    let lastIdx = -2;
    p.lines.forEach((l, idx) => {
      const isHeading = l.size >= threshold && l.text.length >= 2 && l.text.length <= 100 && !/[.!?;,]$/.test(l.text);
      if (!isHeading) { last = null; return; }
      if (last && idx === lastIdx + 1 && Math.abs(last.size - l.size) < 0.5) {
        last.title += " " + l.text;
      } else {
        last = { title: l.text, page: p.page, size: l.size };
        found.push(last);
      }
      lastIdx = idx;
    });
  }

  const sizes = [...new Set(found.map((f) => Math.round(f.size * 2) / 2))].sort((a, b) => b - a);
  return found
    .filter((f) => !/^\d+$/.test(f.title))
    .map((f) => ({
      title: f.title,
      page:  f.page,
      depth: Math.min(sizes.indexOf(Math.round(f.size * 2) / 2), 2),
    }));
}

export interface PageTextStats {
  pageCount:     number;
  totalChars:    number;
  avgChars:      number;
  emptyPages:    number;
}

export function textStats(pages: PageText[]): PageTextStats {
  const totalChars = pages.reduce((s, p) => s + p.text.length, 0);
  return {
    pageCount:  pages.length,
    totalChars,
    avgChars:   pages.length ? totalChars / pages.length : 0,
    emptyPages: pages.filter((p) => p.text.trim().length < 20).length,
  };
}

export function isScanned(pages: PageText[]): boolean {
  if (pages.length === 0) return true;
  return textStats(pages).avgChars < SCANNED_AVG_CHARS_PER_PAGE;
}

export interface LayoutResult {
  pages:    PageText[];
  headings: FlatHeading[];
  scanned:  boolean;
}

/** Whole pipeline: positioned items per page to cleaned page text and headings. */
export function layoutPages(raw: RawPage[]): LayoutResult {
  const withLines = raw.map((p) => ({ page: p.page, lines: itemsToLines(p.items) }));
  const stripped  = stripRepeatedLines(withLines);
  const pages: PageText[] = stripped.map((p) => ({ page: p.page, text: linesToParagraphs(p.lines) }));
  return {
    pages,
    headings: detectHeadings(stripped),
    scanned:  isScanned(pages),
  };
}
