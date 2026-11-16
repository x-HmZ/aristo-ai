import { describe, expect, it, vi } from "vitest";
import { ingestBatch, type ChunkRow, type IngestDeps } from "./ingest";

const para = (n: number, w: string) => `${w} `.repeat(n).trim() + ".";
const pages = (w: string) => [
  { page: 5, text: [para(150, w), para(150, w + "2")].join("\n\n") },
  { page: 6, text: para(150, w + "3") },
];

function memoryDeps(embed?: IngestDeps["embed"]) {
  const rows: ChunkRow[] = [];
  const deps: IngestDeps = {
    embed: embed ?? vi.fn(async () => [0.1, 0.2]),
    store: {
      deleteBatch: vi.fn(async (sid: string, bi: number) => {
        for (let i = rows.length - 1; i >= 0; i--) {
          if (rows[i].source_id === sid && rows[i].batch_index === bi) rows.splice(i, 1);
        }
      }),
      insertChunks: vi.fn(async (r: ChunkRow[]) => { rows.push(...r); }),
    },
  };
  return { deps, rows };
}

const source = { id: "s1", domain: "math_7", title: "Book" };

describe("ingestBatch", () => {
  it("dry run chunks and prices without embedding or writing", async () => {
    const { deps, rows } = memoryDeps();
    const r = await ingestBatch(deps, { source, batchIndex: 0, pages: pages("a"), dryRun: true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.dryRun).toBe(true);
      expect(r.estimate.chunks).toBeGreaterThan(0);
      expect(r.estimate.tokens).toBeGreaterThan(0);
      expect(r.estimate.usd).toBeGreaterThan(0);
      expect(r.stored).toBe(0);
    }
    expect(deps.embed).not.toHaveBeenCalled();
    expect(deps.store.insertChunks).not.toHaveBeenCalled();
    expect(rows).toHaveLength(0);
  });

  it("stores chunks with source, batch and page range", async () => {
    const { deps, rows } = memoryDeps();
    const r = await ingestBatch(deps, { source, batchIndex: 2, pages: pages("a"), dryRun: false });
    expect(r.ok).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((x) => x.source_id === "s1" && x.batch_index === 2)).toBe(true);
    expect(rows[0].page_start).toBe(5);
    expect(rows[rows.length - 1].page_end).toBe(6);
  });

  it("a retry replaces the batch instead of duplicating it", async () => {
    const { deps, rows } = memoryDeps();
    await ingestBatch(deps, { source, batchIndex: 0, pages: pages("a"), dryRun: false });
    await ingestBatch(deps, { source, batchIndex: 1, pages: pages("b"), dryRun: false });
    const first = rows.filter((r) => r.batch_index === 0).length;
    const total = rows.length;
    await ingestBatch(deps, { source, batchIndex: 0, pages: pages("a"), dryRun: false });
    expect(rows.filter((r) => r.batch_index === 0)).toHaveLength(first);
    expect(rows).toHaveLength(total);
  });

  it("leaves earlier data alone when embedding fails", async () => {
    const good = memoryDeps();
    await ingestBatch(good.deps, { source, batchIndex: 0, pages: pages("a"), dryRun: false });
    const before = good.rows.length;

    let n = 0;
    const flaky: IngestDeps = {
      ...good.deps,
      embed: async () => { n++; if (n === 1) throw new Error("429"); return [1]; },
    };
    const r = await ingestBatch(flaky, { source, batchIndex: 0, pages: pages("a"), dryRun: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(502);
    expect(good.rows).toHaveLength(before);
  });

  it("fails clearly when the key is missing (embed returns null)", async () => {
    const { deps } = memoryDeps(async () => null);
    const r = await ingestBatch(deps, { source, batchIndex: 0, pages: pages("a"), dryRun: false });
    expect(r.ok).toBe(false);
  });

  it("refuses a batch over the chunk cap and an empty batch", async () => {
    const { deps } = memoryDeps();
    const huge = [{ page: 1, text: Array.from({ length: 300 }, (_, i) => para(120, `p${i}`)).join("\n\n") }];
    const big = await ingestBatch(deps, { source, batchIndex: 0, pages: huge, dryRun: false });
    expect(big.ok).toBe(false);
    if (!big.ok) expect(big.status).toBe(413);
    const none = await ingestBatch(deps, { source, batchIndex: 0, pages: [{ page: 1, text: "tiny" }], dryRun: false });
    expect(none.ok).toBe(false);
  });
});
