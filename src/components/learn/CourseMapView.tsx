"use client";

/**
 * CourseMapView — spec §11.1
 *
 * Full-screen overlay showing the course structure as a visual map.
 * Modules are shown as sections; concepts inside each lesson are shown
 * as colour-coded nodes:
 *
 *   mastered (≥0.9)   → green
 *   learned  (≥0.7)   → teal
 *   in_progress (≥0.3)→ yellow
 *   not_learned (<0.3) → grey
 *   current           → orange ring
 *
 * Clicking an available concept calls onSelectConcept(flatIndex).
 * "Start / Continue" button advances to the next un-mastered concept.
 */

import { useEffect, useState, useCallback } from "react";
import type { CourseStructure }             from "@/store/useAristoStore";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CourseMapData {
  course: {
    id:             string;
    title:          string;
    description:    string;
    structure:      CourseStructure;
    estimated_hours: number;
  };
  masteryMap:  Record<string, number>;
  conceptMeta: Record<string, { name: string; difficulty: number }>;
}

interface Props {
  courseId:          string;
  currentTopicIndex: number;
  onSelectConcept:   (flatIndex: number) => void;
  onClose:           () => void;
}

// ─── Mastery helpers ──────────────────────────────────────────────────────────

function masteryColor(score: number): string {
  if (score >= 0.9) return "#10B981"; // mastered  — green
  if (score >= 0.7) return "#06B6D4"; // learned   — teal
  if (score >= 0.3) return "#F59E0B"; // in_progress — amber
  return "#D1D5DB";                   // not_learned — grey
}

function masteryLabel(score: number): string {
  if (score >= 0.9) return "Mastered";
  if (score >= 0.7) return "Learned";
  if (score >= 0.3) return "In Progress";
  return "Not started";
}

// ─── Concept node ─────────────────────────────────────────────────────────────

function ConceptNode({
  conceptId,
  flatIndex,
  currentFlatIndex,
  masteryMap,
  conceptMeta,
  onSelect,
}: {
  conceptId:        string;
  flatIndex:        number;
  currentFlatIndex: number;
  masteryMap:       Record<string, number>;
  conceptMeta:      Record<string, { name: string; difficulty: number }>;
  onSelect:         (idx: number) => void;
}) {
  const score    = masteryMap[conceptId] ?? 0;
  const meta     = conceptMeta[conceptId];
  const isCurrent = flatIndex === currentFlatIndex;
  const color    = masteryColor(score);

  return (
    <button
      onClick={() => onSelect(flatIndex)}
      title={meta?.name ?? conceptId}
      className={`group relative flex flex-col items-start gap-1 px-3 py-2 rounded-xl border transition-all duration-200 text-left w-full ${
        isCurrent
          ? "border-[#F97B2F] bg-[#FFF0E4] shadow-[0_0_0_2px_rgba(249,123,47,0.3)]"
          : "border-white/60 bg-white/60 hover:border-[#F97B2F]/40 hover:bg-[#FFF8F4]"
      }`}
    >
      <div className="flex items-center gap-2 w-full">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-[11px] font-semibold text-[#3D2110] truncate flex-1">
          {meta?.name ?? conceptId}
        </span>
        {isCurrent && (
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#F97B2F] shrink-0">
            Now
          </span>
        )}
      </div>
      <span className="text-[9px] text-[#8B6E5A]" style={{ color }}>
        {masteryLabel(score)}
      </span>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CourseMapView({
  courseId,
  currentTopicIndex,
  onSelectConcept,
  onClose,
}: Props) {
  const [data,       setData]       = useState<CourseMapData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    fetch(`/api/courses/${courseId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error || !json.course) { setFetchError(true); return; }
        setData(json);
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, [courseId]);

  const modules = data?.course?.structure?.modules ?? [];

  // Build a flat index → conceptId map for selection
  const flatList: string[] = modules.flatMap((m) =>
    m.lessons.flatMap((l) => l.concept_ids)
  );

  const totalConcepts  = flatList.length;
  const masteredCount  = data
    ? flatList.filter((id) => (data.masteryMap[id] ?? 0) >= 0.7).length
    : 0;
  const progressPct    = totalConcepts > 0 ? (masteredCount / totalConcepts) * 100 : 0;

  // Find first un-mastered concept for the "Continue" button
  const nextIdx = data
    ? flatList.findIndex((id) => (data.masteryMap[id] ?? 0) < 0.7)
    : 0;
  const startIdx = nextIdx >= 0 ? nextIdx : 0;

  const handleContinue = useCallback(() => {
    onSelectConcept(startIdx);
  }, [onSelectConcept, startIdx]);

  return (
    <div className="absolute inset-0 z-40 flex items-stretch bg-black/25 backdrop-blur-sm">
      <div className="m-auto bg-white/90 backdrop-blur-2xl border border-white/60 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.2)] w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-white/60 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[#F97B2F] font-bold">✦</span>
              <h2 className="text-base font-bold text-[#3D2110] truncate">
                {data?.course.title ?? "Course Map"}
              </h2>
            </div>
            {data?.course.description && (
              <p className="text-xs text-[#8B6E5A] leading-relaxed line-clamp-2">
                {data.course.description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-[#8B6E5A] hover:text-[#3D2110] text-lg font-medium"
          >
            ✕
          </button>
        </div>

        {/* Progress summary */}
        {data && (
          <div className="px-6 py-3 border-b border-white/60">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-[#3D2110]">
                {masteredCount} / {totalConcepts} concepts learned
              </span>
              <span className="text-[11px] text-[#8B6E5A]">
                ~{data.course.estimated_hours}h
              </span>
            </div>
            <div className="h-1.5 bg-white/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#F97B2F] rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="px-6 py-2 border-b border-white/40 flex items-center gap-4 flex-wrap">
          {[
            { color: "#10B981", label: "Mastered" },
            { color: "#06B6D4", label: "Learned" },
            { color: "#F59E0B", label: "In progress" },
            { color: "#D1D5DB", label: "Not started" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[9px] text-[#8B6E5A] font-medium">{label}</span>
            </div>
          ))}
        </div>

        {/* Module list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-[#F97B2F] animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          {fetchError && (
            <div className="text-center py-10">
              <div className="text-3xl mb-2">⚠️</div>
              <p className="text-sm font-semibold text-[#3D2110] mb-1">Course unavailable</p>
              <p className="text-xs text-[#8B6E5A]">Could not load course data. Please go back and try again.</p>
            </div>
          )}

          {!loading && !fetchError && modules.length === 0 && (
            <div className="text-center py-10">
              <div className="text-3xl mb-2">📭</div>
              <p className="text-sm font-semibold text-[#3D2110] mb-1">No concepts in this course</p>
              <p className="text-xs text-[#8B6E5A]">The knowledge graph for this domain hasn&apos;t been seeded yet. Ask an admin to add concepts.</p>
            </div>
          )}

          {data && modules.length > 0 && (() => {
            let flatIdx = 0;
            return modules.map((mod) => {
              const modConceptIds = mod.lessons.flatMap((l) => l.concept_ids);
              const modMastered   = modConceptIds.filter(
                (id) => (data.masteryMap[id] ?? 0) >= 0.7
              ).length;
              const modPct = modConceptIds.length > 0
                ? Math.round((modMastered / modConceptIds.length) * 100)
                : 0;

              return (
                <div key={mod.id}>
                  {/* Module header */}
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-xs font-bold text-[#3D2110]">{mod.title}</h3>
                      {mod.description && (
                        <p className="text-[10px] text-[#8B6E5A] leading-tight">
                          {mod.description}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-[#8B6E5A] tabular-nums shrink-0 ml-2">
                      {modMastered}/{modConceptIds.length} · {modPct}%
                    </span>
                  </div>

                  {/* Lessons */}
                  <div className="space-y-3 pl-3 border-l-2 border-white/50">
                    {mod.lessons.map((lesson) => (
                      <div key={lesson.id}>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-[#B8A99A] mb-1.5 ml-1">
                          {lesson.title}
                        </p>
                        <div className="space-y-1">
                          {lesson.concept_ids.map((cid) => {
                            const idx = flatIdx++;
                            return (
                              <ConceptNode
                                key={cid}
                                conceptId={cid}
                                flatIndex={idx}
                                currentFlatIndex={currentTopicIndex}
                                masteryMap={data.masteryMap}
                                conceptMeta={data.conceptMeta}
                                onSelect={onSelectConcept}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            });
          })()}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/60 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="text-sm text-[#8B6E5A] hover:text-[#3D2110] font-medium"
          >
            Back
          </button>
          <button
            onClick={handleContinue}
            disabled={loading || !data}
            className="px-6 py-2.5 rounded-2xl text-sm font-semibold bg-[#F97B2F] text-white hover:bg-[#E06A20] shadow-[0_4px_16px_rgba(249,123,47,0.35)] disabled:opacity-50 transition-all"
          >
            {masteredCount === 0 ? "Start Learning →" : "Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}
