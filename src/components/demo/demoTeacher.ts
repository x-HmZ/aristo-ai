import { ACTIVE_TEACHERS } from "@/store/useAristoStore";

type ActiveTeacher = (typeof ACTIVE_TEACHERS)[number];

/**
 * The teacher a visitor chose on the landing (V8.3c: Try a lesson links to `/demo?teacher=mj`). Only an offered
 * teacher is taken from the URL; anything else, or no parameter, is the demo's own default.
 */
export function demoTeacherFrom(search: string, fallback: ActiveTeacher): ActiveTeacher {
  const asked = new URLSearchParams(search).get("teacher");
  return (ACTIVE_TEACHERS as readonly string[]).includes(asked ?? "") ? (asked as ActiveTeacher) : fallback;
}
