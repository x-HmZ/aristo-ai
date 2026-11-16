"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bot } from "lucide-react";
import type { TeacherAvatar } from "@/store/useAristoStore";
import { AVATAR_ASSETS } from "@/components/three/Teacher";
import { Button } from "@/components/ui/button";
import { FOCUS } from "@/lib/design/shape";
import {
  AI_NOTICE_STORAGE_KEY,
  aiFirstLessonNotice,
  aiTeacherStatement,
  disclosureName,
} from "@/lib/legal/aiDisclosure";

/** The active teacher's name, or a neutral word for the custom teacher. */
function useTeacherName(teacher: TeacherAvatar): string {
  if (teacher === "custom") return disclosureName(null);
  return disclosureName(AVATAR_ASSETS[teacher]?.label);
}

/**
 * Persistent, quiet label: it sits in the panel header beside the teacher switcher on /learn and /demo, takes one line
 * of small text, and is plain text in the reading order so a screen reader meets it with the teacher controls.
 */
export function AiTeacherLabel({ teacher, className = "" }: { teacher: TeacherAvatar; className?: string }) {
  const name = useTeacherName(teacher);
  return (
    <p className={`flex items-center gap-1.5 px-1 text-xs leading-snug text-muted ${className}`}>
      <Bot aria-hidden className="size-3.5 shrink-0" />
      <span>{aiTeacherStatement(name)}</span>
    </p>
  );
}

/**
 * One-time notice before the first lesson on this device: the same statement, a link to the parent page, and a button
 * that dismisses it for good. It is a block in the panel header, not an overlay, so it never covers the lesson controls.
 * If storage is unavailable it shows every visit rather than failing.
 */
export function AiFirstLessonNotice({ teacher }: { teacher: TeacherAvatar }) {
  const name = useTeacherName(teacher);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(AI_NOTICE_STORAGE_KEY) !== "1") setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  if (!open) return null;

  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(AI_NOTICE_STORAGE_KEY, "1");
    } catch {
      /* storage blocked: the notice returns next visit */
    }
  };

  return (
    <div
      role="region"
      aria-label="About your AI teacher"
      className="flex flex-col gap-1.5 rounded-[10px] border border-tint-line bg-tint px-3 py-2 text-xs leading-snug text-body"
    >
      <p>{aiFirstLessonNotice(name)}</p>
      <div className="flex flex-wrap items-center gap-x-3">
        <Link
          href="/parents"
          target="_blank"
          rel="noopener"
          className={`inline-flex min-h-[44px] items-center rounded-sm underline decoration-dotted underline-offset-2 hover:text-ink ${FOCUS}`}
        >
          Information for parents
        </Link>
        <Button variant="ghost" onClick={dismiss} className="px-3 text-body">
          Got it
        </Button>
      </div>
    </div>
  );
}
