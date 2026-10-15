import { ACTIVE_TEACHERS } from "@/store/useAristoStore";

type ActiveTeacher = (typeof ACTIVE_TEACHERS)[number];

/**
 * The teachers /demo offers: those with narration recorded in their own voice (public/demo/<slug>/ holds one set,
 * Jake's). MJ would speak in a man's voice, which reads as a bug, so she waits for her own set (state.md, Next);
 * add her here when it exists and the switcher and ?teacher= follow.
 */
export const DEMO_TEACHERS: readonly ActiveTeacher[] = ["jake"];

/**
 * The teacher a visitor chose on the landing (V8.3c: Try a lesson links to `/demo?teacher=mj`). Only a teacher the
 * demo offers is taken from the URL; anything else, or no parameter, is the demo's own default.
 */
export function demoTeacherFrom(search: string, fallback: ActiveTeacher, offered: readonly ActiveTeacher[] = DEMO_TEACHERS): ActiveTeacher {
  const asked = new URLSearchParams(search).get("teacher");
  return (offered as readonly string[]).includes(asked ?? "") ? (asked as ActiveTeacher) : fallback;
}
