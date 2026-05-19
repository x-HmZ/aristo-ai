"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Server, Loader2, CircleAlert, CircleCheck } from "lucide-react";
import { PageHeader }                from "@/components/admin/PageHeader";
import { BrandCard }                 from "@/components/admin/ui/BrandCard";
import { BrandButton }               from "@/components/admin/ui/BrandButton";
import { BrandBadge }                from "@/components/admin/ui/BrandBadge";
import { SectionTitle }              from "@/components/admin/ui/SectionTitle";

interface Health {
  rowCounts:    Record<string, number>;
  apiKeys: {
    anthropic: "ok" | "missing_key" | "error";
    openai:    "ok" | "missing_key" | "error";
    fal:       "ok" | "missing_key" | "error";
  };
  recentErrors: Array<{
    id:          string;
    actor_email: string | null;
    action:      string;
    target_type: string | null;
    target_id:   string | null;
    diff:        { error?: string; [k: string]: unknown };
    created_at:  string;
  }>;
  server_time: string;
}

const STATUS_LABEL: Record<Health["apiKeys"]["anthropic"], { label: string; variant: "green" | "amber" | "red" }> = {
  ok:           { label: "Reachable",      variant: "green" },
  missing_key:  { label: "Missing API key", variant: "amber" },
  error:        { label: "Error",           variant: "red"   },
};

export default function SystemHealthPage() {
  const [data, setData]       = useState<Health | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/system/health", { cache: "no-store" });
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageHeader
        title="System health"
        subtitle="Live database row counts, API key status, and recent server errors."
        actions={
          <BrandButton variant="secondary" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </BrandButton>
        }
      />

      {/* API key health */}
      <BrandCard className="mb-5">
        <SectionTitle
          title="API key status"
          description="Live ping of provider /v1/models endpoints. Fal.ai is treated as configured if FAL_KEY is set."
        />
        {!data ? (
          <div className="text-xs text-aristo-brown/50 flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />Loading…
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(["anthropic", "openai", "fal"] as const).map((p) => {
              const status = data.apiKeys[p];
              const meta   = STATUS_LABEL[status];
              return (
                <BrandCard
                  key={p}
                  variant={status === "ok" ? "success" : status === "missing_key" ? "warning" : "danger"}
                  padding="sm"
                >
                  <div className="flex items-center gap-2">
                    {status === "ok"
                      ? <CircleCheck className="h-4 w-4 text-green-600" />
                      : <CircleAlert className="h-4 w-4 text-amber-600" />}
                    <span className="text-xs font-bold uppercase tracking-wider text-aristo-brown/70">
                      {p}
                    </span>
                  </div>
                  <BrandBadge variant={meta.variant} size="md" className="mt-2">
                    {meta.label}
                  </BrandBadge>
                </BrandCard>
              );
            })}
          </div>
        )}
      </BrandCard>

      {/* Row counts */}
      <BrandCard className="mb-5">
        <SectionTitle
          title="Database row counts"
          description="Live counts from public.* via the service role. Updated on each refresh."
        />
        {!data ? (
          <div className="text-xs text-aristo-brown/50 flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />Loading…
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {Object.entries(data.rowCounts).map(([t, c]) => (
              <div key={t} className="bg-white/60 rounded-xl px-3 py-2 flex justify-between items-center">
                <span className="text-[11px] text-aristo-brown/70 font-mono truncate" title={t}>
                  {t}
                </span>
                <span className="text-sm font-bold tabular-nums text-aristo-brown">
                  {c.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </BrandCard>

      {/* Recent errors */}
      <BrandCard>
        <SectionTitle
          title="Recent audit-log errors"
          description="Audit log entries whose diff contains an `error` field. Useful for spotting hot-path bugs without leaving the admin."
        />
        {!data ? (
          <p className="text-xs text-aristo-brown/50">Loading…</p>
        ) : data.recentErrors.length === 0 ? (
          <p className="text-xs text-aristo-brown/50 flex items-center gap-2">
            <Server className="h-3.5 w-3.5" />
            No recent errors — system is happy.
          </p>
        ) : (
          <div className="space-y-2">
            {data.recentErrors.map((e) => (
              <div key={e.id} className="bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <BrandBadge variant="red">{e.action}</BrandBadge>
                  {e.target_type && (
                    <BrandBadge variant="neutral" size="sm">
                      {e.target_type}: {e.target_id ?? "—"}
                    </BrandBadge>
                  )}
                  <span className="text-[10px] text-aristo-brown/40 ml-auto">
                    {new Date(e.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-red-800 leading-snug">
                  {e.diff.error ?? JSON.stringify(e.diff)}
                </p>
              </div>
            ))}
          </div>
        )}
      </BrandCard>
    </>
  );
}
