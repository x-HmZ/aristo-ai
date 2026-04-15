"use client";

import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PublishedCourse {
  id: string;
  title: string;
  description: string | null;
  topic_list: string[];
}

interface ModePickerProps {
  onExplore: () => void;
  onStartCourse: (course: PublishedCourse) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ModePicker({ onExplore, onStartCourse }: ModePickerProps) {
  const [courses, setCourses] = useState<PublishedCourse[] | null>(null);

  useEffect(() => {
    fetch("/api/courses")
      .then((r) => r.json())
      .then((d) => setCourses(d.courses ?? []))
      .catch(() => setCourses([]));
  }, []);

  return (
    /* Full-screen overlay — same layering as StyleAssessment */
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

          {/* Free explore card */}
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

          {/* Courses section */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B6E5A] mb-2 px-1">
              Courses
            </p>

            {courses === null ? (
              /* Loading */
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
              /* No courses */
              <div className="text-center py-6">
                <div className="text-3xl mb-2">📚</div>
                <p className="text-xs text-[#8B6E5A]">
                  No courses published yet.
                </p>
              </div>
            ) : (
              /* Course cards */
              <div className="space-y-2">
                {courses.map((course) => (
                  <button
                    key={course.id}
                    onClick={() => onStartCourse(course)}
                    className="w-full text-left p-4 rounded-2xl bg-white/70 border border-white/60 hover:border-[#F97B2F]/40 hover:bg-[#FFF8F4] hover:shadow-aristo-sm transition-all duration-200 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[#3D2110] text-sm group-hover:text-[#F97B2F] transition-colors truncate">
                          {course.title}
                        </div>
                        {course.description && (
                          <div className="text-xs text-[#8B6E5A] mt-0.5 leading-relaxed line-clamp-2">
                            {course.description}
                          </div>
                        )}
                        <div className="text-[10px] text-[#B8A99A] mt-1.5">
                          {course.topic_list.length} topics
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
