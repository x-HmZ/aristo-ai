"use client";

/**
 * The learner's progress dialog (Phase 9): streak, time, mastery, reviews due,
 * the inferred profile and the concepts that need practice.
 *
 * On the design system since V8.6: it follows the theme. The system scrim over
 * the room and a surface dialog. Numbers are ink with an accent icon each; a
 * hue never carries a meaning alone (strongest and needs work have their words
 * and icons; a weak concept's bar has its percentage).
 */

import { useEffect, useState } from "react";
import { Clock, Flame, GraduationCap, RotateCcw, Target, TrendingUp, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SHAPE } from "@/lib/design/shape";
import { cn } from "@/lib/utils";

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

const BLOCK = cn(SHAPE.surface, "space-y-3 border border-line bg-bg px-5 py-4");
const BLOCK_TITLE = "text-xs font-semibold text-muted";

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatTile({ label, value, Icon }: { label: string; value: string | number; Icon: LucideIcon }) {
  return (
    <div className={cn(SHAPE.surface, "flex min-w-0 flex-col items-center border border-line bg-bg px-3 py-4")}>
      <Icon aria-hidden className="mb-1.5 size-5 text-accent-text" />
      <div className="type-h3 font-bold tabular-nums text-ink">{value}</div>
      <div className="mt-0.5 text-center text-xs leading-tight text-muted">{label}</div>
    </div>
  );
}

function MasteryBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  return (
    <div className="flex w-28 shrink-0 items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunk">
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(pct, 3)}%` }} />
      </div>
      <span className="w-9 text-right text-xs font-semibold tabular-nums text-ink">{pct}%</span>
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
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <section
        aria-labelledby="dashboard-title"
        className={cn(SHAPE.surface, "aristo-scroll max-h-[85vh] w-full max-w-lg overflow-y-auto border border-line bg-surface shadow-e2")}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 pb-4 pt-6">
          <div>
            <h2 id="dashboard-title" className="type-h3 font-bold text-ink">Your Progress</h2>
            <p className="mt-0.5 text-sm text-body">How you&apos;re doing across all topics</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 shrink-0 rounded-full">
            <X aria-hidden />
          </Button>
        </div>

        {loading ? (
          <div role="status" className="flex h-48 items-center justify-center text-sm text-muted">
            Loading…
          </div>
        ) : !analytics ? (
          <div role="alert" className="flex h-48 items-center justify-center text-sm text-muted">
            Failed to load analytics.
          </div>
        ) : (
          <div className="space-y-5 px-6 pb-6">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <StatTile
                label="Day streak"
                value={analytics.streak === 0 ? "—" : String(analytics.streak)}
                Icon={Flame}
              />
              <StatTile
                label="This week"
                value={
                  analytics.time_week_seconds < 60
                    ? "—"
                    : fmtMinutes(analytics.time_week_seconds)
                }
                Icon={Clock}
              />
              <StatTile
                label="Mastered"
                value={`${analytics.total_mastered}/${analytics.total_concepts_seen}`}
                Icon={GraduationCap}
              />
              <StatTile
                label="Reviews due"
                value={analytics.reviews_due || "—"}
                Icon={RotateCcw}
              />
            </div>

            {/* Learner profile */}
            {analytics.learner_profile && (
              <div className={BLOCK}>
                <h3 className={BLOCK_TITLE}>Your learning profile</h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    { tag: "Level", label: analytics.learner_profile.expertise_level   },
                    { tag: "Pace",  label: analytics.learner_profile.pace              },
                    { tag: "Depth", label: analytics.learner_profile.explanation_depth },
                  ].map(({ tag, label }) => (
                    <div
                      key={tag}
                      className={cn(SHAPE.pill, "flex items-center gap-1.5 border border-line bg-sunk px-3 py-1")}
                    >
                      <span className="text-xs font-medium text-muted">{tag}</span>
                      <span className="text-xs font-semibold capitalize text-ink">{label}</span>
                    </div>
                  ))}
                </div>

                {(analytics.learner_profile.strongest_bloom_level ||
                  analytics.learner_profile.weakest_bloom_level) && (
                  <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                    {analytics.learner_profile.strongest_bloom_level && (
                      <span className="flex items-center gap-1.5">
                        <TrendingUp aria-hidden className="size-4 text-success" />
                        <span className="text-body">Strongest:</span>
                        <span className="font-semibold capitalize text-ink">
                          {analytics.learner_profile.strongest_bloom_level}
                        </span>
                      </span>
                    )}
                    {analytics.learner_profile.weakest_bloom_level && (
                      <span className="flex items-center gap-1.5">
                        <Target aria-hidden className="size-4 text-warning" />
                        <span className="text-body">Needs work:</span>
                        <span className="font-semibold capitalize text-ink">
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
              <div className={BLOCK}>
                <h3 className={BLOCK_TITLE}>Needs more practice</h3>
                <ul className="space-y-3">
                  {analytics.weak_concepts.map((c) => (
                    <li key={c.concept_id} className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{c.name}</p>
                        {c.domain && (
                          <p className="text-xs capitalize text-muted">
                            {c.domain.replace(/_/g, " ")}
                          </p>
                        )}
                      </div>
                      <MasteryBar score={c.mastery_score} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Empty state */}
            {analytics.total_concepts_seen === 0 && (
              <p className="py-6 text-center text-sm text-body">
                Complete your first lesson to see progress here.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
