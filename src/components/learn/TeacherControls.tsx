"use client";

import { useGLTF } from "@react-three/drei";
import { useAristoStore, ACTIVE_TEACHERS, type TeacherAvatar, type Classroom } from "@/store/useAristoStore";
import { AVATAR_ASSETS } from "@/components/three/Teacher";
import { AvatarCredit } from "@/components/learn/AvatarCredit";

// T02 — 3D asset diet: only the default avatar + classroom preload at module
// scope (see Teacher.tsx / Classroom.tsx). Everything else lazy-loads via
// Suspense on first render, which is correct but leaves a beat of loading
// spinner on the very first switch. Warm the GLB cache as soon as the user
// shows intent (hover) or commits (click) so the switch feels instant.
function preloadAvatar(avatar: TeacherAvatar) {
  if (avatar === "custom") return; // resolved to a runtime URL, nothing to preload
  const asset = AVATAR_ASSETS[avatar];
  useGLTF.preload(`/models/${asset.sceneFile}`);
  useGLTF.preload(`/models/${asset.animFile}`);
}

function preloadClassroom(variant: Classroom) {
  if (variant === "none") return;
  useGLTF.preload(`/models/classroom_${variant}.glb`);
}

// ─── Avatar catalog ───────────────────────────────────────────────────────────
// Only the active teachers (ACTIVE_TEACHERS in the store) are offered. To add
// one: give it an AVATAR_ASSETS entry in Teacher.tsx (with a `credit` if its
// licence needs one) and list it in ACTIVE_TEACHERS. Ryan, Sonia, Marcus and
// Priya are archived there, not deleted.
const AVATARS: { value: TeacherAvatar; label: string }[] = ACTIVE_TEACHERS.map((value) => ({
  value,
  label: AVATAR_ASSETS[value].label,
}));

const ENVIRONMENTS: { value: Classroom; label: string }[] = [
  { value: "default",     label: "Classroom"   },
  { value: "alternative", label: "Alt. Room"   },
  { value: "none",        label: "None"        },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface TeacherControlsProps {
  onClear: () => void;
}

export function TeacherControls({ onClear }: TeacherControlsProps) {
  const teacher           = useAristoStore((s) => s.teacher);
  const classroom         = useAristoStore((s) => s.classroom);
  const isGeneratingModel = useAristoStore((s) => s.isGeneratingModel);
  const mode              = useAristoStore((s) => s.mode);
  const course            = useAristoStore((s) => s.course);
  const customTeacherGlbUrl = useAristoStore((s) => s.customTeacherGlbUrl);
  const setTeacher        = useAristoStore((s) => s.setTeacher);
  const setClassroom      = useAristoStore((s) => s.setClassroom);

  const inCourse   = mode === "course" && course.courseId !== null;
  const topicNum   = course.currentTopicIndex + 1;
  const topicTotal = course.topics.length;
  const topicName  = course.topics[course.currentTopicIndex] ?? "";
  const progress   = topicTotal > 0 ? (topicNum / topicTotal) * 100 : 0;

  // Merge custom avatar into the list if the user has created one
  const visibleAvatars = [
    ...(customTeacherGlbUrl
      ? [{ value: "custom" as TeacherAvatar, label: "My Teacher" }]
      : []),
    ...AVATARS,
  ];

  return (
    <div className="bg-white/50 backdrop-blur-xl border-b border-white/40 px-4 py-3 rounded-t-2xl flex flex-col gap-2.5">

      {/* Row 1: Avatar selector + generating badge + clear */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-white/60 rounded-full p-0.5 border border-white/60 overflow-x-auto min-w-0" style={{ scrollbarWidth: "none" }}>
          {visibleAvatars.map((a) => (
            <button
              key={a.value}
              onClick={() => setTeacher(a.value)}
              onMouseEnter={() => preloadAvatar(a.value)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${
                teacher === a.value
                  ? "bg-[#F97B2F] text-white shadow-sm"
                  : "text-[#8B6E5A] hover:text-[#3D2110]"
              }`}
            >
              {a.label}
            </button>
          ))}
          {/* Create your own teacher */}
          <a
            href="/create-teacher"
            className="shrink-0 px-3 py-1 rounded-full text-xs font-semibold text-[#8B5CF6] hover:text-[#7C3AED] transition-colors whitespace-nowrap"
            title="Create your own 3D teacher avatar"
          >
            + Create
          </a>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isGeneratingModel && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-[#F97B2F] animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F97B2F] animate-ping" />
              Generating…
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

      {/* Licence credit for third-party avatars (CC BY) — sits with the switcher
          because this panel is on screen whenever the avatar is. */}
      <AvatarCredit avatar={teacher} className="-mt-1 px-1" />

      {/* Row 2: Environment switcher */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#B8957A] shrink-0">Scene</span>
        <div className="flex items-center gap-1 bg-white/60 rounded-full p-0.5 border border-white/60">
          {ENVIRONMENTS.map((e) => (
            <button
              key={e.value}
              onClick={() => setClassroom(e.value)}
              onMouseEnter={() => preloadClassroom(e.value)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${
                classroom === e.value
                  ? "bg-[#8B5CF6] text-white shadow-sm"
                  : "text-[#8B6E5A] hover:text-[#3D2110]"
              }`}
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 3: Course progress (only when in a course) */}
      {inCourse && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#C45A10] truncate max-w-[60%]">
              {course.title}
            </span>
            <span className="text-[10px] text-[#8B6E5A] tabular-nums">
              Topic {topicNum} of {topicTotal}
            </span>
          </div>
          <p className="text-[11px] font-semibold text-[#3D2110] truncate">{topicName}</p>
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
