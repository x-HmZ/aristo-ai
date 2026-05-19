"use client";

import { useEffect, useState }   from "react";
import {
  Users, BookOpen, Target, TrendingUp, RefreshCw,
} from "lucide-react";
import { PageHeader }            from "@/components/admin/PageHeader";
import { StatCard }              from "@/components/admin/ui/StatCard";
import { BrandCard }             from "@/components/admin/ui/BrandCard";
import { BrandButton }           from "@/components/admin/ui/BrandButton";
import { BrandBadge, BLOOM_COLOR } from "@/components/admin/ui/BrandBadge";
import { SectionTitle }          from "@/components/admin/ui/SectionTitle";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyticsData {
  stats: {
    totalStudents:     number;
    studentsThisWeek:  number;
    publishedCourses:  number;
    avgQuizScore:      number;
    totalQuizAttempts: number;
  };
  expertiseDistribution: { level: string; count: number; pct: number }[];
  bloomPerformance:      { bloom: string; accuracy: number; count: number }[];
  strugglingTopics:      { topic: string; avgScore: number; attempts: number }[];
  recentAttempts:        { topic: string; bloom: string; is_correct: boolean; at: string }[];
}

const EXPERTISE_META: Record<string, { label: string; color: string }> = {
  beginner:     { label: "Beginner",     color: "#22C55E" },
  intermediate: { label: "Intermediate", color: "#F97B2F" },
  advanced:     { label: "Advanced",     color: "#8B5CF6" },
};

const BLOOM_ORDER = ["remember", "understand", "apply", "analyze", "evaluate", "create"];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const [data, setData]           = useState<AnalyticsData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const fetchData = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/analytics", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Real-time pulse of student activity, performance, and curriculum coverage."
        actions={
          <BrandButton
            variant="secondary"
            size="sm"
            onClick={fetchData}
            disabled={refreshing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing" : "Refresh"}
          </BrandButton>
        }
      />

      {error && (
        <BrandCard variant="danger" className="mb-6">
          <p className="text-sm font-semibold text-red-600">{error}</p>
        </BrandCard>
      )}

      {!data && !error ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Students" value="" loading />
          <StatCard label="New This Week" value="" loading />
          <StatCard label="Courses Published" value="" loading />
          <StatCard label="Avg Quiz Score" value="" loading />
        </div>
      ) : data ? (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Total Students"
              value={data.stats.totalStudents}
              icon={<Users className="h-5 w-5" />}
            />
            <StatCard
              label="New This Week"
              value={data.stats.studentsThisWeek}
              color="#22C55E"
              icon={<TrendingUp className="h-5 w-5" />}
            />
            <StatCard
              label="Courses Published"
              value={data.stats.publishedCourses}
              color="#8B5CF6"
              icon={<BookOpen className="h-5 w-5" />}
            />
            <StatCard
              label="Avg Quiz Score"
              value={`${data.stats.avgQuizScore}%`}
              sub={`${data.stats.totalQuizAttempts} attempts`}
              color={
                data.stats.avgQuizScore >= 70 ? "#22C55E" :
                data.stats.avgQuizScore >= 50 ? "#F97B2F" : "#EF4444"
              }
              icon={<Target className="h-5 w-5" />}
            />
          </div>

          {/* Expertise + Bloom side-by-side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <BrandCard>
              <SectionTitle
                title="Expertise distribution"
                description="Inferred from behavioral signals (not self-reported)."
              />
              {data.expertiseDistribution.every((e) => e.count === 0) ? (
                <p className="text-xs text-aristo-brown/50">No learner profiles yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.expertiseDistribution.map(({ level, count, pct }) => {
                    const meta = EXPERTISE_META[level] ?? { label: level, color: "#8B6E5A" };
                    return (
                      <BarRow
                        key={level}
                        label={meta.label}
                        pct={pct}
                        count={count}
                        color={meta.color}
                      />
                    );
                  })}
                </div>
              )}
            </BrandCard>

            <BrandCard>
              <SectionTitle
                title="Bloom level performance"
                description="Accuracy by cognitive level across recent quiz attempts."
              />
              {data.bloomPerformance.length === 0 ? (
                <p className="text-xs text-aristo-brown/50">No quiz data yet.</p>
              ) : (
                <div className="space-y-3">
                  {[...data.bloomPerformance]
                    .sort((a, b) => BLOOM_ORDER.indexOf(a.bloom) - BLOOM_ORDER.indexOf(b.bloom))
                    .map(({ bloom, accuracy, count }) => {
                      const color =
                        accuracy >= 70 ? "#22C55E" :
                        accuracy >= 50 ? "#F97B2F" : "#EF4444";
                      return (
                        <BarRow
                          key={bloom}
                          label={bloom[0].toUpperCase() + bloom.slice(1)}
                          pct={accuracy}
                          count={count}
                          color={color}
                        />
                      );
                    })}
                </div>
              )}
            </BrandCard>
          </div>

          {/* Struggling topics */}
          <BrandCard className="mb-6">
            <SectionTitle
              title="Struggling topics"
              description="Lowest accuracy among concepts with ≥2 attempts. Investigate the lesson quality or prerequisite chain."
            />
            {data.strugglingTopics.length === 0 ? (
              <p className="text-xs text-aristo-brown/50">
                Not enough data yet — needs at least 2 attempts per topic.
              </p>
            ) : (
              <div className="divide-y divide-white/60">
                {data.strugglingTopics.map(({ topic, avgScore, attempts }) => {
                  const variant =
                    avgScore >= 70 ? "green" :
                    avgScore >= 50 ? "orange" : "red";
                  return (
                    <div key={topic} className="flex items-center justify-between py-2">
                      <span className="text-xs font-medium text-aristo-brown truncate pr-3 flex-1">
                        {topic}
                      </span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-aristo-brown/50">{attempts}×</span>
                        <BrandBadge variant={variant} size="md">
                          {avgScore}%
                        </BrandBadge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </BrandCard>

          {/* Recent attempts */}
          {data.recentAttempts.length > 0 && (
            <BrandCard padding="none">
              <div className="px-5 pt-5">
                <SectionTitle
                  title="Recent quiz attempts"
                  description="Last 10 graded responses across all learners."
                />
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Topic</TableHead>
                    <TableHead>Bloom</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentAttempts.map((a, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-aristo-brown max-w-[260px] truncate">
                        {a.topic}
                      </TableCell>
                      <TableCell>
                        <BrandBadge variant={BLOOM_COLOR[a.bloom] ?? "neutral"}>
                          {a.bloom}
                        </BrandBadge>
                      </TableCell>
                      <TableCell>
                        <BrandBadge variant={a.is_correct ? "green" : "red"} size="md">
                          {a.is_correct ? "✓ correct" : "✗ wrong"}
                        </BrandBadge>
                      </TableCell>
                      <TableCell className="text-xs text-aristo-brown/60">
                        {new Date(a.at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </BrandCard>
          )}
        </>
      ) : null}
    </>
  );
}

// ─── BarRow (internal) ────────────────────────────────────────────────────────

function BarRow({
  label,
  pct,
  count,
  color,
}: {
  label: string;
  pct:   number;
  count: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-32 text-xs font-semibold text-aristo-brown truncate">
        {label}
      </div>
      <div className="flex-1 bg-white/60 rounded-full h-2.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}
        />
      </div>
      <div className="w-16 text-right text-xs text-aristo-brown/60 tabular-nums">
        {pct}% ({count})
      </div>
    </div>
  );
}
