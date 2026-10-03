/**
 * The landing's teacher (V8.3c): the reader picks Jake or MJ in the hero, and every section, every poster and Try a
 * lesson follow. Kept for the tab in sessionStorage; `_document.tsx` puts it on `<html data-teacher>` before the first
 * paint so the right posters paint first. `?teacher=` (the stills and probes) wins over the stored choice.
 */
export const LANDING_TEACHERS = ["jake", "mj"] as const;
export type LandingTeacher = (typeof LANDING_TEACHERS)[number];
export const TEACHER_KEY = "aristo-landing-teacher";
export const TEACHER_NAME: Record<LandingTeacher, string> = { jake: "Jake", mj: "MJ" };

export const isLandingTeacher = (v: unknown): v is LandingTeacher =>
  typeof v === "string" && (LANDING_TEACHERS as readonly string[]).includes(v);

/** The query's teacher if it names one, else the stored one, else Jake. */
export function pickTeacher(query: string | null, stored: string | null): LandingTeacher {
  if (isLandingTeacher(query)) return query;
  if (isLandingTeacher(stored)) return stored;
  return "jake";
}

let current: LandingTeacher | null = null;
const listeners = new Set<() => void>();

function initial(): LandingTeacher {
  if (typeof window === "undefined") return "jake";
  let stored: string | null = null;
  try { stored = window.sessionStorage.getItem(TEACHER_KEY); } catch { /* storage blocked: Jake */ }
  return pickTeacher(new URLSearchParams(window.location.search).get("teacher"), stored);
}

export function getTeacher(): LandingTeacher {
  current ??= initial();
  return current;
}

export const getServerTeacher = (): LandingTeacher => "jake";

export function setTeacher(t: LandingTeacher): void {
  if (getTeacher() === t) return;
  current = t;
  try { window.sessionStorage.setItem(TEACHER_KEY, t); } catch { /* not kept: fine */ }
  document.documentElement.dataset.teacher = t;
  for (const l of listeners) l();
}

export function subscribeTeacher(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/**
 * The reader is about to choose `t` (a pointer over, or focus on, its chip): the stage loads and warms that teacher
 * before the click, so the switch has nothing to fetch or compile (LandingStage Prewarm). Main bundle side: no three.js.
 */
let leaning: LandingTeacher | null = null;
const leanListeners = new Set<() => void>();
export function leanTowards(t: LandingTeacher): void {
  if (leaning === t) return;
  leaning = t;
  for (const l of leanListeners) l();
}
export const getLeaning = (): LandingTeacher | null => leaning;
export function subscribeLeaning(l: () => void): () => void {
  leanListeners.add(l);
  return () => { leanListeners.delete(l); };
}

/**
 * Put the landing's teacher on `<html data-teacher>` before the first paint (`_document.tsx`), so the chosen teacher's
 * posters are the ones that load and paint. The same rule as `pickTeacher`: the query, then the stored choice; only
 * the two names are ever written.
 */
export const TEACHER_INIT_SCRIPT = `try{var q=new URLSearchParams(location.search).get("teacher"),t=q==="jake"||q==="mj"?q:sessionStorage.getItem("${TEACHER_KEY}");if(t==="jake"||t==="mj")document.documentElement.setAttribute("data-teacher",t)}catch(e){}`;

/** Try a lesson with the chosen teacher (DemoClient reads `?teacher=`). */
export const demoHref = (t: LandingTeacher): string => (t === "jake" ? "/demo" : `/demo?teacher=${t}`);
