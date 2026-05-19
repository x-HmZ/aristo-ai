"use client";

import { useAristoStore, type TeacherAvatar, type Classroom } from "@/store/useAristoStore";

// ─── Avatar catalog ───────────────────────────────────────────────────────────
// To add a new avatar: drop Teacher_<key>.glb + animations_<key>.glb into
// public/models/ then add an entry here. Animations must use the Mixamo
// humanoid rig (idle, Talking, Talking2, Thinking). Use mixamo2gltf.com or
// Blender + Expy-Kit addon for retargeting.

// To enable a slot: drop the GLB pair in public/models/ then set readyToUse: true.
//
// Recommended FREE, commercial-OK, photorealistic sources:
//
//   marcus (adult male, ~8–9/10 realism):
//     Option A — CC4 "Aaron" photoscanned base:
//       https://www.reallusion.com/character-creator/free-3d-character-base.html
//     Option B — ActorCore free scanned male:
//       https://actorcore.reallusion.com/3d-character/free
//     Option C — CGTrader Realistic Male Rigged (native GLB):
//       https://www.cgtrader.com/free-3d-models/character/man/realistic-male-character-rigged
//
//   priya (adult female, ~8–9/10 realism):
//     Option A — CC4 "Ariana" photoscanned base (same URL as above)
//     Option B — ActorCore free scanned female (same URL as above)
//
//   Export workflow for CC4/ActorCore:
//     CC4 FBX → Blender + CC/iC Tools add-on (github.com/soupday/cc_blender_tools)
//     → Build Basic Materials → Bake Textures → Export GLB (no animations)
//     Then: upload FBX to mixamo.com → auto-rig → download Idle/Talking/Thinking
//     as FBX → Blender NLA editor (rename strips to "Idle"/"Talking"/"Talking2"/"Thinking")
//     → Export GLB with animations → animations_Marcus.glb
const AVATARS: { value: TeacherAvatar; label: string; readyToUse: boolean }[] = [
  { value: "ryan",   label: "Ryan",   readyToUse: true  },
  { value: "sonia",  label: "Sonia",  readyToUse: true  },
  { value: "marcus", label: "Marcus", readyToUse: true  },
  { value: "priya",  label: "Priya",  readyToUse: true  },
];

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
      ? [{ value: "custom" as TeacherAvatar, label: "My Teacher", readyToUse: true }]
      : []),
    ...AVATARS,
  ];

  return (
    <div className="bg-white/50 backdrop-blur-xl border-b border-white/40 px-4 py-3 rounded-t-2xl flex flex-col gap-2.5">

      {/* Row 1: Avatar selector + generating badge + clear */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-white/60 rounded-full p-0.5 border border-white/60 overflow-x-auto max-w-[260px]" style={{ scrollbarWidth: "none" }}>
          {visibleAvatars.filter((a) => a.readyToUse).map((a) => (
            <button
              key={a.value}
              onClick={() => setTeacher(a.value)}
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

      {/* Row 2: Environment switcher */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#B8957A] shrink-0">Scene</span>
        <div className="flex items-center gap-1 bg-white/60 rounded-full p-0.5 border border-white/60">
          {ENVIRONMENTS.map((e) => (
            <button
              key={e.value}
              onClick={() => setClassroom(e.value)}
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
