"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link                          from "next/link";
import {
  ArrowLeft, RefreshCw, Users, Target, CheckCircle2, Loader2,
} from "lucide-react";
import {
  BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell,
} from "recharts";
import { PageHeader }        from "@/components/admin/PageHeader";
import { BrandCard }         from "@/components/admin/ui/BrandCard";
import { BrandButton }       from "@/components/admin/ui/BrandButton";
import { BrandBadge }        from "@/components/admin/ui/BrandBadge";
import { StatCard }          from "@/components/admin/ui/StatCard";
import { SectionTitle }      from "@/components/admin/ui/SectionTitle";

interface Analytics {
  course: {
    id:           string;
    domain:       string;
    title:        string;
    is_published: boolean;
    created_at:   string;
  };
  enrolled:      number;
  status_counts: { in_progress: number; completed: number; paused: number };
  completion_pct: number;
  moduleDropoff: { module_id: string; module_title: string; stalled: number }[];
  masteryDistribution: { bucket: string; min: number; max: number; count: number }[];
  conceptStats:  { concept_id: string; avg_mastery: number; learner_count: number }[];
}

export default function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = use(params);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(
      `/api/admin/courses/${encodeURIComponent(courseId)}/analytics`,
      { cache: "no-store" }
    );
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageHeader
        title={data?.course.title ?? "Course"}
        subtitle={
          <>
            <span className="font-mono text-[11px]">{courseId}</span>
            {data?.course.domain && (
              <span className="ml-2">· domain <span className="font-mono">{data.course.domain}</span></span>
            )}
          </>
        }
        badge={data && (
          <BrandBadge variant={data.course.is_published ? "green" : "amber"} size="md">
            {data.course.is_published ? "Published" : "Draft"}
          </BrandBadge>
        )}
        actions={
          <>
            <Link href="/admin/courses">
              <BrandButton variant="ghost" size="sm">
                <ArrowLeft className="h-3.5 w-3.5" />
                Courses
              </BrandButton>
            </Link>
            <BrandButton variant="secondary" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </BrandButton>
          </>
        }
      />

      {!data ? (
        <BrandCard>
          <p className="text-xs text-aristo-brown/60 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading analytics…
          </p>
        </BrandCard>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Enrolled"
              value={data.enrolled}
              icon={<Users className="h-5 w-5" />}
            />
            <StatCard
              label="In progress"
              value={data.status_counts.in_progress}
              color="#3B82F6"
            />
            <StatCard
              label="Completed"
              value={data.status_counts.completed}
              color="#22C55E"
              icon={<CheckCircle2 className="h-5 w-5" />}
            />
            <StatCard
              label="Completion %"
              value={`${data.completion_pct}%`}
              color={
                data.completion_pct >= 70 ? "#22C55E" :
                data.completion_pct >= 40 ? "#F97B2F" : "#EF4444"
              }
              icon={<Target className="h-5 w-5" />}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <BrandCard>
              <SectionTitle
                title="Module dropoff"
                description="Learners currently stalled at each module (status ≠ completed)."
              />
              {data.moduleDropoff.length === 0 ? (
                <p className="text-xs text-aristo-brown/50">No module data.</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.moduleDropoff} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#FBA962" strokeOpacity={0.2} />
                    <XAxis
                      dataKey="module_title"
                      tick={{ fontSize: 10, fill: "#3D2110" }}
                      angle={-30}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 11, fill: "#3D2110" }} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(253, 248, 239, 0.95)",
                        border: "1px solid rgba(248, 123, 47, 0.3)",
                        borderRadius: 12,
                      }}
                    />
                    <Bar dataKey="stalled" fill="#F97B2F" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </BrandCard>

            <BrandCard>
              <SectionTitle
                title="Mastery distribution"
                description="Histogram of mastery_score across the course's concepts (all enrolled learners)."
              />
              {data.masteryDistribution.every((b) => b.count === 0) ? (
                <p className="text-xs text-aristo-brown/50">No mastery data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.masteryDistribution} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#FBA962" strokeOpacity={0.2} />
                    <XAxis
                      dataKey="bucket"
                      tick={{ fontSize: 10, fill: "#3D2110" }}
                    />
                    <YAxis tick={{ fontSize: 11, fill: "#3D2110" }} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(253, 248, 239, 0.95)",
                        border: "1px solid rgba(248, 123, 47, 0.3)",
                        borderRadius: 12,
                      }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {data.masteryDistribution.map((b, i) => {
                        const color =
                          b.min >= 0.8 ? "#22C55E" :
                          b.min >= 0.5 ? "#F97B2F" :
                                         "#EF4444";
                        return <Cell key={i} fill={color} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </BrandCard>
          </div>

          <BrandCard>
            <SectionTitle
              title="Weakest concepts"
              description="Course-concepts with the lowest average mastery. Candidates for lesson review."
            />
            {data.conceptStats.length === 0 ? (
              <p className="text-xs text-aristo-brown/50">No assessed concepts yet.</p>
            ) : (
              <div className="divide-y divide-white/60">
                {data.conceptStats.slice(0, 10).map((c) => (
                  <div key={c.concept_id} className="flex items-center justify-between py-2 gap-3">
                    <span className="font-mono text-[11px] text-aristo-brown/60 truncate flex-1">
                      {c.concept_id}
                    </span>
                    <span className="text-xs text-aristo-brown/50 tabular-nums w-16 text-right">
                      n={c.learner_count}
                    </span>
                    <div className="w-40 bg-white/60 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${c.avg_mastery}%`,
                          background:
                            c.avg_mastery >= 80 ? "#22C55E" :
                            c.avg_mastery >= 50 ? "#F97B2F" : "#EF4444",
                        }}
                      />
                    </div>
                    <span className="text-xs text-aristo-brown/70 tabular-nums w-10 text-right">
                      {c.avg_mastery}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </BrandCard>
        </>
      )}
    </>
  );
}
