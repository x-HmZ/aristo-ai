"use client";

/**
 * Browser-side PDF text extraction with pdf.js.
 *
 * CLIENT ONLY. Import this from a client component, and only through
 * extractPdf(), which loads pdfjs-dist lazily. Never import pdfjs-dist from a
 * server component or a route: it needs browser APIs and would break the
 * server build.
 *
 * The PDF never leaves the browser. Only the extracted text is sent on, in
 * batches, because Vercel rejects request bodies over 4.5 MB and textbooks
 * are 20 to 200 MB.
 *
 * Worker setup (Next 15, webpack): `new URL(..., import.meta.url)` makes
 * webpack emit the worker file as a static asset and give us its URL;
 * pdf.js then starts it as a module worker. This path could not be
 * exercised without a build; see the report.
 */

import type { PageText } from "./chunking";
import { layoutPages, type RawPage, type TextItem } from "./pdfLayout";
import { flattenOutline, normaliseOutline, type OutlineEntry, type RawOutlineNode } from "./outline";

export interface ExtractProgress {
  phase: "reading" | "outline";
  page:  number;
  total: number;
}

export interface ExtractOptions {
  onProgress?: (p: ExtractProgress) => void;
  signal?:     AbortSignal;
}

export interface PdfExtraction {
  pageCount:     number;
  pages:         PageText[];
  outline:       OutlineEntry[];
  outlineSource: "pdf" | "headings" | "none";
  /** True when pages hold almost no text: a scan that needs OCR first. */
  scanned:       boolean;
}

export const SCANNED_MESSAGE =
  "This PDF has no text layer (it looks scanned). Run OCR on it first, then upload the result.";

type PdfModule = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfModule> | null = null;

function loadPdfjs(): Promise<PdfModule> {
  pdfjsPromise ??= import("pdfjs-dist").then((mod) => {
    mod.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    return mod;
  });
  return pdfjsPromise;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Extraction cancelled", "AbortError");
}

export async function extractPdf(file: File, opts: ExtractOptions = {}): Promise<PdfExtraction> {
  const pdfjs = await loadPdfjs();
  const data  = new Uint8Array(await file.arrayBuffer());
  const task  = pdfjs.getDocument({ data });
  const pdf   = await task.promise;

  try {
    const total = pdf.numPages;
    const raw: RawPage[] = [];

    for (let n = 1; n <= total; n++) {
      throwIfAborted(opts.signal);
      opts.onProgress?.({ phase: "reading", page: n, total });
      const page    = await pdf.getPage(n);
      const content = await page.getTextContent();
      const items: TextItem[] = [];
      for (const it of content.items) {
        if (!("str" in it)) continue;           // marked-content markers carry no text
        const t = it.transform as number[];
        items.push({
          str:   it.str,
          x:     t[4],
          y:     t[5],
          size:  Math.abs(it.height) || Math.abs(t[3]) || 10,
          width: it.width,
        });
      }
      raw.push({ page: n, items });
      page.cleanup();
    }

    const layout = layoutPages(raw);

    let outline: OutlineEntry[] = [];
    let outlineSource: PdfExtraction["outlineSource"] = "none";
    if (!layout.scanned) {
      opts.onProgress?.({ phase: "outline", page: total, total });
      const nodes = await readOutline(pdf);
      if (nodes.length > 0) {
        outline = normaliseOutline(flattenOutline(nodes), total);
        outlineSource = "pdf";
      }
      if (outline.length === 0 && layout.headings.length > 0) {
        outline = normaliseOutline(layout.headings, total);
        outlineSource = "headings";
      }
    }

    return { pageCount: total, pages: layout.pages, outline, outlineSource, scanned: layout.scanned };
  } finally {
    void task.destroy();
  }
}

type PdfDoc = Awaited<ReturnType<PdfModule["getDocument"]>["promise"]>;
type PdfOutlineItem = NonNullable<Awaited<ReturnType<PdfDoc["getOutline"]>>>[number];

async function destToPage(pdf: PdfDoc, dest: PdfOutlineItem["dest"]): Promise<number | null> {
  try {
    const arr = typeof dest === "string" ? await pdf.getDestination(dest) : dest;
    if (!arr || arr.length === 0) return null;
    const ref = arr[0];
    if (typeof ref === "number") return ref + 1;
    return (await pdf.getPageIndex(ref)) + 1;
  } catch {
    return null;
  }
}

async function readOutline(pdf: PdfDoc): Promise<RawOutlineNode[]> {
  let items: PdfOutlineItem[] | null = null;
  try {
    items = await pdf.getOutline();
  } catch {
    return [];
  }
  if (!items) return [];

  const walk = async (list: PdfOutlineItem[], depth: number): Promise<RawOutlineNode[]> => {
    const out: RawOutlineNode[] = [];
    for (const it of list) {
      const node: RawOutlineNode = { title: it.title, page: await destToPage(pdf, it.dest) };
      if (it.items?.length && depth < 3) node.items = await walk(it.items as PdfOutlineItem[], depth + 1);
      out.push(node);
    }
    return out;
  };
  return walk(items, 0);
}
