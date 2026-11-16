/**
 * Plain text (.txt, .md, pasted) as "pages" for the same ingestion path as
 * PDFs. There are no real pages, so page is null and chunks carry no page
 * range; the text is cut into pseudo-pages only so batches can be planned.
 */

import type { PageText } from "./chunking";

const PSEUDO_PAGE_CHARS = 6000;

export function textToPages(text: string): PageText[] {
  const paras = text.replace(/\r\n/g, "\n").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const pages: PageText[] = [];
  let cur: string[] = [];
  let len = 0;
  for (const p of paras) {
    if (cur.length > 0 && len + p.length > PSEUDO_PAGE_CHARS) {
      pages.push({ page: null, text: cur.join("\n\n") });
      cur = [];
      len = 0;
    }
    cur.push(p);
    len += p.length + 2;
  }
  if (cur.length > 0) pages.push({ page: null, text: cur.join("\n\n") });
  return pages;
}

/** Full text of a page list, in order, for hashing. */
export function joinPages(pages: PageText[]): string {
  return pages.map((p) => p.text).join("\n\n");
}
