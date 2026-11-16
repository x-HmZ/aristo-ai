/**
 * Onboarding subjects come from published courses, not a hardcoded list.
 * Pure functions so they can be tested from fixtures.
 */

import { z } from "zod";

export interface CourseRow {
  domain:    string;
  title:     string;
  structure: unknown;
}

export interface Subject {
  domain:       string;
  title:        string;
  conceptCount: number;
}

function conceptIds(structure: unknown): string[] {
  const modules = (structure as { modules?: Array<{ lessons?: Array<{ concept_ids?: unknown }> }> } | null)?.modules;
  if (!Array.isArray(modules)) return [];
  const ids: string[] = [];
  for (const m of modules) {
    for (const l of m.lessons ?? []) {
      if (Array.isArray(l.concept_ids)) ids.push(...l.concept_ids.filter((x): x is string => typeof x === "string"));
    }
  }
  return ids;
}

/** One entry per domain. Rows are expected newest first; the first title wins. Empty courses are skipped. */
export function subjectsFromCourses(rows: CourseRow[]): Subject[] {
  const byDomain = new Map<string, { title: string; ids: Set<string> }>();
  for (const r of rows) {
    const ids = conceptIds(r.structure);
    if (ids.length === 0 || !r.domain) continue;
    const entry = byDomain.get(r.domain) ?? { title: r.title, ids: new Set<string>() };
    ids.forEach((i) => entry.ids.add(i));
    byDomain.set(r.domain, entry);
  }
  return [...byDomain.entries()].map(([domain, v]) => ({ domain, title: v.title, conceptCount: v.ids.size }));
}

export const onboardingBodySchema = z.object({
  goal:               z.enum(["learn_from_scratch", "fill_gaps", "exam_prep", "refresher"]),
  daily_time_minutes: z.coerce.number().int().min(5).max(480).default(20),
  domain:             z.string().min(1).max(100),
});

export function isOfferedDomain(domain: string, subjects: Subject[]): boolean {
  return subjects.some((s) => s.domain === domain);
}
