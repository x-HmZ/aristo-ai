"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyticsData {
  stats: {
    totalStudents: number;
    studentsThisWeek: number;
    publishedCourses: number;
    avgQuizScore: number;
    totalQuizAttempts: number;
  };
  styleDistribution: { style: string; count: number; pct: number }[];
  flowDistribution: { flow: string; count: number; pct: number }[];
  quizByStyle: { style: string; avgScore: number; count: number }[];
  strugglingTopics: { topic: string; avgScore: number; attempts: number }[];
  recentAttempts: {
    topic: string;
    score: number;
    total: number;
    style: string;
    at: string;
  }[];
}

interface Course {
  id: string;
  title: string;
  description: string | null;
  topic_list: string[];
  is_published: boolean;
  created_at: string;
  curricula: { title: string; source_type: string } | null;
}

type Tab = "overview" | "courses" | "new-course";
type CourseMethod = "manual" | "ai" | "pdf";

// ─── Display metadata ─────────────────────────────────────────────────────────

const STYLE_META: Record<string, { emoji: string; label: string; color: string }> = {
  explorer:    { emoji: "🌍", label: "Explorer",    color: "#F97B2F" },
  builder:     { emoji: "🧱", label: "Builder",     color: "#22C55E" },
  synthesizer: { emoji: "🔮", label: "Synthesizer", color: "#8B5CF6" },
  analyst:     { emoji: "🔬", label: "Analyst",     color: "#3B82F6" },
};

const FLOW_META: Record<string, { emoji: string; label: string; color: string }> = {
  interactive: { emoji: "🧭", label: "Interactive", color: "#F97B2F" },
  structured:  { emoji: "📋", label: "Structured",  color: "#3B82F6" },
};

// ─── Shared primitives ────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color = "#F97B2F",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-2xl p-5 shadow-aristo-sm">
      <div className="text-2xl font-bold tabular-nums" style={{ color }}>
        {value}
      </div>
      <div className="text-sm font-semibold text-[#3D2110] mt-0.5">{label}</div>
      {sub && <div className="text-xs text-[#8B6E5A] mt-1">{sub}</div>}
    </div>
  );
}

function BarRow({
  label,
  pct,
  count,
  color,
}: {
  label: string;
  pct: number;
  count: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-32 text-xs font-semibold text-[#3D2110] truncate">
        {label}
      </div>
      <div className="flex-1 bg-white/50 rounded-full h-2.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}
        />
      </div>
      <div className="w-16 text-right text-xs text-[#8B6E5A] tabular-nums">
        {pct}% ({count})
      </div>
    </div>
  );
}

function ScoreBadge({ score, total }: { score: number; total: number }) {
  const pct = total > 0 ? score / total : 0;
  const color =
    pct >= 0.7 ? { text: "#16A34A", bg: "#DCFCE7" } :
    pct >= 0.5 ? { text: "#C45A10", bg: "#FFF0E4" } :
                 { text: "#DC2626", bg: "#FEE2E2" };
  return (
    <span
      className="text-xs font-bold px-2 py-0.5 rounded-full tabular-nums"
      style={{ color: color.text, backgroundColor: color.bg }}
    >
      {score}/{total}
    </span>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: AnalyticsData | null }) {
  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-[#8B6E5A] text-sm">
        Loading analytics…
      </div>
    );
  }

  const { stats, styleDistribution, flowDistribution, quizByStyle, strugglingTopics, recentAttempts } = data;

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Students" value={stats.totalStudents} />
        <StatCard label="New This Week" value={stats.studentsThisWeek} color="#22C55E" />
        <StatCard label="Courses Published" value={stats.publishedCourses} color="#8B5CF6" />
        <StatCard
          label="Avg Quiz Score"
          value={`${stats.avgQuizScore}%`}
          sub={`${stats.totalQuizAttempts} total attempts`}
          color={
            stats.avgQuizScore >= 70 ? "#22C55E" :
            stats.avgQuizScore >= 50 ? "#F97B2F" : "#EF4444"
          }
        />
      </div>

      {/* Distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-2xl p-5 shadow-aristo-sm">
          <h3 className="font-semibold text-[#3D2110] text-sm mb-4">
            Learning Style Distribution
          </h3>
          {styleDistribution.length === 0 ? (
            <p className="text-xs text-[#8B6E5A]">No student data yet</p>
          ) : (
            <div className="space-y-3">
              {styleDistribution.map(({ style, count, pct }) => {
                const m = STYLE_META[style] ?? { emoji: "·", label: style, color: "#8B6E5A" };
                return (
                  <BarRow
                    key={style}
                    label={`${m.emoji} ${m.label}`}
                    pct={pct}
                    count={count}
                    color={m.color}
                  />
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-2xl p-5 shadow-aristo-sm">
          <h3 className="font-semibold text-[#3D2110] text-sm mb-4">
            Teaching Flow Distribution
          </h3>
          {flowDistribution.length === 0 ? (
            <p className="text-xs text-[#8B6E5A]">No student data yet</p>
          ) : (
            <div className="space-y-3">
              {flowDistribution.map(({ flow, count, pct }) => {
                const m = FLOW_META[flow] ?? { emoji: "·", label: flow, color: "#8B6E5A" };
                return (
                  <BarRow
                    key={flow}
                    label={`${m.emoji} ${m.label}`}
                    pct={pct}
                    count={count}
                    color={m.color}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quiz performance + struggling topics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-2xl p-5 shadow-aristo-sm">
          <h3 className="font-semibold text-[#3D2110] text-sm mb-4">
            Quiz Score by Style
          </h3>
          {quizByStyle.length === 0 ? (
            <p className="text-xs text-[#8B6E5A]">No quiz data yet</p>
          ) : (
            <div className="space-y-3">
              {quizByStyle.map(({ style, avgScore, count }) => {
                const m = STYLE_META[style] ?? { emoji: "·", label: style, color: "#8B6E5A" };
                const barColor =
                  avgScore >= 70 ? "#22C55E" :
                  avgScore >= 50 ? "#F97B2F" : "#EF4444";
                return (
                  <BarRow
                    key={style}
                    label={`${m.emoji} ${m.label}`}
                    pct={avgScore}
                    count={count}
                    color={barColor}
                  />
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-2xl p-5 shadow-aristo-sm">
          <h3 className="font-semibold text-[#3D2110] text-sm mb-4">
            Struggling Topics
            <span className="ml-1 text-[10px] font-normal text-[#8B6E5A]">
              (lowest avg score, ≥2 attempts)
            </span>
          </h3>
          {strugglingTopics.length === 0 ? (
            <p className="text-xs text-[#8B6E5A]">
              Not enough data yet — needs at least 2 attempts per topic.
            </p>
          ) : (
            <div className="space-y-0">
              {strugglingTopics.map(({ topic, avgScore, attempts }) => {
                const pct = avgScore;
                const color =
                  pct >= 70 ? { text: "#16A34A", bg: "#DCFCE7" } :
                  pct >= 50 ? { text: "#C45A10", bg: "#FFF0E4" } :
                              { text: "#DC2626", bg: "#FEE2E2" };
                return (
                  <div
                    key={topic}
                    className="flex items-center justify-between py-2 border-b border-white/60 last:border-0"
                  >
                    <div className="text-xs font-medium text-[#3D2110] flex-1 truncate pr-3">
                      {topic}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-[#8B6E5A]">
                        {attempts}×
                      </span>
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full tabular-nums"
                        style={{ color: color.text, backgroundColor: color.bg }}
                      >
                        {avgScore}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent attempts */}
      {recentAttempts.length > 0 && (
        <div className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-2xl p-5 shadow-aristo-sm">
          <h3 className="font-semibold text-[#3D2110] text-sm mb-4">
            Recent Quiz Attempts
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#8B6E5A]">
                  <th className="pb-2 font-medium text-left">Topic</th>
                  <th className="pb-2 font-medium text-left">Score</th>
                  <th className="pb-2 font-medium text-left">Style</th>
                  <th className="pb-2 font-medium text-left">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentAttempts.map((a, i) => (
                  <tr key={i} className="border-t border-white/60">
                    <td className="py-2 text-[#3D2110] font-medium max-w-[180px] truncate pr-3">
                      {a.topic}
                    </td>
                    <td className="py-2">
                      <ScoreBadge score={a.score} total={a.total} />
                    </td>
                    <td className="py-2 text-[#8B6E5A]">
                      {(STYLE_META[a.style]?.emoji ?? "·")}{" "}
                      {STYLE_META[a.style]?.label ?? a.style}
                    </td>
                    <td className="py-2 text-[#8B6E5A]">
                      {new Date(a.at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Courses Tab ──────────────────────────────────────────────────────────────

function CoursesTab({
  courses,
  onRefresh,
}: {
  courses: Course[] | null;
  onRefresh: () => void;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const togglePublish = async (course: Course) => {
    setBusyId(course.id);
    await fetch("/api/admin/courses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: course.id, is_published: !course.is_published }),
    });
    setBusyId(null);
    onRefresh();
  };

  const deleteCourse = async (id: string) => {
    setBusyId(id);
    await fetch("/api/admin/courses", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setBusyId(null);
    setConfirmId(null);
    onRefresh();
  };

  if (!courses) {
    return (
      <div className="flex items-center justify-center h-64 text-[#8B6E5A] text-sm">
        Loading courses…
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="text-4xl">📚</div>
        <p className="text-[#8B6E5A] text-sm">
          No courses yet — create one in the &ldquo;New Course&rdquo; tab.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[#8B6E5A]">
        {courses.length} course{courses.length !== 1 ? "s" : ""}
      </p>
      {courses.map((course) => (
        <div
          key={course.id}
          className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-2xl p-5 shadow-aristo-sm"
        >
          <div className="flex items-start justify-between gap-4">
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-[#3D2110]">{course.title}</h3>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    color: course.is_published ? "#16A34A" : "#8B6E5A",
                    backgroundColor: course.is_published ? "#DCFCE7" : "#F5F0EB",
                  }}
                >
                  {course.is_published ? "Published" : "Draft"}
                </span>
                {course.curricula?.source_type && (
                  <span className="text-[10px] text-[#8B6E5A] bg-white/60 px-2 py-0.5 rounded-full border border-white/60">
                    {course.curricula.source_type === "ai_generated"
                      ? "✨ AI"
                      : course.curricula.source_type === "pdf"
                      ? "📄 PDF"
                      : "✍️ Manual"}
                  </span>
                )}
              </div>
              {course.description && (
                <p className="text-xs text-[#8B6E5A] mt-1 line-clamp-2">
                  {course.description}
                </p>
              )}
              <div className="flex items-center gap-3 mt-2 text-xs text-[#8B6E5A]">
                <span>📝 {course.topic_list.length} topics</span>
                <span>·</span>
                <span>{new Date(course.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => togglePublish(course)}
                disabled={busyId === course.id}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-200 disabled:opacity-50"
                style={{
                  backgroundColor: course.is_published ? "#FEE2E2" : "#DCFCE7",
                  color: course.is_published ? "#DC2626" : "#16A34A",
                }}
              >
                {busyId === course.id
                  ? "…"
                  : course.is_published
                  ? "Unpublish"
                  : "Publish"}
              </button>

              {confirmId === course.id ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => deleteCourse(course.id)}
                    disabled={busyId === course.id}
                    className="text-xs font-semibold px-2 py-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors disabled:opacity-50"
                  >
                    {busyId === course.id ? "…" : "Confirm"}
                  </button>
                  <button
                    onClick={() => setConfirmId(null)}
                    className="text-xs font-semibold px-2 py-1.5 rounded-lg bg-white/60 text-[#8B6E5A] hover:bg-white/80 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmId(course.id)}
                  className="text-xs font-semibold px-2 py-1.5 rounded-lg bg-white/60 text-[#8B6E5A] hover:bg-red-50 hover:text-red-500 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          </div>

          {/* Topic preview */}
          {course.topic_list.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {course.topic_list.slice(0, 6).map((t, i) => (
                <span
                  key={i}
                  className="text-[11px] bg-white/60 border border-white/60 text-[#8B6E5A] px-2 py-0.5 rounded-full"
                >
                  {t}
                </span>
              ))}
              {course.topic_list.length > 6 && (
                <span className="text-[11px] text-[#B8A99A]">
                  +{course.topic_list.length - 6} more
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── New Course Tab ───────────────────────────────────────────────────────────

function NewCourseTab({ onCreated }: { onCreated: () => void }) {
  const [method, setMethod] = useState<CourseMethod>("manual");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState("");
  const [aiDescription, setAiDescription] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const generateCurriculum = async () => {
    setIsGenerating(true);
    setError("");
    try {
      let body: object;
      if (method === "pdf" && pdfFile) {
        const base64 = await fileToBase64(pdfFile);
        body = { pdfBase64: base64 };
      } else {
        if (!aiDescription.trim()) {
          setError("Enter a subject description first.");
          setIsGenerating(false);
          return;
        }
        body = { description: aiDescription.trim() };
      }

      const res = await fetch("/api/admin/generate-curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Generation failed");
        return;
      }
      setTitle(data.title ?? "");
      setDescription(data.description ?? "");
      setTopics(data.topics ?? []);
    } catch {
      setError("Generation failed — check the console for details.");
    } finally {
      setIsGenerating(false);
    }
  };

  const addTopic = () => {
    const t = topicInput.trim();
    if (t && !topics.includes(t)) {
      setTopics((prev) => [...prev, t]);
      setTopicInput("");
    }
  };

  const removeTopic = (i: number) =>
    setTopics((prev) => prev.filter((_, idx) => idx !== i));

  const moveTopic = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= topics.length) return;
    const next = [...topics];
    [next[i], next[j]] = [next[j], next[i]];
    setTopics(next);
  };

  const saveCourse = async (publish: boolean) => {
    if (!title.trim()) { setError("Course title is required."); return; }
    if (topics.length < 2) { setError("Add at least 2 topics."); return; }
    setIsSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          topics,
          source_type:
            method === "ai" ? "ai_generated" : method === "pdf" ? "pdf" : "manual",
          is_published: publish,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Save failed"); return; }
      setSaved(true);
      setTimeout(() => {
        setTitle(""); setDescription(""); setTopics([]);
        setAiDescription(""); setPdfFile(null); setSaved(false);
        onCreated();
      }, 800);
    } catch {
      setError("Save failed — try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="text-4xl">✅</div>
        <p className="text-[#3D2110] font-semibold">Course saved!</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      {/* Method toggle */}
      <div>
        <label className="block text-xs font-semibold text-[#8B6E5A] uppercase tracking-wider mb-2">
          Creation Method
        </label>
        <div className="flex items-center gap-1 bg-white/60 rounded-full p-0.5 border border-white/60 w-fit">
          {(
            [
              { value: "manual" as CourseMethod, label: "✍️ Manual"    },
              { value: "ai"     as CourseMethod, label: "✨ AI Assist"  },
              { value: "pdf"    as CourseMethod, label: "📄 From PDF"  },
            ] as const
          ).map((m) => (
            <button
              key={m.value}
              onClick={() => setMethod(m.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                method === m.value
                  ? "bg-[#F97B2F] text-white shadow-sm"
                  : "text-[#8B6E5A] hover:text-[#3D2110]"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* AI / PDF input */}
      {method === "ai" && (
        <div className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-2xl p-4 space-y-3">
          <label className="block text-xs font-semibold text-[#8B6E5A]">
            Describe the course subject
          </label>
          <textarea
            value={aiDescription}
            onChange={(e) => setAiDescription(e.target.value)}
            placeholder={`e.g. "Grade 7 biology unit on human body systems" or "Introduction to algebra for 6th graders"`}
            rows={3}
            className="w-full text-sm bg-white/60 border border-white/60 rounded-xl px-3 py-2 text-[#3D2110] placeholder:text-[#B8A99A] resize-none focus:outline-none focus:ring-2 focus:ring-[#F97B2F]/30"
          />
          <button
            onClick={generateCurriculum}
            disabled={isGenerating || !aiDescription.trim()}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#F97B2F] text-white hover:bg-[#E06A20] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isGenerating ? "Generating…" : "✨ Generate Topics"}
          </button>
        </div>
      )}

      {method === "pdf" && (
        <div className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-2xl p-4 space-y-3">
          <label className="block text-xs font-semibold text-[#8B6E5A]">
            Upload a PDF curriculum or textbook chapter
          </label>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/80 border border-white/60 text-[#8B6E5A] hover:text-[#3D2110] transition-all"
            >
              {pdfFile ? `📄 ${pdfFile.name}` : "Choose PDF…"}
            </button>
            {pdfFile && (
              <button
                onClick={generateCurriculum}
                disabled={isGenerating}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#F97B2F] text-white hover:bg-[#E06A20] disabled:opacity-50 transition-all"
              >
                {isGenerating ? "Parsing…" : "📄 Parse PDF"}
              </button>
            )}
          </div>
          <p className="text-xs text-[#B8A99A]">
            Gemini reads the PDF and extracts a topic list automatically. Max 20 MB.
          </p>
        </div>
      )}

      {/* Course details form */}
      <div className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-2xl p-4 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[#8B6E5A] mb-1.5">
            Course Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Human Body Systems"
            className="w-full text-sm bg-white/60 border border-white/60 rounded-xl px-3 py-2 text-[#3D2110] placeholder:text-[#B8A99A] focus:outline-none focus:ring-2 focus:ring-[#F97B2F]/30"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#8B6E5A] mb-1.5">
            Description{" "}
            <span className="font-normal text-[#B8A99A]">(optional)</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="One sentence summary for students"
            className="w-full text-sm bg-white/60 border border-white/60 rounded-xl px-3 py-2 text-[#3D2110] placeholder:text-[#B8A99A] focus:outline-none focus:ring-2 focus:ring-[#F97B2F]/30"
          />
        </div>

        {/* Topic list */}
        <div>
          <label className="block text-xs font-semibold text-[#8B6E5A] mb-2">
            Topics{" "}
            <span className="font-normal text-[#B8A99A]">
              ({topics.length} added)
            </span>
          </label>

          {topics.length > 0 && (
            <ol className="space-y-1.5 mb-3">
              {topics.map((topic, i) => (
                <li key={i} className="flex items-center gap-2 group">
                  <span className="w-5 text-xs text-[#B8A99A] text-right flex-shrink-0">
                    {i + 1}.
                  </span>
                  <span className="flex-1 text-sm text-[#3D2110] bg-white/50 rounded-lg px-2.5 py-1.5 leading-snug">
                    {topic}
                  </span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => moveTopic(i, -1)}
                      disabled={i === 0}
                      className="text-xs px-1.5 py-0.5 rounded text-[#8B6E5A] hover:bg-white/80 disabled:opacity-30 transition-colors"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveTopic(i, 1)}
                      disabled={i === topics.length - 1}
                      className="text-xs px-1.5 py-0.5 rounded text-[#8B6E5A] hover:bg-white/80 disabled:opacity-30 transition-colors"
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => removeTopic(i)}
                      className="text-xs px-1.5 py-0.5 rounded text-red-400 hover:bg-red-50 transition-colors"
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTopic()}
              placeholder="Add a topic and press Enter…"
              className="flex-1 text-sm bg-white/60 border border-white/60 rounded-xl px-3 py-2 text-[#3D2110] placeholder:text-[#B8A99A] focus:outline-none focus:ring-2 focus:ring-[#F97B2F]/30"
            />
            <button
              onClick={addTopic}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-white/80 border border-white/60 text-[#8B6E5A] hover:text-[#3D2110] transition-all"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-500 font-medium">{error}</p>
      )}

      {/* Save actions */}
      <div className="flex gap-3">
        <button
          onClick={() => saveCourse(false)}
          disabled={isSaving}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-white/80 border border-white/60 text-[#8B6E5A] hover:text-[#3D2110] disabled:opacity-50 transition-all"
        >
          Save as Draft
        </button>
        <button
          onClick={() => saveCourse(true)}
          disabled={isSaving}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#F97B2F] text-white hover:bg-[#E06A20] disabled:opacity-50 shadow-aristo-sm transition-all"
        >
          {isSaving ? "Saving…" : "Save & Publish"}
        </button>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]); // strip data URL prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Admin Page ───────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    const res = await fetch("/api/admin/analytics");
    if (res.ok) setAnalytics(await res.json());
  }, []);

  const fetchCourses = useCallback(async () => {
    const res = await fetch("/api/admin/courses");
    if (res.ok) {
      const data = await res.json();
      setCourses(data.courses ?? []);
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchAnalytics(), fetchCourses()]);
    setIsRefreshing(false);
  }, [fetchAnalytics, fetchCourses]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCourseCreated = useCallback(() => {
    fetchCourses();
    setTab("courses");
  }, [fetchCourses]);

  const TABS: { value: Tab; label: string }[] = [
    { value: "overview",   label: "Overview"    },
    { value: "courses",    label: "Courses"     },
    { value: "new-course", label: "New Course"  },
  ];

  return (
    <main className="min-h-screen bg-aristo-gradient">
      {/* Header */}
      <div className="bg-white/50 backdrop-blur-xl border-b border-white/40 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#3D2110]">Aristo Admin</h1>
            <p className="text-xs text-[#8B6E5A]">
              Dashboard &amp; Curriculum Manager
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={refresh}
              disabled={isRefreshing}
              className="text-xs font-medium text-[#8B6E5A] hover:text-[#3D2110] px-3 py-1.5 rounded-lg hover:bg-white/60 transition-all disabled:opacity-50"
            >
              {isRefreshing ? "Refreshing…" : "↻ Refresh"}
            </button>
            <Link
              href="/learn"
              className="text-xs font-semibold text-[#F97B2F] hover:text-[#C45A10] px-3 py-1.5 rounded-lg hover:bg-[#FFF0E4] transition-all"
            >
              → Go to Aristo
            </Link>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white/30 backdrop-blur-sm border-b border-white/30 px-6">
        <div className="max-w-6xl mx-auto flex items-end gap-0.5 pt-2">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`px-5 py-2.5 text-sm font-semibold rounded-t-xl transition-all duration-200 ${
                tab === t.value
                  ? "bg-white/70 text-[#F97B2F] border-t border-l border-r border-white/60"
                  : "text-[#8B6E5A] hover:text-[#3D2110] hover:bg-white/30"
              }`}
            >
              {t.label}
              {t.value === "courses" && courses !== null && (
                <span className="ml-1.5 text-[10px] bg-[#F97B2F]/10 text-[#F97B2F] px-1.5 py-0.5 rounded-full">
                  {courses.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        {tab === "overview"   && <OverviewTab  data={analytics} />}
        {tab === "courses"    && <CoursesTab   courses={courses} onRefresh={fetchCourses} />}
        {tab === "new-course" && <NewCourseTab onCreated={handleCourseCreated} />}
      </div>
    </main>
  );
}
