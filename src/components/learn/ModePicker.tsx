"use client";

import { useEffect, useState, useCallback } from "react";
import { BookOpen, ChevronRight, CircleAlert, Compass, LoaderCircle, Route } from "lucide-react";
import { useAristoStore, type CourseStructure } from "@/store/useAristoStore";
import { FOCUS, PRESS, SHAPE } from "@/lib/design/shape";
import { cn } from "@/lib/utils";
import { useModalDialog } from "@/hooks/useModalDialog";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PublishedCourse {
  id:              string;
  domain:          string;
  title:           string;
  description:     string | null;
  structure:       CourseStructure;
  estimated_hours: number | null;
}

interface ModePickerProps {
  onExplore:     () => void;
  onStartCourse: (course: PublishedCourse) => void;
}

// A choice in the picker: a surface card with a line border, a sunk hover and
// the system focus ring. The picker is a dialog over the room, on the tokens
// (V8.4c): it follows the theme.
const OPTION = cn(
  SHAPE.surface,
  FOCUS,
  PRESS,
  "group w-full border border-line bg-surface p-4 text-left duration-fast hover:border-muted/50 hover:bg-sunk disabled:pointer-events-none disabled:opacity-60",
);

function OptionIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-tint-line bg-tint text-accent-text [&_svg]:size-5">
      {children}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ModePicker({ onExplore, onStartCourse }: ModePickerProps) {
  const [courses,      setCourses]      = useState<PublishedCourse[] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError,     setGenError]     = useState<string | null>(null);
  // A dialog that must be answered: no Escape, but focus stays inside it.
  const dialog = useModalDialog<HTMLElement>();

  // Read the user's stored domain from course progress (set during onboarding)
  const course = useAristoStore((s) => s.course);
  const domain = course.domain || "python_programming";

  useEffect(() => {
    fetch("/api/courses")
      .then((r) => r.json())
      .then((d) => setCourses(d.courses ?? []))
      .catch(() => setCourses([]));
  }, []);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/courses/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ domain }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const { course: generated } = await res.json();
      onStartCourse(generated);
    } catch {
      setGenError("The course could not be built. Try again.");
    } finally {
      setIsGenerating(false);
    }
  }, [domain, onStartCourse]);

  // Count total concepts in a course
  function conceptCount(c: PublishedCourse): number {
    return (c.structure?.modules ?? []).reduce(
      (acc, m) => acc + m.lessons.reduce((a, l) => a + l.concept_ids.length, 0),
      0
    );
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <section
        {...dialog}
        aria-labelledby="mode-picker-title"
        className={cn(SHAPE.surface, "flex max-h-[80vh] outline-none w-full max-w-md flex-col overflow-hidden border border-line bg-surface shadow-e2")}
      >

        {/* Header */}
        <div className="border-b border-line px-6 pb-4 pt-6">
          <h2 id="mode-picker-title" className="type-h3 font-bold text-ink">
            What Would You Like to Do?
          </h2>
          <p className="mt-1 text-sm text-body">
            Follow a course, or ask about any topic.
          </p>
        </div>

        {/* Body */}
        <div className="aristo-scroll flex-1 space-y-3 overflow-y-auto px-5 py-4">

          {/* Free explore */}
          <button onClick={onExplore} className={OPTION}>
            <div className="flex items-start gap-3">
              <OptionIcon><Compass aria-hidden /></OptionIcon>
              <div>
                <div className="text-sm font-bold text-ink">Explore freely</div>
                <div className="mt-0.5 text-sm leading-relaxed text-body">
                  Ask about any topic, in any order.
                </div>
              </div>
            </div>
          </button>

          {/* Generate a course */}
          <button onClick={handleGenerate} disabled={isGenerating} className={OPTION}>
            <div className="flex items-start gap-3">
              <OptionIcon>
                {isGenerating
                  ? <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
                  : <Route aria-hidden />}
              </OptionIcon>
              <div>
                <div className="text-sm font-bold text-ink">
                  {isGenerating ? "Building your course…" : "Build my course"}
                </div>
                <div className="mt-0.5 text-sm leading-relaxed text-body">
                  Aristo picks the concepts for your subject and puts them in order.
                </div>
              </div>
            </div>
          </button>

          {genError && (
            <p role="alert" className={cn(SHAPE.control, "flex items-start gap-2 border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger")}>
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              {genError}
            </p>
          )}

          {/* Published courses */}
          <div>
            <p className="mb-2 px-1 text-xs font-semibold text-muted">
              Courses
            </p>

            {courses === null ? (
              <div role="status" className="flex items-center justify-center py-8">
                <span className="sr-only">Loading courses</span>
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
            ) : courses.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <OptionIcon><BookOpen aria-hidden /></OptionIcon>
                <p className="text-sm text-body">
                  No courses yet. Build one above.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {courses.map((c) => (
                  <button key={c.id} onClick={() => onStartCourse(c)} className={OPTION}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-ink">
                          {c.title}
                        </div>
                        {c.description && (
                          <div className="mt-0.5 line-clamp-2 text-sm leading-relaxed text-body">
                            {c.description}
                          </div>
                        )}
                        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted">
                          <span>{conceptCount(c)} {conceptCount(c) === 1 ? "concept" : "concepts"}</span>
                          {c.estimated_hours && (
                            <>
                              <span aria-hidden>·</span>
                              <span>about {c.estimated_hours} h</span>
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronRight aria-hidden className="mt-0.5 size-5 shrink-0 text-muted transition-colors duration-fast group-hover:text-ink" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
