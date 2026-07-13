"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshCw, Wallet, TrendingUp, BarChart3, ChevronRight, ChevronDown, ExternalLink,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis, Cell,
} from "recharts";
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

interface Summary {
  range:                  "24h" | "7d" | "30d";
  total_usd:              number;
  event_count:            number;
  projected_monthly_usd:  number;
  byProvider: { provider: string; usd: number }[];
  byFeature:  { feature: string; usd: number; count: number }[];
  byModel:    { model: string;   usd: number; count: number }[];
  trend:      { day: string; usd: number; count: number }[];
  topUsers:   { user_id: string; email: string | null; usd: number; count: number }[];
  userBreakdown: {
    user_id:    string;
    email:      string | null;
    usd:        number;
    count:      number;
    byFeature:  { feature: string; usd: number; count: number }[];
    byProvider: { provider: string; usd: number; count: number }[];
    byModel:    { model: string;   usd: number; count: number }[];
  }[];
  providerFeatureMatrix: {
    provider: string;
    usd:      number;
    features: { feature: string; usd: number; count: number }[];
  }[];
}

const PROVIDER_COLOR: Record<string, string> = {
  anthropic: "#F97B2F",
  openai:    "#22C55E",
  fal:       "#8B5CF6",
};

export default function CostPage() {
  const [range, setRange]         = useState<"24h" | "7d" | "30d">("7d");
  const [data, setData]           = useState<Summary | null>(null);
  const [loading, setLoading]     = useState(false);
  const [expandedUser, setExpUsr] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/cost/summary?range=${range}`, { cache: "no-store" });
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [range]);

  useEffect(() => { load(); }, [load]);

  // Filtered user list (search by email / id)
  const filteredUsers = useMemo(() => {
    if (!data) return [];
    const term = userSearch.trim().toLowerCase();
    if (!term) return data.userBreakdown;
    return data.userBreakdown.filter((u) =>
      (u.email ?? "").toLowerCase().includes(term) ||
      u.user_id.toLowerCase().includes(term)
    );
  }, [data, userSearch]);

  return (
    <>
      <PageHeader
        title="Cost"
        subtitle="Total LLM, embedding, and media-generation spend recorded via the usage_events wrapper. Refresh after a hot-path lesson to confirm new rows arrive."
        actions={
          <>
            <Select value={range} onValueChange={(v) => setRange(v as "24h" | "7d" | "30d")}>
              <SelectTrigger className="w-32 bg-white/60 border-white/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
            <BrandButton variant="secondary" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </BrandButton>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total spend"
          value={data ? `$${data.total_usd.toFixed(2)}` : "—"}
          icon={<Wallet className="h-5 w-5" />}
        />
        <StatCard
          label="API calls"
          value={data?.event_count ?? 0}
          color="#3B82F6"
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <StatCard
          label="Cost per call"
          value={
            data && data.event_count > 0
              ? `$${(data.total_usd / data.event_count).toFixed(4)}`
              : "—"
          }
          color="#8B5CF6"
        />
        <StatCard
          label="Projected monthly"
          value={data ? `$${data.projected_monthly_usd.toFixed(2)}` : "—"}
          color="#22C55E"
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>

      {/* Trend + By provider */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <BrandCard>
          <SectionTitle title="Daily spend trend" description={`USD per day over the last ${range}.`} />
          {!data || data.trend.length === 0 ? (
            <p className="text-xs text-aristo-brown/50">No spend recorded in this range.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.trend} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <defs>
                  <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#F97B2F" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#F97B2F" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#FBA962" strokeOpacity={0.2} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: "#3D2110" }}
                  tickFormatter={(v) => v.slice(5)}
                />
                <YAxis tick={{ fontSize: 11, fill: "#3D2110" }} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(253, 248, 239, 0.95)",
                    border: "1px solid rgba(248, 123, 47, 0.3)",
                    borderRadius: 12,
                  }}
                  formatter={(value) => `$${Number(value).toFixed(4)}`}
                />
                <Area
                  type="monotone"
                  dataKey="usd"
                  stroke="#F97B2F"
                  strokeWidth={2}
                  fill="url(#costGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </BrandCard>

        <BrandCard>
          <SectionTitle title="Spend by provider" description="Which providers account for most cost?" />
          {!data || data.byProvider.length === 0 ? (
            <p className="text-xs text-aristo-brown/50">No spend recorded in this range.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.byProvider} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#FBA962" strokeOpacity={0.2} />
                <XAxis dataKey="provider" tick={{ fontSize: 11, fill: "#3D2110" }} />
                <YAxis tick={{ fontSize: 11, fill: "#3D2110" }} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(253, 248, 239, 0.95)",
                    border: "1px solid rgba(248, 123, 47, 0.3)",
                    borderRadius: 12,
                  }}
                  formatter={(value) => `$${Number(value).toFixed(4)}`}
                />
                <Bar dataKey="usd" radius={[6, 6, 0, 0]}>
                  {data.byProvider.map((p) => (
                    <Cell key={p.provider} fill={PROVIDER_COLOR[p.provider] ?? "#94A3B8"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </BrandCard>
      </div>

      {/* By feature */}
      <BrandCard padding="none" className="mb-6">
        <div className="px-5 pt-5">
          <SectionTitle
            title="Spend by feature"
            description="Cost partitioned by the `feature` tag set in each LLM wrapper call."
          />
        </div>
        {!data || data.byFeature.length === 0 ? (
          <p className="px-5 pb-5 text-xs text-aristo-brown/50">No spend recorded.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Feature</TableHead>
                <TableHead>Calls</TableHead>
                <TableHead className="text-right">Spend</TableHead>
                <TableHead className="text-right">Avg / call</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.byFeature.map((f) => (
                <TableRow key={f.feature}>
                  <TableCell className="font-mono text-xs text-aristo-brown">{f.feature}</TableCell>
                  <TableCell className="text-xs text-aristo-brown/70 tabular-nums">{f.count}</TableCell>
                  <TableCell className="text-right text-xs font-bold text-aristo-brown tabular-nums">
                    ${f.usd.toFixed(4)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-aristo-brown/70 tabular-nums">
                    ${(f.usd / Math.max(1, f.count)).toFixed(4)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </BrandCard>

      {/* Spend by model — full width */}
      <BrandCard padding="none" className="mb-6">
        <div className="px-5 pt-5">
          <SectionTitle
            title="Spend by model"
            description="Per-API spend partitioned by the model identifier (e.g. claude-sonnet-5, text-embedding-3-small, tripo3d)."
          />
        </div>
        {!data || data.byModel.length === 0 ? (
          <p className="px-5 pb-5 text-xs text-aristo-brown/50">No data.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Calls</TableHead>
                <TableHead className="text-right">Avg / call</TableHead>
                <TableHead className="text-right">Spend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.byModel.map((m) => (
                <TableRow key={m.model}>
                  <TableCell className="font-mono text-[11px] text-aristo-brown">{m.model}</TableCell>
                  <TableCell className="text-right text-xs text-aristo-brown/70 tabular-nums">{m.count}</TableCell>
                  <TableCell className="text-right text-xs text-aristo-brown/70 tabular-nums">
                    ${(m.usd / Math.max(1, m.count)).toFixed(4)}
                  </TableCell>
                  <TableCell className="text-right text-xs font-bold text-aristo-brown tabular-nums">
                    ${m.usd.toFixed(4)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </BrandCard>

      {/* Provider × Feature matrix — which APIs power which services */}
      <BrandCard className="mb-6">
        <SectionTitle
          title="Per-API × per-service breakdown"
          description="Cost partitioned by API provider AND by the feature it powers. Use this to spot which service is driving spend on which provider."
        />
        {!data || data.providerFeatureMatrix.length === 0 ? (
          <p className="text-xs text-aristo-brown/50">No spend recorded.</p>
        ) : (
          <div className="space-y-4">
            {data.providerFeatureMatrix.map((p) => (
              <div key={p.provider} className="rounded-xl border border-white/60 bg-white/40 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: PROVIDER_COLOR[p.provider] ?? "#94A3B8" }}
                    />
                    <span className="font-mono text-xs font-bold text-aristo-brown uppercase">
                      {p.provider}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-aristo-brown tabular-nums">
                    ${p.usd.toFixed(4)}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {p.features.map((f) => {
                    const pct = (f.usd / Math.max(0.0001, p.usd)) * 100;
                    return (
                      <div key={f.feature} className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-aristo-brown/70 w-40 truncate">
                          {f.feature}
                        </span>
                        <div className="flex-1 h-1.5 rounded-full bg-white/60 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              background: PROVIDER_COLOR[p.provider] ?? "#94A3B8",
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-aristo-brown/60 tabular-nums w-12 text-right">
                          {f.count}
                        </span>
                        <span className="text-[10px] font-bold text-aristo-brown tabular-nums w-16 text-right">
                          ${f.usd.toFixed(4)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </BrandCard>

      {/* Per-user breakdown — full table with expandable rows */}
      <BrandCard padding="none">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-4 flex-wrap">
          <SectionTitle
            title="Per-user spend"
            description="Every user with recorded usage. Expand a row to see their per-API and per-service breakdown."
          />
          <div className="flex items-center gap-2">
            <input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Filter by email…"
              className="w-56 text-xs bg-white/60 border border-white/60 rounded-xl px-3 py-1.5 text-aristo-brown placeholder:text-aristo-brown/40 focus:outline-none focus:ring-2 focus:ring-aristo-orange/40"
            />
            <BrandBadge variant="neutral" size="md">
              {data ? `${filteredUsers.length} / ${data.userBreakdown.length}` : "—"}
            </BrandBadge>
          </div>
        </div>
        {!data || data.userBreakdown.length === 0 ? (
          <p className="px-5 pb-5 text-xs text-aristo-brown/50">No spend tied to users yet.</p>
        ) : filteredUsers.length === 0 ? (
          <p className="px-5 pb-5 text-xs text-aristo-brown/50">No users match that filter.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-6" />
                <TableHead>User</TableHead>
                <TableHead>Top service</TableHead>
                <TableHead>Top API</TableHead>
                <TableHead className="text-right">Calls</TableHead>
                <TableHead className="text-right">Total spend</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((u) => {
                const isOpen   = expandedUser === u.user_id;
                const topFeat  = u.byFeature[0];
                const topProv  = u.byProvider[0];
                return (
                  <Fragment key={u.user_id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setExpUsr(isOpen ? null : u.user_id)}
                    >
                      <TableCell>
                        {isOpen
                          ? <ChevronDown   className="h-3.5 w-3.5 text-aristo-brown/50" />
                          : <ChevronRight  className="h-3.5 w-3.5 text-aristo-brown/50" />}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-medium text-aristo-brown truncate max-w-[260px]">
                          {u.email ?? "—"}
                        </div>
                        <div className="font-mono text-[10px] text-aristo-brown/40 truncate max-w-[260px]">
                          {u.user_id}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-aristo-brown/70">
                        {topFeat ? `${topFeat.feature} ($${topFeat.usd.toFixed(4)})` : "—"}
                      </TableCell>
                      <TableCell className="text-[11px] text-aristo-brown/70">
                        {topProv ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ background: PROVIDER_COLOR[topProv.provider] ?? "#94A3B8" }}
                            />
                            {topProv.provider} (${topProv.usd.toFixed(4)})
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs text-aristo-brown/70 tabular-nums">
                        {u.count}
                      </TableCell>
                      <TableCell className="text-right text-xs font-bold text-aristo-brown tabular-nums">
                        ${u.usd.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-right">
                        <a
                          href={`/admin/users?userId=${u.user_id}`}
                          onClick={(e) => e.stopPropagation()}
                          title="Open user drawer"
                          className="inline-flex p-1.5 rounded-lg hover:bg-white/70 text-aristo-brown/60 hover:text-aristo-orange transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow key={`${u.user_id}-detail`} className="hover:bg-transparent">
                        <TableCell colSpan={7} className="bg-aristo-cream/40">
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-3">
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-aristo-brown/50 mb-2">
                                Per service
                              </div>
                              <div className="space-y-1">
                                {u.byFeature.map((f) => {
                                  const pct = (f.usd / Math.max(0.0001, u.usd)) * 100;
                                  return (
                                    <div key={f.feature} className="flex items-center gap-2">
                                      <span className="font-mono text-[10px] text-aristo-brown/70 w-32 truncate">
                                        {f.feature}
                                      </span>
                                      <div className="flex-1 h-1.5 rounded-full bg-white/70 overflow-hidden">
                                        <div className="h-full bg-aristo-orange rounded-full" style={{ width: `${pct}%` }} />
                                      </div>
                                      <span className="text-[10px] text-aristo-brown/60 tabular-nums w-8 text-right">
                                        {f.count}
                                      </span>
                                      <span className="text-[10px] font-bold text-aristo-brown tabular-nums w-16 text-right">
                                        ${f.usd.toFixed(4)}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-aristo-brown/50 mb-2">
                                Per API
                              </div>
                              <div className="space-y-1">
                                {u.byProvider.map((p) => {
                                  const pct = (p.usd / Math.max(0.0001, u.usd)) * 100;
                                  return (
                                    <div key={p.provider} className="flex items-center gap-2">
                                      <span
                                        className="h-2 w-2 rounded-full"
                                        style={{ background: PROVIDER_COLOR[p.provider] ?? "#94A3B8" }}
                                      />
                                      <span className="font-mono text-[10px] text-aristo-brown/70 w-24 truncate uppercase">
                                        {p.provider}
                                      </span>
                                      <div className="flex-1 h-1.5 rounded-full bg-white/70 overflow-hidden">
                                        <div
                                          className="h-full rounded-full"
                                          style={{
                                            width: `${pct}%`,
                                            background: PROVIDER_COLOR[p.provider] ?? "#94A3B8",
                                          }}
                                        />
                                      </div>
                                      <span className="text-[10px] text-aristo-brown/60 tabular-nums w-8 text-right">
                                        {p.count}
                                      </span>
                                      <span className="text-[10px] font-bold text-aristo-brown tabular-nums w-16 text-right">
                                        ${p.usd.toFixed(4)}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-aristo-brown/50 mb-2">
                                Per model
                              </div>
                              <div className="space-y-1">
                                {u.byModel.map((m) => {
                                  const pct = (m.usd / Math.max(0.0001, u.usd)) * 100;
                                  return (
                                    <div key={m.model} className="flex items-center gap-2">
                                      <span className="font-mono text-[10px] text-aristo-brown/70 w-36 truncate">
                                        {m.model}
                                      </span>
                                      <div className="flex-1 h-1.5 rounded-full bg-white/70 overflow-hidden">
                                        <div className="h-full bg-aristo-purple rounded-full" style={{ width: `${pct}%`, background: "#8B5CF6" }} />
                                      </div>
                                      <span className="text-[10px] text-aristo-brown/60 tabular-nums w-8 text-right">
                                        {m.count}
                                      </span>
                                      <span className="text-[10px] font-bold text-aristo-brown tabular-nums w-16 text-right">
                                        ${m.usd.toFixed(4)}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </BrandCard>
    </>
  );
}
