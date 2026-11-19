/**
 * Source credits: which reference sources grounded a lesson, and how they
 * are shown. The lesson payload carries LessonSource[]; SourceCredit renders
 * it; /credits lists every ready source.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getLicence } from "./licences";

export interface LessonSource {
  id:          string;
  title:       string;
  publisher:   string;
  licenceId:   string;
  licenceName: string;
  licenceUrl:  string | null;
  attribution: string | null;
}

export interface SourceRow {
  id:               string;
  title:            string;
  publisher:        string;
  licence_id:       string;
  licence_url:      string | null;
  attribution_text: string | null;
  status?:          string;
}

export function toLessonSource(row: SourceRow): LessonSource {
  const licence = getLicence(row.licence_id);
  return {
    id:          row.id,
    title:       row.title,
    publisher:   row.publisher,
    licenceId:   row.licence_id,
    licenceName: licence?.name ?? row.licence_id,
    licenceUrl:  row.licence_url ?? licence?.url ?? null,
    attribution: row.attribution_text,
  };
}

/** Distinct source ids, in order of first use. */
export function distinctSourceIds(chunks: Array<{ sourceId: string | null }>): string[] {
  const seen = new Set<string>();
  for (const c of chunks) if (c.sourceId) seen.add(c.sourceId);
  return [...seen];
}

/**
 * The credit text for a list of sources, or null when there is nothing to
 * credit: "Based on <title>, <publisher>, <licence>". With several sources
 * the first is named and the rest are counted.
 */
export function creditLine(sources: LessonSource[] | undefined | null): string | null {
  if (!sources || sources.length === 0) return null;
  const [first, ...rest] = sources;
  const parts = [first.title, first.publisher];
  if (first.licenceId !== "own") parts.push(first.licenceName);
  const more = rest.length > 0 ? ` and ${rest.length} more` : "";
  return `Based on ${parts.join(", ")}${more}`;
}

/** Looks up the sources behind the chunks a lesson used. Best effort. */
export async function loadLessonSources(
  service: SupabaseClient,
  chunks:  Array<{ sourceId: string | null }>,
): Promise<LessonSource[]> {
  const ids = distinctSourceIds(chunks);
  if (ids.length === 0) return [];
  try {
    const { data, error } = await service
      .from("reference_sources")
      .select("id, title, publisher, licence_id, licence_url, attribution_text, status")
      .in("id", ids)
      .eq("status", "ready");
    if (error || !data) return [];
    const rows = data as SourceRow[];
    return ids
      .map((id) => rows.find((r) => r.id === id))
      .filter((r): r is SourceRow => !!r)
      .map(toLessonSource);
  } catch {
    return [];
  }
}
