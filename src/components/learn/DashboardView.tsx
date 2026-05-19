"use client";

import { useEffect, useState } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface WeakConcept {
  concept_id:    string;
  name:          string;
  domain:        string;
  mastery_score: number;
}

interface LearnerProfile {
  expertise_level:       string;
  pace:                  string;
  explanation_depth:     string;
  weakest_bloom_level:   string | null;
  strongest_bloom_level: string | null;
}

interface Analytics {
  streak:              number;
  time_today_seconds:  number;
  time_week_seconds:   number;
  total_concepts_seen: number;
  total_mastered:      number;
  reviews_due:         number;
  weak_concepts:       WeakConcept[];
  learner_profile:     LearnerProfile | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtMinutes(seconds: number): string {
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  color = "#F97B2F",
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="flex flex-col items-center bg-white/60 rounded-2xl px-4 py-4 border border-white/50 flex-1 min-w-0">
      <div className="text-2xl font-bold tabular-nums" style={{ color }}>
        {value}
      </div>
      <div className="text-[11px] text-[#8B6E5A] mt-0.5 text-center leading-tight">
        {label}
      </div>
    </div>
  );
}

function MasteryBar({ score }: { score: number }) {
  const pct   = Math.round(score * 100);
  const color =
    pct >= 80 ? "#22C55E" :
    pct >= 50 ? "#F97B2F" : "#EF4444";
  return (
    <div className="flex items-center gap-2 w-28 flex-shrink-0">
      <div className="flex-1 bg-white/40 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs tabular-nums font-semibold w-8 text-right" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface DashboardViewProps {
  onClose: () => void;
}

export function DashboardView({ onClose }: DashboardViewProps) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    fetch("/api/profile/analytics")
      .then((r) => r.json())
      .then((d) => setAnalytics(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-white/85 backdrop-blur-2xl border border-white/60 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] overflow-y-auto max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="text-lg font-bold text-[#3D2110]">Your Progress</h2>
            <p className="text-xs text-[#8B6E5A]">How you're doing across all topics</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/70 text-[#8B6E5A] hover:text-[#3D2110] hover:bg-white transition-all text-sm font-bold"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48 text-[#8B6E5A] text-sm">
            Loading…
          </div>
        ) : !analytics ? (
          <div className="flex items-center justify-center h-48 text-[#8B6E5A] text-sm">
            Failed to load analytics.
          </div>
        ) : (
          <div className="px-6 pb-6 space-y-5">
            {/* Stat pills */}
            <div className="flex gap-2.5">
              <StatPill
                label="Day streak"
                value={analytics.streak === 0 ? "—" : String(analytics.streak)}
                color="#F97B2F"
              />
              <StatPill
                label="This week"
                value={
                  analytics.time_week_seconds < 60
                    ? "—"
                    : fmtMinutes(analytics.time_week_seconds)
                }
                color="#8B5CF6"
              />
              <StatPill
                label="Mastered"
                value={`${analytics.total_mastered}/${analytics.total_concepts_seen}`}
                color="#22C55E"
              />
              <StatPill
                label="Reviews due"
                value={analytics.reviews_due || "—"}
                color={analytics.reviews_due > 0 ? "#EF4444" : "#8B6E5A"}
              />
            </div>

            {/* Learner profile badges */}
            {analytics.learner_profile && (
              <div className="bg-white/60 rounded-2xl border border-white/50 px-5 py-4 space-y-3">
                <h3 className="text-xs font-semibold text-[#8B6E5A] uppercase tracking-wider">
                  Your Learning Profile
                </h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    { tag: "Level", label: analytics.learner_profile.expertise_level   },
                    { tag: "Pace",  label: analytics.learner_profile.pace              },
                    { tag: "Depth", label: analytics.learner_profile.explanation_depth },
                  ].map(({ tag, label }) => (
                    <div
                      key={tag}
                      className="flex items-center gap-1.5 bg-[#FFF0E4] border border-[#F97B2F]/20 rounded-full px-3 py-1"
                    >
                      <span className="text-[10px] text-[#B8A99A] font-medium uppercase tracking-wide">
                        {tag}
                      </span>
                      <span className="text-xs font-semibold text-[#C45A10] capitalize">
                        {label}
                      </span>
                    </div>
                  ))}
                </div>

                {(analytics.learner_profile.strongest_bloom_level ||
                  analytics.learner_profile.weakest_bloom_level) && (
                  <div className="flex gap-5 text-xs">
                    {analytics.learner_profile.strongest_bloom_level && (
                      <span>
                        <span className="text-[#8B6E5A]">Strongest: </span>
                        <span className="font-semibold text-[#16A34A] capitalize">
                          {analytics.learner_profile.strongest_bloom_level}
                        </span>
                      </span>
                    )}
                    {analytics.learner_profile.weakest_bloom_level && (
                      <span>
                        <span className="text-[#8B6E5A]">Needs work: </span>
                        <span className="font-semibold text-[#DC2626] capitalize">
                          {analytics.learner_profile.weakest_bloom_level}
                        </span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Weak concepts */}
            {analytics.weak_concepts.length > 0 && (
              <div className="bg-white/60 rounded-2xl border border-white/50 px-5 py-4 space-y-3">
                <h3 className="text-xs font-semibold text-[#8B6E5A] uppercase tracking-wider">
                  Needs More Practice
                </h3>
                <div className="space-y-2.5">
                  {analytics.weak_concepts.map((c) => (
                    <div key={c.concept_id} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#3D2110] truncate">{c.name}</p>
                        {c.domain && (
                          <p className="text-[10px] text-[#B8A99A]">
                            {c.domain.replace(/_/g, " ")}
                          </p>
                        )}
                      </div>
                      <MasteryBar score={c.mastery_score} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {analytics.total_concepts_seen === 0 && (
              <div className="text-center py-6 text-[#8B6E5A] text-sm">
                Complete your first lesson to see progress here.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
