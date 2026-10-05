"use client";

/**
 * CourseMapView — spec §11.1
 *
 * Full-screen overlay showing the course structure as a visual map.
 * Modules are shown as sections; each concept inside a lesson shows its
 * mastery tier as an icon and a word (`mastery.tsx`, thresholds in
 * `getMasteryTier`): Not started, In progress, Learned, Mastered. The
 * current concept has an accent border and a "Now" pill.
 *
 * Clicking an available concept calls onSelectConcept(flatIndex).
 * "Start / Continue" button advances to the next un-mastered concept.
 *
 * On the design system since V8.6: it follows the theme. The system scrim
 * over the room and a surface dialog, as the mode picker.
 */

import { useEffect, useState, useCallback } from "react";
import { ArrowRight, CircleAlert, Inbox, X } from "lucide-react";
import type { CourseStructure }             from "@/store/useAristoStore";
import { Button }                           from "@/components/ui/button";
import { MASTERY_ORDER, MASTERY_TIER, MasteryBadge, MasteryIcon } from "@/components/learn/mastery";
import { FOCUS, PRESS, SHAPE }              from "@/lib/design/shape";
import { cn }                               from "@/lib/utils";

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

// ─── Pieces ───────────────────────────────────────────────────────────────────

function StateIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full border border-tint-line bg-tint text-accent-text [&_svg]:size-6">
      {children}
    </span>
  );
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
  const score     = masteryMap[conceptId] ?? 0;
  const meta      = conceptMeta[conceptId];
  const isCurrent = flatIndex === currentFlatIndex;

  return (
    <button
      onClick={() => onSelect(flatIndex)}
      aria-current={isCurrent ? "step" : undefined}
      className={cn(
        SHAPE.control,
        FOCUS,
        PRESS,
        "flex min-h-11 w-full flex-col items-start gap-0.5 border px-3 py-2 text-left duration-fast",
        isCurrent
          ? "border-accent bg-tint"
          : "border-line bg-surface hover:border-muted/50 hover:bg-sunk",
      )}
    >
      <div className="flex w-full items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
          {meta?.name ?? conceptId}
        </span>
        {isCurrent && (
          <span className={cn(SHAPE.pill, "shrink-0 bg-accent px-2 py-0.5 text-xs font-semibold text-accent-ink")}>
            Now
          </span>
        )}
      </div>
      <MasteryBadge score={score} />
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
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <section
        aria-labelledby="course-map-title"
        className={cn(SHAPE.surface, "flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden border border-line bg-surface shadow-e2")}
      >

        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-line px-6 pb-4 pt-5">
          <div className="min-w-0 flex-1">
            <h2 id="course-map-title" className="type-h3 line-clamp-2 font-bold text-ink">
              {data?.course.title ?? "Course Map"}
            </h2>
            {data?.course.description && (
              <p className="mt-0.5 line-clamp-2 text-sm leading-relaxed text-body">
                {data.course.description}
              </p>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="-mr-2 shrink-0 rounded-full">
            <X aria-hidden />
          </Button>
        </div>

        {/* Progress summary */}
        {data && (
          <div className="border-b border-line px-6 py-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-ink">
                {masteredCount} / {totalConcepts} concepts learned
              </span>
              <span className="text-xs text-muted">
                about {data.course.estimated_hours} h
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-sunk">
              <div
                className="h-full rounded-full bg-accent transition-all duration-slow motion-reduce:transition-none"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Legend */}
        <ul aria-label="Mastery" className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-6 py-2">
          {MASTERY_ORDER.map((tier) => (
            <li key={tier} className="flex items-center gap-1.5">
              <MasteryIcon tier={tier} className="size-3.5" />
              <span className="text-xs font-medium text-muted">{MASTERY_TIER[tier].label}</span>
            </li>
          ))}
        </ul>

        {/* Module list */}
        <div className="aristo-scroll flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {loading && (
            <div role="status" className="flex items-center justify-center py-12">
              <span className="sr-only">Loading the course</span>
              <div className="flex gap-1" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-1.5 rounded-full bg-accent motion-safe:animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          {fetchError && (
            <div role="alert" className="py-10 text-center">
              <StateIcon><CircleAlert aria-hidden /></StateIcon>
              <p className="mb-1 text-sm font-semibold text-ink">Course unavailable</p>
              <p className="text-sm text-body">Could not load course data. Please go back and try again.</p>
            </div>
          )}

          {!loading && !fetchError && modules.length === 0 && (
            <div className="py-10 text-center">
              <StateIcon><Inbox aria-hidden /></StateIcon>
              <p className="mb-1 text-sm font-semibold text-ink">No concepts in this course</p>
              <p className="text-sm text-body">The knowledge graph for this domain hasn&apos;t been seeded yet. Ask an admin to add concepts.</p>
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
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-ink">{mod.title}</h3>
                      {mod.description && (
                        <p className="text-xs leading-snug text-muted">
                          {mod.description}
                        </p>
                      )}
                    </div>
                    <span className="ml-2 shrink-0 text-xs tabular-nums text-muted">
                      {modMastered}/{modConceptIds.length} · {modPct}%
                    </span>
                  </div>

                  {/* Lessons */}
                  <div className="space-y-3 border-l-2 border-line pl-3">
                    {mod.lessons.map((lesson) => (
                      <div key={lesson.id}>
                        <p className="mb-1.5 ml-1 text-xs font-semibold text-muted">
                          {lesson.title}
                        </p>
                        <div className="space-y-1.5">
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
        <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
          <Button variant="ghost" onClick={onClose} className="-ml-3">
            Back
          </Button>
          <Button onClick={handleContinue} disabled={loading || !data}>
            {masteredCount === 0 ? "Start learning" : "Continue"}
            <ArrowRight aria-hidden />
          </Button>
        </div>
      </section>
    </div>
  );
}
