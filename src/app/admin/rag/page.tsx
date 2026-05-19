"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Database, Upload, RefreshCw, Trash2, Loader2, Search, FlaskConical,
} from "lucide-react";
import { PageHeader }                from "@/components/admin/PageHeader";
import { BrandCard }                 from "@/components/admin/ui/BrandCard";
import { BrandButton }               from "@/components/admin/ui/BrandButton";
import { BrandBadge }                from "@/components/admin/ui/BrandBadge";
import { SectionTitle }              from "@/components/admin/ui/SectionTitle";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { UploadDialog }              from "./_components/UploadDialog";
import { SimilarityTester }          from "./_components/SimilarityTester";

interface Chunk {
  id:           string;
  domain:       string;
  source_title: string | null;
  content:      string;
  metadata:     Record<string, unknown> | null;
  created_at:   string;
}

export default function RagPage() {
  const [domain, setDomain]     = useState("all");
  const [domains, setDomains]   = useState<string[]>([]);
  const [q, setQ]               = useState("");
  const [chunks, setChunks]     = useState<Chunk[] | null>(null);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(false);
  const [busyId, setBusyId]     = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (domain !== "all") qs.set("domain", domain);
    if (q)                qs.set("q", q);
    qs.set("limit", "100");
    const res = await fetch(`/api/admin/rag/chunks?${qs.toString()}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setChunks(data.chunks ?? []);
      setTotal(data.total ?? 0);
      setDomains(data.domains ?? []);
    }
    setLoading(false);
  }, [domain, q]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const deleteChunk = async (id: string) => {
    setBusyId(id);
    await fetch(`/api/admin/rag/chunks/${id}`, { method: "DELETE" });
    setBusyId(null);
    load();
  };

  return (
    <>
      <PageHeader
        title="RAG corpus"
        subtitle="Manage the reference material that the teaching agent retrieves during lesson generation. Embeddings are 1536-dim text-embedding-3-small."
        actions={
          <>
            <BrandButton variant="secondary" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </BrandButton>
            <BrandButton variant="primary" size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="h-3.5 w-3.5" />
              Upload
            </BrandButton>
          </>
        }
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={domain} onValueChange={setDomain}>
              <SelectTrigger className="w-56 bg-white/60 border-white/60">
                <SelectValue placeholder="All domains" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All domains</SelectItem>
                {domains.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-aristo-brown/40" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Substring search in chunk content…"
                className="w-full text-sm bg-white/60 border border-white/60 rounded-xl pl-9 pr-3 py-2 text-aristo-brown placeholder:text-aristo-brown/40 focus:outline-none focus:ring-2 focus:ring-aristo-orange/40"
              />
            </div>
            <span className="ml-auto text-xs text-aristo-brown/50">
              {chunks === null ? "Loading…" : `${chunks.length} of ${total} chunks shown`}
            </span>
          </div>
        }
      />

      {/* Similarity tester */}
      <BrandCard variant="cream" className="mb-5">
        <SectionTitle
          title={
            <span className="flex items-center gap-1.5">
              <FlaskConical className="h-3.5 w-3.5" />
              Similarity tester
            </span>
          }
          description="Ask the same question the teaching agent will ask. Returns the top-k retrieved chunks with cosine similarity scores."
        />
        <SimilarityTester defaultDomain={domain !== "all" ? domain : ""} domains={domains} />
      </BrandCard>

      {/* Chunks table */}
      <BrandCard padding="none">
        {chunks === null ? (
          <div className="p-8 text-center text-xs text-aristo-brown/50">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            Loading chunks…
          </div>
        ) : chunks.length === 0 ? (
          <div className="p-10 text-center">
            <Database className="h-10 w-10 text-aristo-brown/30 mx-auto mb-3" />
            <p className="text-sm text-aristo-brown/60">
              {domain === "all" && !q
                ? "No reference material ingested yet — upload some text to seed the corpus."
                : "No chunks match your filter."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Domain</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="w-[55%]">Preview</TableHead>
                <TableHead>Ingested</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chunks.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <BrandBadge variant="orange">{c.domain}</BrandBadge>
                  </TableCell>
                  <TableCell className="text-xs text-aristo-brown/70 max-w-[180px] truncate">
                    {c.source_title ?? <span className="text-aristo-brown/30">—</span>}
                  </TableCell>
                  <TableCell className="text-xs text-aristo-brown leading-snug max-w-[520px]">
                    <p className="line-clamp-2">{c.content}</p>
                    {c.metadata?.concept_id ? (
                      <BrandBadge variant="purple" size="sm" className="mt-1">
                        concept: {String(c.metadata.concept_id)}
                      </BrandBadge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-[11px] text-aristo-brown/50">
                    {new Date(c.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <BrandButton
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteChunk(c.id)}
                      disabled={busyId === c.id}
                      title="Delete chunk"
                    >
                      {busyId === c.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                    </BrandButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </BrandCard>

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => { setUploadOpen(false); load(); }}
        defaultDomain={domain !== "all" ? domain : ""}
      />
    </>
  );
}
