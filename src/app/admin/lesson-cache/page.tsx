"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw, PlayCircle, RotateCcw, Trash2, Loader2, FileText, Eraser,
} from "lucide-react";
import { PageHeader }                from "@/components/admin/PageHeader";
import { BrandCard }                 from "@/components/admin/ui/BrandCard";
import { BrandButton }               from "@/components/admin/ui/BrandButton";
import { BrandBadge, STATUS_COLOR }  from "@/components/admin/ui/BrandBadge";
import { SectionTitle }              from "@/components/admin/ui/SectionTitle";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Row {
  id:                 string;
  concept_id:         string;
  profile_signature:  string;
  generated_by_model: string | null;
  moderation_status:  string;
  moderator_id:       string | null;
  flagged_reason:     string | null;
  generated_at:       string;
  approved_at:        string | null;
  usage_count:        number;
  concepts: { name: string; domain: string } | { name: string; domain: string }[] | null;
}

export default function LessonCachePage() {
  const [rows, setRows]       = useState<Row[] | null>(null);
  const [status, setStatus]   = useState("all");
  const [busy, setBusy]       = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [invalidateDomain, setInvalidateDomain] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (status !== "all") qs.set("status", status);
    qs.set("limit", "200");
    const res = await fetch(`/api/admin/lesson-cache?${qs.toString()}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setRows(data.rows ?? []);
    }
    setLoading(false);
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const conceptOf = (r: Row): { name: string; domain: string } | null => {
    if (!r.concepts) return null;
    return Array.isArray(r.concepts) ? r.concepts[0] : r.concepts;
  };

  const regenerate = async (id: string) => {
    setBusy(id);
    await fetch(`/api/admin/lesson-cache/${id}/regenerate`, { method: "POST" });
    setBusy(null);
    load();
  };

  const remove = async (id: string) => {
    setBusy(id);
    await fetch(`/api/admin/lesson-cache/${id}`, { method: "DELETE" });
    setBusy(null);
    load();
  };

  const invalidateDomainNow = async () => {
    const d = invalidateDomain.trim();
    if (!d) return;
    if (!confirm(`Wipe ALL cached lessons in domain "${d}"? This can't be undone.`)) return;
    setLoading(true);
    await fetch(`/api/admin/lesson-cache/bulk-invalidate`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ domain: d }),
    });
    setInvalidateDomain("");
    load();
  };

  return (
    <>
      <PageHeader
        title="Lesson cache"
        subtitle="Generated 5-phase lessons keyed by (concept_id, profile_signature). Approved rows are served to learners directly — bypassing the TeachingAgent."
        actions={
          <BrandButton variant="secondary" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </BrandButton>
        }
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-48 bg-white/60 border-white/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="auto_approved">Auto-approved</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <div className="ml-auto flex items-center gap-2">
              <input
                value={invalidateDomain}
                onChange={(e) => setInvalidateDomain(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                placeholder="Domain to wipe…"
                className="w-44 text-xs bg-white/60 border border-white/60 rounded-xl px-3 py-1.5 font-mono text-aristo-brown placeholder:text-aristo-brown/40 focus:outline-none focus:ring-2 focus:ring-red-500/40"
              />
              <BrandButton
                variant="destructive"
                size="sm"
                onClick={invalidateDomainNow}
                disabled={!invalidateDomain.trim()}
              >
                <Eraser className="h-3.5 w-3.5" />
                Bulk invalidate
              </BrandButton>
            </div>
          </div>
        }
      />

      <BrandCard padding="none">
        {rows === null ? (
          <div className="p-8 text-center text-xs text-aristo-brown/50">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center">
            <PlayCircle className="h-10 w-10 text-aristo-brown/30 mx-auto mb-3" />
            <p className="text-sm text-aristo-brown/60">No cached lessons in this filter.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Concept</TableHead>
                <TableHead>Signature</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Usage</TableHead>
                <TableHead>Generated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const c = conceptOf(r);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="max-w-[220px]">
                      <div className="text-aristo-brown font-medium truncate">
                        {c?.name ?? r.concept_id}
                      </div>
                      <div className="text-[10px] text-aristo-brown/40 font-mono truncate">
                        {r.concept_id}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-[10px] text-aristo-brown/60 max-w-[200px] truncate">
                      {r.profile_signature}
                    </TableCell>
                    <TableCell>
                      <BrandBadge variant={STATUS_COLOR[r.moderation_status] ?? "neutral"} size="md">
                        {r.moderation_status}
                      </BrandBadge>
                      {r.flagged_reason && (
                        <div className="text-[10px] text-amber-700 mt-1">⚑ {r.flagged_reason}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-[11px] font-mono text-aristo-brown/60 truncate max-w-[140px]">
                      {r.generated_by_model ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs text-aristo-brown/70 tabular-nums">
                      {r.usage_count}
                    </TableCell>
                    <TableCell className="text-[11px] text-aristo-brown/50">
                      {new Date(r.generated_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <BrandButton
                          variant="outline"
                          size="sm"
                          onClick={() => regenerate(r.id)}
                          disabled={busy === r.id}
                          title="Regenerate (wipe + rebuild on next request)"
                        >
                          {busy === r.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <RotateCcw className="h-3 w-3" />}
                        </BrandButton>
                        <BrandButton
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(r.id)}
                          disabled={busy === r.id}
                          title="Delete cache row"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </BrandButton>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </BrandCard>

      <BrandCard variant="cream" className="mt-5">
        <SectionTitle
          title={
            <span className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              How caching works
            </span>
          }
        />
        <ul className="text-xs text-aristo-brown/70 list-disc list-inside space-y-1">
          <li>Lessons are keyed by <code className="font-mono">concept_id</code> + a <code className="font-mono">profile_signature</code> hash of the learner&apos;s dynamic profile.</li>
          <li>On a learner request: cache hit → serve <code className="font-mono">payload</code> directly (no LLM call); miss → generate + insert.</li>
          <li>Moderation thresholds live in <code className="font-mono">src/lib/admin/moderation-rules.ts</code> — tune there.</li>
          <li>After editing a concept&apos;s description / objectives, bulk-invalidate the domain above so stale payloads don&apos;t linger.</li>
        </ul>
      </BrandCard>
    </>
  );
}
