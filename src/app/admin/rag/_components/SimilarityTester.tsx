"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { BrandButton } from "@/components/admin/ui/BrandButton";
import { BrandBadge } from "@/components/admin/ui/BrandBadge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Match {
  id:           string;
  content:      string;
  score:        number;
  source_title: string | null;
  domain:       string;
}

interface Props {
  defaultDomain?: string;
  domains:        string[];
}

export function SimilarityTester({ defaultDomain = "", domains }: Props) {
  const [query, setQuery]      = useState("");
  const [domain, setDomain]    = useState(defaultDomain || "all");
  const [k, setK]              = useState(5);
  const [busy, setBusy]        = useState(false);
  const [matches, setMatches]  = useState<Match[] | null>(null);
  const [error, setError]      = useState<string | null>(null);

  const run = async () => {
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/rag/test", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          query:  query.trim(),
          domain: domain !== "all" ? domain : undefined,
          k,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Search failed");
        setMatches(null);
        return;
      }
      setMatches(data.matches ?? []);
    } catch {
      setError("Search failed.");
    } finally {
      setBusy(false);
    }
  };

  const scoreColor = (s: number) =>
    s >= 0.8 ? "green" :
    s >= 0.6 ? "blue"  :
    s >= 0.4 ? "amber" : "red";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && run()}
          placeholder="What is a for-loop and when do I use it?"
          className="flex-1 min-w-[300px] text-sm bg-white/70 border border-white/60 rounded-xl px-3 py-2 text-aristo-brown placeholder:text-aristo-brown/40 focus:outline-none focus:ring-2 focus:ring-aristo-orange/40"
        />
        <Select value={domain} onValueChange={setDomain}>
          <SelectTrigger className="w-44 bg-white/70 border-white/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All domains</SelectItem>
            {domains.map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(k)} onValueChange={(v) => setK(parseInt(v, 10))}>
          <SelectTrigger className="w-24 bg-white/70 border-white/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">Top 3</SelectItem>
            <SelectItem value="5">Top 5</SelectItem>
            <SelectItem value="10">Top 10</SelectItem>
            <SelectItem value="20">Top 20</SelectItem>
          </SelectContent>
        </Select>
        <BrandButton variant="primary" size="md" onClick={run} disabled={busy || !query.trim()}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Search
        </BrandButton>
      </div>

      {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}

      {matches !== null && matches.length === 0 && (
        <p className="text-xs text-aristo-brown/50">No chunks matched.</p>
      )}
      {matches !== null && matches.length > 0 && (
        <div className="space-y-2">
          {matches.map((m, i) => (
            <div
              key={m.id}
              className="bg-white/70 border border-white/60 rounded-xl px-3 py-2"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold text-aristo-brown/40">
                  #{i + 1}
                </span>
                <BrandBadge variant={scoreColor(m.score)}>
                  {(m.score * 100).toFixed(1)}% sim
                </BrandBadge>
                <BrandBadge variant="orange">{m.domain}</BrandBadge>
                {m.source_title && (
                  <span className="text-[11px] text-aristo-brown/60">{m.source_title}</span>
                )}
              </div>
              <p className="text-xs text-aristo-brown leading-snug line-clamp-3">
                {m.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
