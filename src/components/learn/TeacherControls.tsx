"use client";

import { useGLTF } from "@react-three/drei";
import { useAristoStore, ACTIVE_TEACHERS, type TeacherAvatar, type Classroom } from "@/store/useAristoStore";
import { AVATAR_ASSETS } from "@/components/three/Teacher";
import { AvatarCredit } from "@/components/learn/AvatarCredit";
import { Button } from "@/components/ui/button";
import { FOCUS, SHAPE } from "@/lib/design/shape";
import { cn } from "@/lib/utils";

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
  { value: "alternative", label: "Evening"     },
  { value: "none",        label: "None"        },
];

// The system's segmented control (brand-system.md, Tabs): a sunk rail, the
// chosen item a surface. 44px targets; items are 6px inside the 10px rail.
function segmentClass(selected: boolean) {
  return cn(
    FOCUS,
    "flex h-11 shrink-0 items-center rounded-[6px] px-3 text-sm font-semibold transition-colors duration-fast ease-out-soft",
    selected ? "bg-surface text-ink shadow-e1" : "text-body hover:text-ink",
  );
}

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
      ? [{ value: "custom" as TeacherAvatar, label: "My teacher" }]
      : []),
    ...AVATARS,
  ];

  return (
    <div className="flex flex-col gap-2.5 rounded-t-2xl border-b border-line bg-surface/95 px-4 py-3 backdrop-blur-xl">

      {/* Row 1: Avatar selector + generating badge + clear */}
      <div className="flex items-center justify-between gap-2">
        <div
          role="group"
          aria-label="Teacher"
          className={cn(SHAPE.control, "flex min-w-0 items-center gap-1 overflow-x-auto bg-sunk p-1")}
          style={{ scrollbarWidth: "none" }}
        >
          {visibleAvatars.map((a) => (
            <button
              key={a.value}
              onClick={() => setTeacher(a.value)}
              onMouseEnter={() => preloadAvatar(a.value)}
              aria-pressed={teacher === a.value}
              className={segmentClass(teacher === a.value)}
            >
              {a.label}
            </button>
          ))}
          {/* Create your own teacher */}
          <a
            href="/create-teacher"
            className={cn(
              FOCUS,
              "flex h-11 shrink-0 items-center whitespace-nowrap rounded-[6px] px-3 text-sm font-semibold text-accent-text transition-colors duration-fast hover:bg-surface",
            )}
            title="Create your own 3D teacher avatar"
          >
            Create yours
          </a>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isGeneratingModel && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-accent-text motion-safe:animate-pulse">
              <span className="size-1.5 rounded-full bg-accent motion-safe:animate-ping" />
              Generating…
            </span>
          )}
          <Button variant="ghost" onClick={onClear} className="px-3 text-body">
            {inCourse ? "Exit course" : "Clear"}
          </Button>
        </div>
      </div>

      {/* Licence credit for third-party avatars (CC BY) — sits with the switcher
          because this panel is on screen whenever the avatar is. `!text-muted`
          because AvatarCredit joins its classes without cn(), and its own
          brown-muted is 4.1:1 on this bar over a dark scene; muted is 5.3. */}
      <AvatarCredit avatar={teacher} className="-mt-1 px-1 !text-muted" />

      {/* Row 2: Environment switcher */}
      <div className="flex items-center gap-3">
        <span id="teacher-controls-room" className="shrink-0 text-xs font-semibold text-muted">Room</span>
        <div
          role="group"
          aria-labelledby="teacher-controls-room"
          className={cn(SHAPE.control, "flex items-center gap-1 bg-sunk p-1")}
        >
          {ENVIRONMENTS.map((e) => (
            <button
              key={e.value}
              onClick={() => setClassroom(e.value)}
              onMouseEnter={() => preloadClassroom(e.value)}
              aria-pressed={classroom === e.value}
              className={segmentClass(classroom === e.value)}
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 3: Course progress (only when in a course) */}
      {inCourse && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="max-w-[60%] truncate text-xs font-semibold text-ink">
              {course.title}
            </span>
            <span className="text-xs tabular-nums text-muted">
              Topic {topicNum} of {topicTotal}
            </span>
          </div>
          <p className="truncate text-xs font-semibold text-body">{topicName}</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-sunk">
            <div
              className="h-full rounded-full bg-accent transition-all duration-slow ease-out-soft"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
