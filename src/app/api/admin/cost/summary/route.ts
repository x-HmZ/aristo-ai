/**
 * GET /api/admin/cost/summary
 *
 * Aggregates usage_events for the cost dashboard.
 * Query: ?range=24h | 7d | 30d
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient }       from "@/lib/supabase/server";
import { verifyAdmin }               from "@/lib/admin/auth";
import { microsToUsd }               from "@/lib/llm/pricing";

const RANGES = {
  "24h": 24 * 60 * 60 * 1000,
  "7d":  7  * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
} as const;

type RangeKey = keyof typeof RANGES;

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url   = new URL(req.url);
  const range = (url.searchParams.get("range") ?? "7d") as RangeKey;
  const ms    = RANGES[range] ?? RANGES["7d"];
  const since = new Date(Date.now() - ms).toISOString();

  const service = createServiceClient();

  const { data, error } = await service
    .from("usage_events")
    .select("provider, model, feature, user_id, cost_usd_micros, input_tokens, output_tokens, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = {
    provider:        string;
    model:           string;
    feature:         string;
    user_id:         string | null;
    cost_usd_micros: number | null;
    input_tokens:    number | null;
    output_tokens:   number | null;
    created_at:      string;
  };

  const rows = (data ?? []) as Row[];
  const totalMicros = rows.reduce((s, r) => s + (r.cost_usd_micros ?? 0), 0);

  // ── byProvider ─────────────────────────────────────────────────────────────
  const byProviderAgg: Record<string, number> = {};
  for (const r of rows) {
    byProviderAgg[r.provider] = (byProviderAgg[r.provider] ?? 0) + (r.cost_usd_micros ?? 0);
  }
  const byProvider = Object.entries(byProviderAgg).map(([provider, micros]) => ({
    provider,
    usd: +microsToUsd(micros).toFixed(4),
  }));

  // ── byFeature ──────────────────────────────────────────────────────────────
  const byFeatureAgg: Record<string, { micros: number; n: number }> = {};
  for (const r of rows) {
    if (!byFeatureAgg[r.feature]) byFeatureAgg[r.feature] = { micros: 0, n: 0 };
    byFeatureAgg[r.feature].micros += r.cost_usd_micros ?? 0;
    byFeatureAgg[r.feature].n++;
  }
  const byFeature = Object.entries(byFeatureAgg).map(([feature, { micros, n }]) => ({
    feature,
    usd:   +microsToUsd(micros).toFixed(4),
    count: n,
  })).sort((a, b) => b.usd - a.usd);

  // ── byModel ────────────────────────────────────────────────────────────────
  const byModelAgg: Record<string, { micros: number; n: number }> = {};
  for (const r of rows) {
    if (!byModelAgg[r.model]) byModelAgg[r.model] = { micros: 0, n: 0 };
    byModelAgg[r.model].micros += r.cost_usd_micros ?? 0;
    byModelAgg[r.model].n++;
  }
  const byModel = Object.entries(byModelAgg).map(([model, { micros, n }]) => ({
    model,
    usd:   +microsToUsd(micros).toFixed(4),
    count: n,
  })).sort((a, b) => b.usd - a.usd);

  // ── Trend (daily) ──────────────────────────────────────────────────────────
  const dayAgg = new Map<string, { micros: number; n: number }>();
  for (const r of rows) {
    const day = r.created_at.slice(0, 10);
    if (!dayAgg.has(day)) dayAgg.set(day, { micros: 0, n: 0 });
    const d = dayAgg.get(day)!;
    d.micros += r.cost_usd_micros ?? 0;
    d.n++;
  }
  const trend = Array.from(dayAgg.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, { micros, n }]) => ({
      day,
      usd:   +microsToUsd(micros).toFixed(4),
      count: n,
    }));

  // ── Per-user breakdown (with provider + feature split) ────────────────────
  type UserAgg = {
    micros:     number;
    n:          number;
    byFeature:  Record<string, { micros: number; n: number }>;
    byProvider: Record<string, { micros: number; n: number }>;
    byModel:    Record<string, { micros: number; n: number }>;
  };
  const byUserAgg: Record<string, UserAgg> = {};
  for (const r of rows) {
    if (!r.user_id) continue;
    if (!byUserAgg[r.user_id]) {
      byUserAgg[r.user_id] = { micros: 0, n: 0, byFeature: {}, byProvider: {}, byModel: {} };
    }
    const u = byUserAgg[r.user_id];
    const cm = r.cost_usd_micros ?? 0;
    u.micros += cm;
    u.n++;
    if (!u.byFeature[r.feature])  u.byFeature[r.feature]  = { micros: 0, n: 0 };
    if (!u.byProvider[r.provider]) u.byProvider[r.provider] = { micros: 0, n: 0 };
    if (!u.byModel[r.model])      u.byModel[r.model]      = { micros: 0, n: 0 };
    u.byFeature[r.feature].micros += cm;  u.byFeature[r.feature].n++;
    u.byProvider[r.provider].micros += cm; u.byProvider[r.provider].n++;
    u.byModel[r.model].micros += cm;      u.byModel[r.model].n++;
  }

  // Resolve user_id → email so the table is readable.
  const userIds = Object.keys(byUserAgg);
  const emailMap = new Map<string, string | null>();
  if (userIds.length > 0) {
    const { data: authList } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of (authList?.users ?? [])) emailMap.set(u.id, u.email ?? null);
  }

  const userBreakdown = Object.entries(byUserAgg)
    .map(([user_id, u]) => ({
      user_id,
      email: emailMap.get(user_id) ?? null,
      usd:   +microsToUsd(u.micros).toFixed(4),
      count: u.n,
      byFeature: Object.entries(u.byFeature).map(([feature, { micros, n }]) => ({
        feature, usd: +microsToUsd(micros).toFixed(4), count: n,
      })).sort((a, b) => b.usd - a.usd),
      byProvider: Object.entries(u.byProvider).map(([provider, { micros, n }]) => ({
        provider, usd: +microsToUsd(micros).toFixed(4), count: n,
      })).sort((a, b) => b.usd - a.usd),
      byModel: Object.entries(u.byModel).map(([model, { micros, n }]) => ({
        model, usd: +microsToUsd(micros).toFixed(4), count: n,
      })).sort((a, b) => b.usd - a.usd),
    }))
    .sort((a, b) => b.usd - a.usd);

  // Backward-compat slim list of top spenders.
  const topUsers = userBreakdown.slice(0, 20).map((u) => ({
    user_id: u.user_id,
    email:   u.email,
    usd:     u.usd,
    count:   u.count,
  }));

  // ── Per-provider × per-feature matrix (which APIs power which services) ───
  const providerFeatureAgg: Record<string, Record<string, { micros: number; n: number }>> = {};
  for (const r of rows) {
    if (!providerFeatureAgg[r.provider]) providerFeatureAgg[r.provider] = {};
    const f = providerFeatureAgg[r.provider];
    if (!f[r.feature]) f[r.feature] = { micros: 0, n: 0 };
    f[r.feature].micros += r.cost_usd_micros ?? 0;
    f[r.feature].n++;
  }
  const providerFeatureMatrix = Object.entries(providerFeatureAgg).map(([provider, features]) => ({
    provider,
    usd: +microsToUsd(
      Object.values(features).reduce((s, v) => s + v.micros, 0)
    ).toFixed(4),
    features: Object.entries(features).map(([feature, { micros, n }]) => ({
      feature,
      usd:   +microsToUsd(micros).toFixed(4),
      count: n,
    })).sort((a, b) => b.usd - a.usd),
  })).sort((a, b) => b.usd - a.usd);

  // Projected monthly cost = (7d total / 7) * 30 if 7d range; else just scale.
  const days = ms / (24 * 60 * 60 * 1000);
  const projected_monthly_usd =
    days > 0 ? +((microsToUsd(totalMicros) / days) * 30).toFixed(2) : 0;

  return NextResponse.json({
    range,
    total_usd: +microsToUsd(totalMicros).toFixed(4),
    event_count: rows.length,
    projected_monthly_usd,
    byProvider,
    byFeature,
    byModel,
    trend,
    topUsers,
    userBreakdown,
    providerFeatureMatrix,
  });
}
