"use client";

import Link from "next/link";
import type { LessonSource } from "@/lib/rag/credits";
import { creditLine } from "@/lib/rag/credits";
import { FOCUS } from "@/lib/design/shape";

/**
 * Quiet one-line credit for the reference sources that grounded a lesson,
 * linked to /credits for the licence and full attribution. Renders nothing
 * when the lesson used no source.
 */
export function SourceCredit({ sources, className = "" }: { sources?: LessonSource[] | null; className?: string }) {
  const line = creditLine(sources);
  if (!line) return null;
  return (
    <p className={`text-[10px] leading-snug text-muted ${className}`}>
      <Link
        href="/credits"
        className={`underline decoration-dotted underline-offset-2 hover:text-ink rounded-sm ${FOCUS}`}
      >
        {line}
      </Link>
    </p>
  );
}
