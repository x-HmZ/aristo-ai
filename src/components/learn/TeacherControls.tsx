"use client";

import {
  useAristoStore,
  type TeacherAvatar,
  type TeachingFlow,
  type LearningStyle,
} from "@/store/useAristoStore";

// ─── Display data ─────────────────────────────────────────────────────────────

const STYLE_META: Record<LearningStyle, { emoji: string; label: string }> = {
  explorer:    { emoji: "🌍", label: "Explorer"    },
  builder:     { emoji: "🧱", label: "Builder"     },
  synthesizer: { emoji: "🔮", label: "Synthesizer" },
  analyst:     { emoji: "🔬", label: "Analyst"     },
};

const AVATARS: { value: TeacherAvatar; label: string }[] = [
  { value: "ryan",  label: "Ryan"  },
  { value: "sonia", label: "Sonia" },
];

const FLOWS: { value: TeachingFlow; label: string; emoji: string; tip: string }[] = [
  {
    value: "interactive",
    label: "Interactive",
    emoji: "🧭",
    tip: "Aristo guides you with questions — like a tutor",
  },
  {
    value: "structured",
    label: "Structured",
    emoji: "📋",
    tip: "Aristo explains fully first, then you ask questions",
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface TeacherControlsProps {
  /** Called when the student clicks Clear — resets to mode picker */
  onClear: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TeacherControls({ onClear }: TeacherControlsProps) {
  const teacher           = useAristoStore((s) => s.teacher);
  const learningStyle     = useAristoStore((s) => s.learningStyle);
  const teachingFlow      = useAristoStore((s) => s.teachingFlow);
  const isGeneratingModel = useAristoStore((s) => s.isGeneratingModel);
  const mode              = useAristoStore((s) => s.mode);
  const course            = useAristoStore((s) => s.course);

  const setTeacher      = useAristoStore((s) => s.setTeacher);
  const setTeachingFlow = useAristoStore((s) => s.setTeachingFlow);

  const styleMeta = STYLE_META[learningStyle] ?? STYLE_META.explorer;

  const inCourse  = mode === "course" && course.courseId !== null;
  const topicNum  = course.currentTopicIndex + 1;
  const topicTotal = course.topics.length;
  const topicName  = course.topics[course.currentTopicIndex] ?? "";
  const progress   = topicTotal > 0 ? (topicNum / topicTotal) * 100 : 0;

  return (
    <div className="bg-white/50 backdrop-blur-xl border-b border-white/40 px-4 py-3 rounded-t-2xl flex flex-col gap-2.5">

      {/* Row 1: Avatar selector + status + clear */}
      <div className="flex items-center justify-between">
        {/* Avatar toggle */}
        <div className="flex items-center gap-1 bg-white/60 rounded-full p-0.5 border border-white/60">
          {AVATARS.map((a) => (
            <button
              key={a.value}
              onClick={() => setTeacher(a.value)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${
                teacher === a.value
                  ? "bg-[#F97B2F] text-white shadow-sm"
                  : "text-[#8B6E5A] hover:text-[#3D2110]"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {isGeneratingModel && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-[#F97B2F] animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F97B2F] animate-ping" />
              Generating 3D…
            </span>
          )}
          <button
            onClick={onClear}
            className="text-xs text-[#8B6E5A] hover:text-[#3D2110] transition-colors font-medium px-2 py-1 rounded-lg hover:bg-white/60"
          >
            {inCourse ? "Exit Course" : "Clear"}
          </button>
        </div>
      </div>

      {/* Row 2: Profile badge + flow toggle */}
      <div className="flex items-center justify-between gap-2">
        {/* Learning style badge — read-only */}
        <div
          title="Your assessed learning style — adapts automatically over time"
          className="flex items-center gap-1.5 bg-[#FFF0E4] border border-[#F97B2F]/20 rounded-full px-3 py-1"
        >
          <span className="text-sm">{styleMeta.emoji}</span>
          <span className="text-[11px] font-semibold text-[#C45A10]">
            {styleMeta.label}
          </span>
        </div>

        {/* Flow toggle — disabled mid-course so it doesn't conflict with auto-teach */}
        <div className="flex items-center gap-1 bg-white/60 rounded-full p-0.5 border border-white/60">
          {FLOWS.map((f) => (
            <button
              key={f.value}
              onClick={() => !inCourse && setTeachingFlow(f.value)}
              title={inCourse ? "Cannot change flow mid-course" : f.tip}
              disabled={inCourse}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${
                teachingFlow === f.value
                  ? "bg-[#F97B2F] text-white shadow-sm"
                  : "text-[#8B6E5A] hover:text-[#3D2110]"
              } ${inCourse ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <span>{f.emoji}</span>
              <span>{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Row 3: Course progress (only when in a course) */}
      {inCourse && (
        <div className="flex flex-col gap-1.5">
          {/* Course title + topic counter */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#C45A10] truncate max-w-[60%]">
              {course.title}
            </span>
            <span className="text-[10px] text-[#8B6E5A] tabular-nums">
              Topic {topicNum} of {topicTotal}
            </span>
          </div>

          {/* Current topic name */}
          <p className="text-[11px] font-semibold text-[#3D2110] truncate">
            {topicName}
          </p>

          {/* Progress bar */}
          <div className="h-1.5 bg-white/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#F97B2F] rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
