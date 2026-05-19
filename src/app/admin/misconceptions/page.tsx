"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, AlertTriangle, CheckCircle2, RotateCcw, Loader2 } from "lucide-react";
import { PageHeader }                from "@/components/admin/PageHeader";
import { BrandCard }                 from "@/components/admin/ui/BrandCard";
import { BrandButton }               from "@/components/admin/ui/BrandButton";
import { BrandBadge }                from "@/components/admin/ui/BrandBadge";
import { StatCard }                  from "@/components/admin/ui/StatCard";
import { SectionTitle }              from "@/components/admin/ui/SectionTitle";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface AggregateRow {
  concept_id:        string;
  concept_name:      string | null;
  domain:            string | null;
  misconception:     string;
  occurrence_count:  number;
  user_count:        number;
  resolved_count:    number;
  last_seen:         string | null;
  ids:               string[];
}

interface ApiResponse {
  rows:             AggregateRow[];
  domains:          string[];
  total_unresolved: number;
  total_resolved:   number;
}

export default function MisconceptionsPage() {
  const [domain, setDomain]       = useState("all");
  const [filter, setFilter]       = useState<"all" | "active" | "resolved">("active");
  const [data, setData]           = useState<ApiResponse | null>(null);
  const [loading, setLoading]     = useState(false);
  const [busyKey, setBusyKey]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (domain !== "all") qs.set("domain", domain);
    if (filter === "active")    qs.set("resolved", "false");
    if (filter === "resolved")  qs.set("resolved", "true");
    const res = await fetch(`/api/admin/misconceptions?${qs.toString()}`, { cache: "no-store" });
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [domain, filter]);

  useEffect(() => { load(); }, [load]);

  const markResolved = async (row: AggregateRow, resolved: boolean) => {
    const key = `${row.concept_id}::${row.misconception}`;
    setBusyKey(key);
    await fetch(`/api/admin/misconceptions/bulk`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ resolved, ids: row.ids }),
    });
    setBusyKey(null);
    load();
  };

  const maxOccurrence = Math.max(1, ...(data?.rows.map((r) => r.occurrence_count) ?? [1]));

  return (
    <>
      <PageHeader
        title="Misconceptions"
        subtitle="Aggregated misunderstandings detected by the assessment agent. Spotlight repeat offenders and resolve them after curriculum changes."
        actions={
          <BrandButton variant="secondary" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </BrandButton>
        }
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={domain} onValueChange={setDomain}>
              <SelectTrigger className="w-56 bg-white/60 border-white/60">
                <SelectValue placeholder="All domains" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All domains</SelectItem>
                {(data?.domains ?? []).map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filter} onValueChange={(v) => setFilter(v as "all" | "active" | "resolved")}>
              <SelectTrigger className="w-44 bg-white/60 border-white/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="resolved">Resolved only</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Unique misconceptions"
          value={data?.rows.length ?? 0}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <StatCard
          label="Unresolved (learner-rows)"
          value={data?.total_unresolved ?? 0}
          color="#EF4444"
        />
        <StatCard
          label="Resolved (learner-rows)"
          value={data?.total_resolved ?? 0}
          color="#22C55E"
        />
      </div>

      <BrandCard padding="none">
        <div className="px-5 pt-5">
          <SectionTitle
            title="Heatmap"
            description="Heavier bars = more occurrences. Click resolve once you've fixed the underlying lesson."
          />
        </div>
        {data === null ? (
          <div className="p-8 text-center text-xs text-aristo-brown/50">
            Loading…
          </div>
        ) : data.rows.length === 0 ? (
          <div className="p-10 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-aristo-brown/60">No matching misconceptions.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Concept</TableHead>
                <TableHead className="w-[40%]">Misconception</TableHead>
                <TableHead>Occurrences</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Last seen</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r) => {
                const key = `${r.concept_id}::${r.misconception}`;
                const isUnresolved = r.user_count - r.resolved_count > 0;
                const intensity    = Math.round((r.occurrence_count / maxOccurrence) * 100);
                return (
                  <TableRow key={key}>
                    <TableCell className="max-w-[200px]">
                      <div className="text-aristo-brown font-medium truncate">
                        {r.concept_name ?? r.concept_id}
                      </div>
                      {r.domain && (
                        <BrandBadge variant="neutral" size="sm" className="mt-1">{r.domain}</BrandBadge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-aristo-brown/80 max-w-[420px]">
                      <span className="line-clamp-2">{r.misconception}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[140px]">
                        <div className="flex-1 bg-white/60 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${intensity}%`,
                              background:
                                intensity > 80 ? "#DC2626" :
                                intensity > 50 ? "#F97316" :
                                intensity > 25 ? "#F59E0B" : "#94A3B8",
                            }}
                          />
                        </div>
                        <span className="text-xs text-aristo-brown/70 tabular-nums w-8 text-right">
                          {r.occurrence_count}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <BrandBadge variant={r.resolved_count > 0 ? "amber" : "red"} size="md">
                        {r.user_count - r.resolved_count} / {r.user_count}
                      </BrandBadge>
                    </TableCell>
                    <TableCell className="text-[11px] text-aristo-brown/50">
                      {r.last_seen ? new Date(r.last_seen).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {isUnresolved ? (
                        <BrandButton
                          variant="success"
                          size="sm"
                          onClick={() => markResolved(r, true)}
                          disabled={busyKey === key}
                        >
                          {busyKey === key
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <CheckCircle2 className="h-3.5 w-3.5" />}
                          Resolve
                        </BrandButton>
                      ) : (
                        <BrandButton
                          variant="outline"
                          size="sm"
                          onClick={() => markResolved(r, false)}
                          disabled={busyKey === key}
                        >
                          {busyKey === key
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <RotateCcw className="h-3.5 w-3.5" />}
                          Reopen
                        </BrandButton>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </BrandCard>
    </>
  );
}
