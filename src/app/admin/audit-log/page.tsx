"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ScrollText, Loader2 } from "lucide-react";
import { PageHeader }                from "@/components/admin/PageHeader";
import { BrandCard }                 from "@/components/admin/ui/BrandCard";
import { BrandButton }               from "@/components/admin/ui/BrandButton";
import { BrandBadge }                from "@/components/admin/ui/BrandBadge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Entry {
  id:          string;
  actor_id:    string | null;
  actor_email: string | null;
  action:      string;
  target_type: string | null;
  target_id:   string | null;
  diff:        Record<string, unknown> | null;
  ip:          string | null;
  user_agent:  string | null;
  created_at:  string;
}

interface ApiResponse {
  entries:      Entry[];
  total:        number;
  actions:      string[];
  target_types: string[];
}

export default function AuditLogPage() {
  const [actor, setActor]       = useState("");
  const [action, setAction]     = useState("all");
  const [target, setTarget]     = useState("all");
  const [data, setData]         = useState<ApiResponse | null>(null);
  const [loading, setLoading]   = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (actor)            qs.set("actor", actor);
    if (action !== "all") qs.set("action", action);
    if (target !== "all") qs.set("target_type", target);
    qs.set("limit", "100");
    const res = await fetch(`/api/admin/audit-log?${qs.toString()}`, { cache: "no-store" });
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [actor, action, target]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Every administrative mutation is recorded here. Click a row to inspect the diff."
        actions={
          <BrandButton variant="secondary" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </BrandButton>
        }
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={actor}
              onChange={(e) => setActor(e.target.value)}
              placeholder="Filter by actor email…"
              className="w-64 text-sm bg-white/60 border border-white/60 rounded-xl px-3 py-2 text-aristo-brown placeholder:text-aristo-brown/40 focus:outline-none focus:ring-2 focus:ring-aristo-orange/40"
            />
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="w-48 bg-white/60 border-white/60">
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {(data?.actions ?? []).map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger className="w-44 bg-white/60 border-white/60">
                <SelectValue placeholder="Any target" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any target type</SelectItem>
                {(data?.target_types ?? []).map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="ml-auto text-xs text-aristo-brown/50">
              {data ? `${data.entries.length} of ${data.total} shown` : "Loading…"}
            </span>
          </div>
        }
      />

      <BrandCard padding="none">
        {data === null ? (
          <div className="p-8 text-center text-xs text-aristo-brown/50">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            Loading audit log…
          </div>
        ) : data.entries.length === 0 ? (
          <div className="p-10 text-center">
            <ScrollText className="h-10 w-10 text-aristo-brown/30 mx-auto mb-3" />
            <p className="text-sm text-aristo-brown/60">No matching entries.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.entries.map((e) => (
                <>
                  <TableRow
                    key={e.id}
                    className="cursor-pointer"
                    onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                  >
                    <TableCell className="text-[11px] text-aristo-brown/70 whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs text-aristo-brown max-w-[200px] truncate">
                      {e.actor_email ?? <span className="text-aristo-brown/30">{e.actor_id?.slice(0, 8) ?? "—"}</span>}
                    </TableCell>
                    <TableCell>
                      <BrandBadge
                        variant={
                          e.action.includes("delete") ? "red" :
                          e.action.includes("publish") || e.action.includes("create") ? "green" :
                          e.action.includes("promote") || e.action.includes("admin") ? "purple" : "blue"
                        }
                      >
                        {e.action}
                      </BrandBadge>
                    </TableCell>
                    <TableCell className="text-xs text-aristo-brown/70">
                      {e.target_type && (
                        <BrandBadge variant="neutral" size="sm" className="mr-1">{e.target_type}</BrandBadge>
                      )}
                      <span className="font-mono text-[10px]">{e.target_id ?? "—"}</span>
                    </TableCell>
                    <TableCell className="text-[11px] text-aristo-brown/50 font-mono">
                      {e.ip ?? "—"}
                    </TableCell>
                  </TableRow>
                  {expanded === e.id && e.diff && (
                    <TableRow key={`${e.id}-diff`} className="hover:bg-transparent">
                      <TableCell colSpan={5} className="bg-white/40">
                        <pre className="text-[10px] font-mono text-aristo-brown whitespace-pre-wrap break-all p-2 max-h-72 overflow-y-auto">
                          {JSON.stringify(e.diff, null, 2)}
                        </pre>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        )}
      </BrandCard>
    </>
  );
}
