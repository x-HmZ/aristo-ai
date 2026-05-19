"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw, Shield, CheckCircle2, XCircle, Loader2,
} from "lucide-react";
import { PageHeader }                from "@/components/admin/PageHeader";
import { BrandCard }                 from "@/components/admin/ui/BrandCard";
import { BrandButton }               from "@/components/admin/ui/BrandButton";
import { BrandBadge }                from "@/components/admin/ui/BrandBadge";
import { SectionTitle }              from "@/components/admin/ui/SectionTitle";

interface PendingRow {
  id:                 string;
  concept_id:         string;
  profile_signature:  string;
  generated_by_model: string | null;
  payload:            { phases?: Record<string, unknown>; concept_name?: string };
  flagged_reason:     string | null;
  generated_at:       string;
  concepts: { name: string; domain: string } | { name: string; domain: string }[] | null;
}

export default function ModerationPage() {
  const [rows, setRows]       = useState<PendingRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy]       = useState<string | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [expanded, setExpanded]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/moderation/queue", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setRows(data.rows ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const decide = async (id: string, status: "approved" | "rejected") => {
    setBusy(id);
    await fetch(`/api/admin/moderation/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status, notes: notesById[id] ?? "" }),
    });
    setBusy(null);
    load();
  };

  const conceptOf = (r: PendingRow) =>
    Array.isArray(r.concepts) ? r.concepts[0] : r.concepts;

  return (
    <>
      <PageHeader
        title="Moderation queue"
        subtitle="Generated lessons flagged for admin review before they're served to learners. Approve a row to release it, reject to wipe it (next learner request will regenerate)."
        actions={
          <BrandButton variant="secondary" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </BrandButton>
        }
      />

      {rows === null ? (
        <BrandCard>
          <p className="text-xs text-aristo-brown/60 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />Loading queue…
          </p>
        </BrandCard>
      ) : rows.length === 0 ? (
        <BrandCard className="flex flex-col items-center justify-center py-12 gap-3">
          <Shield className="h-12 w-12 text-green-500" />
          <p className="text-sm text-aristo-brown/60">Inbox zero — nothing pending review.</p>
        </BrandCard>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const c = conceptOf(r);
            const isExpanded = expanded === r.id;
            return (
              <BrandCard key={r.id} variant="warning">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-aristo-brown">
                        {c?.name ?? r.concept_id}
                      </h3>
                      {c?.domain && (
                        <BrandBadge variant="neutral">{c.domain}</BrandBadge>
                      )}
                      <BrandBadge variant="amber">{r.flagged_reason ?? "manual"}</BrandBadge>
                      <BrandBadge variant="orange">{r.generated_by_model ?? "—"}</BrandBadge>
                    </div>
                    <div className="text-[11px] text-aristo-brown/50 mt-1">
                      <span className="font-mono">{r.concept_id}</span>
                      <span className="mx-2">·</span>
                      sig <span className="font-mono">{r.profile_signature}</span>
                      <span className="mx-2">·</span>
                      generated {new Date(r.generated_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex flex-col items-stretch gap-2 min-w-[280px]">
                    <textarea
                      value={notesById[r.id] ?? ""}
                      onChange={(e) => setNotesById((p) => ({ ...p, [r.id]: e.target.value }))}
                      placeholder="Moderator notes (optional)…"
                      rows={2}
                      className="text-xs bg-white/70 border border-white/60 rounded-xl px-3 py-2 text-aristo-brown placeholder:text-aristo-brown/40 focus:outline-none focus:ring-2 focus:ring-aristo-orange/40 resize-none"
                    />
                    <div className="flex gap-2 justify-end">
                      <BrandButton
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpanded(isExpanded ? null : r.id)}
                      >
                        {isExpanded ? "Hide payload" : "Preview payload"}
                      </BrandButton>
                      <BrandButton
                        variant="destructive"
                        size="sm"
                        onClick={() => decide(r.id, "rejected")}
                        disabled={busy === r.id}
                      >
                        {busy === r.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <XCircle className="h-3.5 w-3.5" />}
                        Reject
                      </BrandButton>
                      <BrandButton
                        variant="success"
                        size="sm"
                        onClick={() => decide(r.id, "approved")}
                        disabled={busy === r.id}
                      >
                        {busy === r.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Approve
                      </BrandButton>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-amber-200">
                    <SectionTitle
                      title="Generated payload"
                      description="Full LessonPayload JSON as it would be served to the learner."
                    />
                    <pre className="text-[10px] font-mono text-aristo-brown bg-white/70 border border-white/60 rounded-xl p-3 max-h-72 overflow-y-auto whitespace-pre-wrap break-all">
                      {JSON.stringify(r.payload, null, 2)}
                    </pre>
                  </div>
                )}
              </BrandCard>
            );
          })}
        </div>
      )}
    </>
  );
}
