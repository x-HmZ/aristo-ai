"use client";

import { useEffect, useState, useCallback } from "react";
import { useAristoStore, type CourseStructure } from "@/store/useAristoStore";

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

// ─── Component ────────────────────────────────────────────────────────────────

export function ModePicker({ onExplore, onStartCourse }: ModePickerProps) {
  const [courses,      setCourses]      = useState<PublishedCourse[] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError,     setGenError]     = useState<string | null>(null);

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
      setGenError("Course generation failed. Please try again.");
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
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <div className="bg-white/80 backdrop-blur-2xl border border-white/60 rounded-3xl shadow-aristo-lg w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/60">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[#F97B2F] font-bold text-lg">✦</span>
            <h2 className="text-lg font-bold text-[#3D2110]">
              What would you like to do?
            </h2>
          </div>
          <p className="text-xs text-[#8B6E5A]">
            Start a course or explore any topic freely.
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

          {/* Free explore */}
          <button
            onClick={onExplore}
            className="w-full text-left p-4 rounded-2xl bg-gradient-to-br from-[#FFF0E4] to-[#FFDBB8] border border-[#F97B2F]/20 hover:border-[#F97B2F]/50 hover:shadow-aristo-sm transition-all duration-200 group"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">🌐</span>
              <div>
                <div className="font-bold text-[#3D2110] text-sm group-hover:text-[#F97B2F] transition-colors">
                  Explore Freely
                </div>
                <div className="text-xs text-[#8B6E5A] mt-0.5 leading-relaxed">
                  Ask Aristo about any topic — no set path.
                </div>
              </div>
            </div>
          </button>

          {/* Generate a course */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full text-left p-4 rounded-2xl bg-gradient-to-br from-[#EFF6FF] to-[#DBEAFE] border border-[#3B82F6]/20 hover:border-[#3B82F6]/50 hover:shadow-aristo-sm transition-all duration-200 group disabled:opacity-60"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">{isGenerating ? "⏳" : "✨"}</span>
              <div>
                <div className="font-bold text-[#1E3A5F] text-sm group-hover:text-[#3B82F6] transition-colors">
                  {isGenerating ? "Generating your course…" : "Generate My Course"}
                </div>
                <div className="text-xs text-[#4B6280] mt-0.5 leading-relaxed">
                  AI builds a personalised learning path from the knowledge graph.
                </div>
              </div>
            </div>
          </button>

          {genError && (
            <p className="text-xs text-red-500 px-1">{genError}</p>
          )}

          {/* Published courses */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B6E5A] mb-2 px-1">
              Courses
            </p>

            {courses === null ? (
              <div className="flex items-center justify-center py-8">
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
            ) : courses.length === 0 ? (
              <div className="text-center py-6">
                <div className="text-3xl mb-2">📚</div>
                <p className="text-xs text-[#8B6E5A]">
                  No published courses yet. Generate one above!
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {courses.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onStartCourse(c)}
                    className="w-full text-left p-4 rounded-2xl bg-white/70 border border-white/60 hover:border-[#F97B2F]/40 hover:bg-[#FFF8F4] hover:shadow-aristo-sm transition-all duration-200 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[#3D2110] text-sm group-hover:text-[#F97B2F] transition-colors truncate">
                          {c.title}
                        </div>
                        {c.description && (
                          <div className="text-xs text-[#8B6E5A] mt-0.5 leading-relaxed line-clamp-2">
                            {c.description}
                          </div>
                        )}
                        <div className="text-[10px] text-[#B8A99A] mt-1.5 flex items-center gap-2">
                          <span>{conceptCount(c)} concepts</span>
                          {c.estimated_hours && (
                            <>
                              <span>·</span>
                              <span>~{c.estimated_hours}h</span>
                            </>
                          )}
                        </div>
                      </div>
                      <span className="text-[#F97B2F] text-lg mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        →
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
