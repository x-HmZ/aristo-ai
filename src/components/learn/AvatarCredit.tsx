"use client";

import type { TeacherAvatar } from "@/store/useAristoStore";
import { AVATAR_ASSETS } from "@/components/three/Teacher";

/**
 * Attribution line for a third-party teacher model, shown wherever that
 * avatar is on screen.
 *
 * CC BY 4.0 requires the title, the author, a link to the source, the licence
 * and a note that the work was changed, placed where people meet the work.
 * The avatar is the work, so the credit sits next to it (the classroom panel,
 * the demo) rather than on a credits page nobody opens. Renders nothing for
 * avatars that need no credit.
 */
export function AvatarCredit({ avatar, className = "" }: { avatar: TeacherAvatar; className?: string }) {
  if (avatar === "custom") return null;
  const credit = AVATAR_ASSETS[avatar]?.credit;
  if (!credit) return null;

  const link = "underline decoration-dotted underline-offset-2 hover:text-[#3D2110]";
  return (
    <p className={`text-[10px] leading-snug text-[#8B6E5A] ${className}`}>
      Teacher model:{" "}
      <a href={credit.sourceUrl} target="_blank" rel="noopener noreferrer" className={link}>
        &ldquo;{credit.title}&rdquo;
      </a>{" "}
      by{" "}
      <a href={credit.authorUrl} target="_blank" rel="noopener noreferrer" className={link}>
        {credit.author}
      </a>
      ,{" "}
      <a href={credit.licenseUrl} target="_blank" rel="license noopener noreferrer" className={link}>
        {credit.license}
      </a>
      {credit.modified ? ", modified" : ""}
    </p>
  );
}
