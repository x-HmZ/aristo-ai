"use client";

import { useEffect, useState } from "react";
import Link                    from "next/link";
import { Plus, Trash2, BookOpen, RefreshCw } from "lucide-react";
import { PageHeader }          from "@/components/admin/PageHeader";
import { BrandCard }           from "@/components/admin/ui/BrandCard";
import { BrandButton }         from "@/components/admin/ui/BrandButton";
import { BrandBadge }          from "@/components/admin/ui/BrandBadge";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CourseLesson  { id: string; title: string; concept_ids: string[] }
interface CourseModule  { id: string; title: string; description: string; lessons: CourseLesson[] }
interface CourseStructure { modules: CourseModule[] }

interface Course {
  id:              string;
  domain:          string;
  title:           string;
  description:     string | null;
  structure:       CourseStructure | null;
  estimated_hours: number | null;
  is_published:    boolean;
  created_at:      string;
}

function courseTopics(c: Course): string[] {
  if (!c.structure?.modules) return [];
  return c.structure.modules.flatMap((m) => m.lessons.map((l) => l.title));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CoursesPage() {
  const [courses, setCourses]   = useState<Course[] | null>(null);
  const [busyId, setBusyId]     = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    const res = await fetch("/api/admin/courses", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setCourses(data.courses ?? []);
    }
    setRefreshing(false);
  };

  useEffect(() => { load(); }, []);

  const togglePublish = async (course: Course) => {
    setBusyId(course.id);
    await fetch("/api/admin/courses", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id: course.id, is_published: !course.is_published }),
    });
    setBusyId(null);
    load();
  };

  const deleteCourse = async (id: string) => {
    setBusyId(id);
    await fetch("/api/admin/courses", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id }),
    });
    setBusyId(null);
    setConfirmId(null);
    load();
  };

  return (
    <>
      <PageHeader
        title="Courses"
        subtitle="Published and draft courses sourced from the knowledge graph. Each course is a JSONB structure of modules → lessons → concept_ids."
        actions={
          <>
            <BrandButton
              variant="secondary"
              size="sm"
              onClick={load}
              disabled={refreshing}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </BrandButton>
            <Link href="/admin/courses/new">
              <BrandButton variant="primary" size="sm">
                <Plus className="h-3.5 w-3.5" />
                New course
              </BrandButton>
            </Link>
          </>
        }
      />

      {courses === null ? (
        <BrandCard><p className="text-xs text-aristo-brown/60">Loading…</p></BrandCard>
      ) : courses.length === 0 ? (
        <BrandCard className="flex flex-col items-center justify-center py-12 gap-3">
          <BookOpen className="h-12 w-12 text-aristo-brown/30" />
          <p className="text-sm text-aristo-brown/60">No courses yet.</p>
          <Link href="/admin/courses/new">
            <BrandButton variant="primary" size="sm">
              <Plus className="h-3.5 w-3.5" />
              Create the first one
            </BrandButton>
          </Link>
        </BrandCard>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-aristo-brown/60">
            {courses.length} course{courses.length !== 1 ? "s" : ""}
          </p>
          {courses.map((course) => {
            const topics = courseTopics(course);
            return (
              <BrandCard key={course.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/admin/courses/${encodeURIComponent(course.id)}`}
                        className="font-semibold text-aristo-brown hover:text-aristo-orange transition-colors"
                      >
                        {course.title}
                      </Link>
                      <BrandBadge variant={course.is_published ? "green" : "amber"}>
                        {course.is_published ? "Published" : "Draft"}
                      </BrandBadge>
                      <BrandBadge variant="neutral">{course.domain}</BrandBadge>
                      {course.estimated_hours && (
                        <BrandBadge variant="blue">
                          ~{course.estimated_hours}h
                        </BrandBadge>
                      )}
                    </div>
                    {course.description && (
                      <p className="text-xs text-aristo-brown/60 mt-1 line-clamp-2">
                        {course.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-aristo-brown/50">
                      <span>📝 {topics.length} lessons</span>
                      <span>·</span>
                      <span>{course.structure?.modules?.length ?? 0} modules</span>
                      <span>·</span>
                      <span>{new Date(course.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <BrandButton
                      variant={course.is_published ? "destructive" : "success"}
                      size="sm"
                      onClick={() => togglePublish(course)}
                      disabled={busyId === course.id}
                    >
                      {busyId === course.id
                        ? "…"
                        : course.is_published ? "Unpublish" : "Publish"}
                    </BrandButton>

                    {confirmId === course.id ? (
                      <div className="flex items-center gap-1">
                        <BrandButton
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteCourse(course.id)}
                          disabled={busyId === course.id}
                        >
                          Confirm
                        </BrandButton>
                        <BrandButton
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmId(null)}
                        >
                          Cancel
                        </BrandButton>
                      </div>
                    ) : (
                      <BrandButton
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmId(course.id)}
                        title="Delete course"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </BrandButton>
                    )}
                  </div>
                </div>

                {topics.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {topics.slice(0, 8).map((t, i) => (
                      <BrandBadge key={i} variant="neutral">{t}</BrandBadge>
                    ))}
                    {topics.length > 8 && (
                      <span className="text-[11px] text-aristo-brown/40">
                        +{topics.length - 8} more
                      </span>
                    )}
                  </div>
                )}
              </BrandCard>
            );
          })}
        </div>
      )}
    </>
  );
}
