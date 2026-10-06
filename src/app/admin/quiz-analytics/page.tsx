"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw, BarChart3, Target, Clock,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, ReferenceLine,
  LineChart, Line, CartesianGrid, Cell,
} from "recharts";
import { PageHeader }                from "@/components/admin/PageHeader";
import { BrandCard }                 from "@/components/admin/ui/BrandCard";
import { BrandButton }               from "@/components/admin/ui/BrandButton";
import { StatCard }                  from "@/components/admin/ui/StatCard";
import { SectionTitle }              from "@/components/admin/ui/SectionTitle";
import { BRAND_HEX } from "@/lib/brandColors";
import { TONE, AXIS_TICK, AXIS_LABEL, GRID, TOOLTIP } from "@/components/admin/chart";

interface Analytics {
  summary: {
    total_attempts:   number;
    overall_accuracy: number;
    avg_response_s:   number | null;
  };
  byBloom:     { bloom: string; accuracy: number; count: number }[];
  byType:      { type: string; accuracy: number; count: number; avg_response_s: number | null }[];
  calibration: { difficulty: number; accuracy: number; n: number }[];
  trend:       { day: string; accuracy: number; count: number }[];
}

const BLOOM_ORDER = ["remember", "understand", "apply", "analyze", "evaluate", "create"];

const BLOOM_COLOR_HEX: Record<string, string> = {
  remember:   "#94A3B8",
  understand: "#60A5FA",
  apply:      "#22C55E",
  analyze:    BRAND_HEX.amber,
  evaluate:   "#F97316",
  create:     BRAND_HEX.purple,
};

export default function QuizAnalyticsPage() {
  const [data, setData]       = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/quiz-analytics", { cache: "no-store" });
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const sortedBloom = [...(data?.byBloom ?? [])].sort(
    (a, b) => BLOOM_ORDER.indexOf(a.bloom) - BLOOM_ORDER.indexOf(b.bloom)
  );

  return (
    <>
      <PageHeader
        title="Quiz analytics"
        subtitle="Per-Bloom accuracy, question-type performance, and difficulty calibration (declared difficulty vs. actual success rate)."
        actions={
          <BrandButton variant="secondary" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </BrandButton>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Total attempts"
          value={data?.summary.total_attempts ?? 0}
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <StatCard
          label="Overall accuracy"
          value={data ? `${data.summary.overall_accuracy}%` : "—"}
          color={
            !data ? undefined :
            data.summary.overall_accuracy >= 70 ? TONE.success :
            data.summary.overall_accuracy >= 50 ? TONE.warning : TONE.danger
          }
          icon={<Target className="h-5 w-5" />}
        />
        <StatCard
          label="Avg response time"
          value={data?.summary.avg_response_s != null ? `${data.summary.avg_response_s}s` : "—"}
          icon={<Clock className="h-5 w-5" />}
        />
      </div>

      {/* Bloom + Type side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <BrandCard>
          <SectionTitle title="Accuracy by Bloom level" description="How learners perform across cognitive complexity." />
          {sortedBloom.length === 0 ? (
            <p className="text-xs text-muted">No quiz data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={sortedBloom} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="bloom" tick={AXIS_TICK} />
                <YAxis domain={[0, 100]} tick={AXIS_TICK} />
                <Tooltip
                  contentStyle={TOOLTIP.contentStyle}
                  labelStyle={TOOLTIP.labelStyle}
                  itemStyle={TOOLTIP.itemStyle}
                  formatter={(value, name) =>
                    name === "accuracy" ? `${value}%` : (value as number | string)
                  }
                />
                <Bar dataKey="accuracy" radius={[6, 6, 0, 0]}>
                  {sortedBloom.map((entry) => (
                    <Cell key={entry.bloom} fill={BLOOM_COLOR_HEX[entry.bloom] ?? TONE.accent} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </BrandCard>

        <BrandCard>
          <SectionTitle title="Accuracy by question type" description="Which formats trip learners up most?" />
          {data?.byType.length === 0 || !data ? (
            <p className="text-xs text-muted">No quiz data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.byType} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                <CartesianGrid {...GRID} />
                <XAxis
                  dataKey="type"
                  tick={AXIS_TICK}
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis domain={[0, 100]} tick={AXIS_TICK} />
                <Tooltip
                  contentStyle={TOOLTIP.contentStyle}
                  labelStyle={TOOLTIP.labelStyle}
                  itemStyle={TOOLTIP.itemStyle}
                  formatter={(value) => `${value}%`}
                />
                <Bar dataKey="accuracy" fill={TONE.accent} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </BrandCard>
      </div>

      {/* Calibration */}
      <BrandCard className="mb-6">
        <SectionTitle
          title="Difficulty calibration"
          description="X: declared difficulty (0–1) · Y: observed accuracy. The diagonal is perfect calibration (50% accuracy at 0.5 difficulty). Buckets with <20 attempts are hidden to avoid noise."
        />
        {!data || data.calibration.length === 0 ? (
          <p className="text-xs text-muted">
            Not enough data — need at least 20 attempts per 0.1-wide difficulty bucket.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid {...GRID} />
              <XAxis
                type="number"
                dataKey="difficulty"
                domain={[0, 1]}
                tick={AXIS_TICK}
                label={{ value: "Declared difficulty", position: "insideBottom", offset: -5, ...AXIS_LABEL }}
              />
              <YAxis
                type="number"
                dataKey="accuracy"
                domain={[0, 1]}
                tick={AXIS_TICK}
                label={{ value: "Actual accuracy", angle: -90, position: "insideLeft", ...AXIS_LABEL }}
              />
              <ZAxis dataKey="n" range={[40, 400]} name="Sample size" />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                contentStyle={TOOLTIP.contentStyle}
                  labelStyle={TOOLTIP.labelStyle}
                  itemStyle={TOOLTIP.itemStyle}
                formatter={(value, name) => {
                  if (name === "difficulty" || name === "accuracy") {
                    return `${((value as number) * 100).toFixed(0)}%`;
                  }
                  return value as number | string;
                }}
              />
              <ReferenceLine
                segment={[
                  { x: 0, y: 1 },
                  { x: 1, y: 0 },
                ]}
                stroke={TONE.muted}
                strokeDasharray="4 4"
                strokeWidth={1.5}
                ifOverflow="hidden"
              />
              <Scatter data={data.calibration} fill={TONE.accent} />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </BrandCard>

      {/* Trend */}
      <BrandCard>
        <SectionTitle title="Daily accuracy trend" description="Are recent lesson + curriculum changes moving the needle?" />
        {!data || data.trend.length === 0 ? (
          <p className="text-xs text-muted">No quiz data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.trend} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid {...GRID} />
              <XAxis
                dataKey="day"
                tick={AXIS_TICK}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis domain={[0, 100]} tick={AXIS_TICK} />
              <Tooltip
                contentStyle={TOOLTIP.contentStyle}
                  labelStyle={TOOLTIP.labelStyle}
                  itemStyle={TOOLTIP.itemStyle}
                formatter={(value, name) =>
                  name === "accuracy" ? `${value}%` : (value as number | string)
                }
              />
              <Line
                type="monotone"
                dataKey="accuracy"
                stroke={TONE.accent}
                strokeWidth={2}
                dot={{ r: 3, fill: TONE.accent }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </BrandCard>
    </>
  );
}
