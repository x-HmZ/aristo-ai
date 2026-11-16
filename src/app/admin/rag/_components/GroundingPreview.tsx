"use client";

import { useState } from "react";
import { Loader2, Eye } from "lucide-react";
import { BrandButton } from "@/components/admin/ui/BrandButton";
import { BrandBadge } from "@/components/admin/ui/BrandBadge";
import { pageLabel } from "@/lib/rag/reference";

interface Chunk {
  id: string; content: string; domain: string; similarity: number;
  sourceTitle: string | null; pageStart: number | null; pageEnd: number | null;
}
interface Preview {
  query: string; threshold: number; dropped: number; usedPageFilter: boolean;
  chunks: Chunk[]; referenceBlock: string;
}

export function GroundingPreview({ domains }: { domains: string[] }) {
  const [mode, setMode]       = useState<"concept" | "topic">("concept");
  const [value, setValue]     = useState("");
  const [domain, setDomain]   = useState("");
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState("");
  const [data, setData]       = useState<Preview | null>(null);

  const run = async () => {
    if (!value.trim()) return;
    setBusy(true); setError(""); setData(null);
    const res = await fetch("/api/admin/rag/preview", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mode === "concept" ? { conceptId: value.trim() } : { topic: value.trim(), domain: domain || undefined }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) setData(json as Preview); else setError(json.error ?? "Preview failed");
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={mode} onChange={(e) => setMode(e.target.value as "concept" | "topic")} className={inputCls + " w-36"} aria-label="Preview by">
          <option value="concept">Concept id</option>
          <option value="topic">Typed topic</option>
        </select>
        <input value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder={mode === "concept" ? "e.g. python_loops_for" : "e.g. adding fractions"} className={inputCls + " flex-1 min-w-[220px]"} />
        {mode === "topic" && (
          <select value={domain} onChange={(e) => setDomain(e.target.value)} className={inputCls + " w-48"} aria-label="Domain">
            <option value="">All domains</option>
            {domains.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
        <BrandButton variant="primary" size="md" onClick={run} disabled={busy || !value.trim()}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
          Preview
        </BrandButton>
      </div>
      <p className="text-[11px] text-muted">No lesson is generated. Preview embeds your query once (a fraction of a cent).</p>
      {error && <p className="text-xs text-danger font-semibold">{error}</p>}
      {data && (
        <div className="space-y-2">
          <p className="text-xs text-body">
            {data.chunks.length} chunks kept, {data.dropped} dropped below {data.threshold} similarity
            {data.usedPageFilter ? ", limited to this concept's book pages" : ""}.
          </p>
          {data.chunks.map((c, i) => (
            <div key={c.id} className="bg-surface border border-line rounded-xl px-3 py-2">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-[10px] font-bold text-muted">#{i + 1}</span>
                <BrandBadge variant="blue">{(c.similarity * 100).toFixed(1)}% sim</BrandBadge>
                {c.sourceTitle && <span className="text-[11px] text-muted">{c.sourceTitle}</span>}
                {pageLabel(c.pageStart, c.pageEnd) && <span className="text-[11px] text-muted">pp. {pageLabel(c.pageStart, c.pageEnd)}</span>}
              </div>
              <p className="text-xs text-ink leading-snug line-clamp-3">{c.content}</p>
            </div>
          ))}
          <p className="text-xs font-semibold text-ink">Exact block the lesson prompt receives</p>
          <pre className="max-h-80 overflow-auto rounded-[10px] border border-line bg-sunk p-3 text-[11px] text-body whitespace-pre-wrap">{data.referenceBlock}</pre>
        </div>
      )}
    </div>
  );
}

const inputCls =
  "min-h-11 text-sm bg-surface border border-line rounded-[10px] px-3 py-2 text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent-text";
