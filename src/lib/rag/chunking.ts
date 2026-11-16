/**
 * Paragraph-, heading- and page-aware chunking for textbook ingestion.
 *
 * Pure functions, shared by the browser (to plan batches and estimate cost)
 * and the server (to chunk each batch it receives). Keep them deterministic:
 * the same pages must always give the same chunks.
 *
 * Differences from the older fixed-window chunkText():
 *  - splits on paragraph boundaries first, never in the middle of a paragraph
 *    unless a single paragraph is longer than a chunk
 *  - a heading is kept with the paragraph that follows it
 *  - every chunk records the page range it came from
 */

export interface PageText {
  /** 1-based page number, or null for pasted text with no pages. */
  page: number | null;
  text: string;
}

export interface PageChunk {
  text:      string;
  pageStart: number | null;
  pageEnd:   number | null;
}

export interface ChunkOptions {
  chunkSize?: number;   // target characters per chunk (~450 tokens at 1800)
  overlap?:   number;   // characters carried from the previous chunk
  minChars?:  number;   // chunks of this length or less are dropped
}

export const DEFAULT_CHUNK_SIZE = 1800;
export const DEFAULT_OVERLAP    = 200;
export const MIN_CHUNK_CHARS    = 50;
/** English prose averages about four characters per token. */
export const CHARS_PER_TOKEN    = 4;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

interface Unit {
  text:    string;
  page:    number | null;
  overlap: boolean;   // carried from the previous chunk, not new material
}

/** A short line with no sentence ending reads as a heading. */
export function looksLikeHeading(text: string): boolean {
  const t = text.trim();
  if (t.length === 0 || t.length > 80) return false;
  if (t.includes("\n")) return false;
  return !/[.!?:;,]$/.test(t);
}

/** Splits one over-long paragraph into windows, preferring sentence or word ends. */
function splitLong(text: string, size: number): string[] {
  const out: string[] = [];
  let rest = text.trim();
  while (rest.length > size) {
    const window = rest.slice(0, size);
    const floor  = Math.floor(size * 0.6);
    let cut = Math.max(window.lastIndexOf(". "), window.lastIndexOf("? "), window.lastIndexOf("! "));
    if (cut >= floor) cut += 1;                  // keep the full stop
    else {
      cut = window.lastIndexOf(" ");
      if (cut < floor) cut = size;               // no usable boundary: hard cut
    }
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest.length > 0) out.push(rest);
  return out;
}

function tail(text: string, overlap: number): string {
  if (overlap <= 0 || text.length <= overlap) return overlap <= 0 ? "" : text;
  const slice = text.slice(text.length - overlap);
  const sp = slice.indexOf(" ");
  return (sp >= 0 && sp < slice.length - 1 ? slice.slice(sp + 1) : slice).trim();
}

export function chunkPages(pages: PageText[], opts: ChunkOptions = {}): PageChunk[] {
  const size     = opts.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap  = Math.min(opts.overlap ?? DEFAULT_OVERLAP, Math.floor(size / 3));
  const minChars = opts.minChars ?? MIN_CHUNK_CHARS;

  // 1. Paragraph units, each tagged with its page.
  const units: Unit[] = [];
  for (const p of pages) {
    const paras = p.text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
    for (const para of paras) {
      for (const piece of para.length > size ? splitLong(para, size) : [para]) {
        units.push({ text: piece, page: p.page, overlap: false });
      }
    }
  }

  // 2. Greedy packing with heading carry-over and a small overlap.
  const chunks: PageChunk[] = [];
  let cur: Unit[] = [];
  let len = 0;

  const flush = (final = false): Unit[] => {
    // Carry a trailing heading into the next chunk so it stays with its text.
    const carried: Unit[] = [];
    const real = cur.filter((u) => !u.overlap);
    if (!final && real.length > 1 && looksLikeHeading(cur[cur.length - 1].text)) {
      carried.push(cur.pop() as Unit);
    }
    const body = cur.filter((u) => !u.overlap);
    const text = cur.map((u) => u.text).join("\n\n").trim();
    if (body.length > 0 && text.length > minChars) {
      const pageStart = body[0].page;
      const pageEnd   = body[body.length - 1].page;
      chunks.push({ text, pageStart, pageEnd });
    }
    if (!final && carried.length === 0 && body.length > 0 && overlap > 0) {
      const t = tail(text, overlap);
      if (t) carried.push({ text: t, page: body[body.length - 1].page, overlap: true });
    }
    return carried;
  };

  for (const u of units) {
    const add = (cur.length > 0 ? 2 : 0) + u.text.length;
    if (cur.length > 0 && len + add > size) {
      const carried = flush();
      cur = carried;
      len = carried.reduce((s, c, i) => s + c.text.length + (i > 0 ? 2 : 0), 0);
    }
    len += (cur.length > 0 ? 2 : 0) + u.text.length;
    cur.push(u);
  }
  if (cur.some((u) => !u.overlap)) flush(true);

  return chunks;
}
