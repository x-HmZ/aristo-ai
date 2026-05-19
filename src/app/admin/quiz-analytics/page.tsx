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
  analyze:    "#F59E0B",
  evaluate:   "#F97316",
  create:     "#8B5CF6",
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
            !data ? "#F97B2F" :
            data.summary.overall_accuracy >= 70 ? "#22C55E" :
            data.summary.overall_accuracy >= 50 ? "#F97B2F" : "#EF4444"
          }
          icon={<Target className="h-5 w-5" />}
        />
        <StatCard
          label="Avg response time"
          value={data?.summary.avg_response_s != null ? `${data.summary.avg_response_s}s` : "—"}
          color="#8B5CF6"
          icon={<Clock className="h-5 w-5" />}
        />
      </div>

      {/* Bloom + Type side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <BrandCard>
          <SectionTitle title="Accuracy by Bloom level" description="How learners perform across cognitive complexity." />
          {sortedBloom.length === 0 ? (
            <p className="text-xs text-aristo-brown/50">No quiz data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={sortedBloom} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#FBA962" strokeOpacity={0.2} />
                <XAxis dataKey="bloom" tick={{ fontSize: 11, fill: "#3D2110" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#3D2110" }} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(253, 248, 239, 0.95)",
                    border: "1px solid rgba(248, 123, 47, 0.3)",
                    borderRadius: 12,
                  }}
                  formatter={(value, name) =>
                    name === "accuracy" ? `${value}%` : (value as number | string)
                  }
                />
                <Bar dataKey="accuracy" radius={[6, 6, 0, 0]}>
                  {sortedBloom.map((entry) => (
                    <Cell key={entry.bloom} fill={BLOOM_COLOR_HEX[entry.bloom] ?? "#F97B2F"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </BrandCard>

        <BrandCard>
          <SectionTitle title="Accuracy by question type" description="Which formats trip learners up most?" />
          {data?.byType.length === 0 || !data ? (
            <p className="text-xs text-aristo-brown/50">No quiz data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.byType} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#FBA962" strokeOpacity={0.2} />
                <XAxis
                  dataKey="type"
                  tick={{ fontSize: 10, fill: "#3D2110" }}
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#3D2110" }} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(253, 248, 239, 0.95)",
                    border: "1px solid rgba(248, 123, 47, 0.3)",
                    borderRadius: 12,
                  }}
                  formatter={(value) => `${value}%`}
                />
                <Bar dataKey="accuracy" fill="#F97B2F" radius={[6, 6, 0, 0]} />
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
          <p className="text-xs text-aristo-brown/50">
            Not enough data — need at least 20 attempts per 0.1-wide difficulty bucket.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#FBA962" strokeOpacity={0.2} />
              <XAxis
                type="number"
                dataKey="difficulty"
                domain={[0, 1]}
                tick={{ fontSize: 11, fill: "#3D2110" }}
                label={{ value: "Declared difficulty", position: "insideBottom", offset: -5, fontSize: 11, fill: "#8B6E5A" }}
              />
              <YAxis
                type="number"
                dataKey="accuracy"
                domain={[0, 1]}
                tick={{ fontSize: 11, fill: "#3D2110" }}
                label={{ value: "Actual accuracy", angle: -90, position: "insideLeft", fontSize: 11, fill: "#8B6E5A" }}
              />
              <ZAxis dataKey="n" range={[40, 400]} name="Sample size" />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                contentStyle={{
                  background: "rgba(253, 248, 239, 0.95)",
                  border: "1px solid rgba(248, 123, 47, 0.3)",
                  borderRadius: 12,
                }}
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
                stroke="#8B5CF6"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                ifOverflow="hidden"
              />
              <Scatter data={data.calibration} fill="#F97B2F" />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </BrandCard>

      {/* Trend */}
      <BrandCard>
        <SectionTitle title="Daily accuracy trend" description="Are recent lesson + curriculum changes moving the needle?" />
        {!data || data.trend.length === 0 ? (
          <p className="text-xs text-aristo-brown/50">No quiz data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.trend} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#FBA962" strokeOpacity={0.2} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: "#3D2110" }}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#3D2110" }} />
              <Tooltip
                contentStyle={{
                  background: "rgba(253, 248, 239, 0.95)",
                  border: "1px solid rgba(248, 123, 47, 0.3)",
                  borderRadius: 12,
                }}
                formatter={(value, name) =>
                  name === "accuracy" ? `${value}%` : (value as number | string)
                }
              />
              <Line
                type="monotone"
                dataKey="accuracy"
                stroke="#F97B2F"
                strokeWidth={2}
                dot={{ r: 3, fill: "#F97B2F" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </BrandCard>
    </>
  );
}
