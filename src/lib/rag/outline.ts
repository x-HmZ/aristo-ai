/**
 * Document outline (table of contents) handling.
 *
 * The browser reads a PDF's outline with pdf.js, resolves each destination to
 * a page number, and sends a flat list. These pure functions turn whatever
 * came out of pdf.js (or heading detection) into one clean shape, and compute
 * the page range each entry covers, so retrieval can later be filtered to it.
 */

export interface OutlineEntry {
  title:     string;
  /** 1-based first page of the entry, null when unknown. */
  page:      number | null;
  /** 1-based last page covered (inclusive), null when unknown. */
  endPage:   number | null;
  /** 0 = chapter, 1 = section, ... */
  depth:     number;
}

export interface RawOutlineNode {
  title:  string;
  page:   number | null;
  items?: RawOutlineNode[];
}

export const MAX_OUTLINE_ENTRIES = 400;
export const MAX_OUTLINE_DEPTH   = 3;
export const MAX_TITLE_CHARS     = 160;

interface FlatEntry { title: string; page: number | null; depth: number }

/** Depth-first flatten, keeping document order. */
export function flattenOutline(nodes: RawOutlineNode[], depth = 0): FlatEntry[] {
  const out: FlatEntry[] = [];
  for (const n of nodes) {
    out.push({ title: n.title, page: n.page, depth });
    if (n.items?.length) out.push(...flattenOutline(n.items, depth + 1));
  }
  return out;
}

function cleanTitle(t: string): string {
  return t.replace(/\s+/g, " ").trim().slice(0, MAX_TITLE_CHARS);
}

/**
 * Cleans a flat outline: trims and truncates titles, drops empty and
 * consecutive duplicate entries, clamps pages into 1..pageCount, caps depth
 * and count, and fills each entry's endPage from the next entry at the same
 * or a shallower depth (the last one runs to the end of the document).
 */
export function normaliseOutline(raw: FlatEntry[], pageCount: number): OutlineEntry[] {
  const cleaned: FlatEntry[] = [];
  for (const e of raw) {
    const title = cleanTitle(e.title ?? "");
    if (!title) continue;
    const depth = Math.min(Math.max(0, Math.floor(e.depth)), MAX_OUTLINE_DEPTH);
    const page =
      e.page === null || !Number.isFinite(e.page)
        ? null
        : Math.min(Math.max(1, Math.floor(e.page)), Math.max(1, pageCount));
    const prev = cleaned[cleaned.length - 1];
    if (prev && prev.title === title && prev.page === page) continue;
    cleaned.push({ title, page, depth });
    if (cleaned.length >= MAX_OUTLINE_ENTRIES) break;
  }

  return cleaned.map((e, i) => {
    let endPage: number | null = null;
    if (e.page !== null) {
      endPage = Math.max(1, pageCount);
      for (let j = i + 1; j < cleaned.length; j++) {
        const next = cleaned[j];
        if (next.depth <= e.depth && next.page !== null) {
          endPage = Math.max(e.page, next.page === e.page ? e.page : next.page - 1);
          break;
        }
      }
    }
    return { title: e.title, page: e.page, endPage, depth: e.depth };
  });
}

/** Only top-level and second-level entries are useful as course structure. */
export function outlineForCurriculum(outline: OutlineEntry[], maxDepth = 1): OutlineEntry[] {
  return outline.filter((e) => e.depth <= maxDepth && e.page !== null);
}

/** Does the outline cover the document well enough to build a course from? */
export function outlineIsUsable(outline: OutlineEntry[]): boolean {
  return outlineForCurriculum(outline, 0).length >= 3 || outlineForCurriculum(outline, 1).length >= 5;
}
