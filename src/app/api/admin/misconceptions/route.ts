/**
 * GET /api/admin/misconceptions
 *
 * Aggregates user_misconceptions across all learners:
 *   - group by (concept_id, misconception text)
 *   - report total occurrence_count, distinct user count, last_seen,
 *     resolved/unresolved split
 *
 * Query: ?domain=&resolved=true|false
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient }       from "@/lib/supabase/server";
import { verifyAdmin }               from "@/lib/admin/auth";

interface AggregateRow {
  concept_id:        string;
  concept_name:      string | null;
  domain:            string | null;
  misconception:     string;
  occurrence_count:  number;     // sum across users
  user_count:        number;     // distinct users
  resolved_count:    number;     // distinct users with resolved=true
  last_seen:         string | null;
  ids:               string[];   // raw row ids — for bulk mark-resolved
}

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url    = new URL(req.url);
  const domain = url.searchParams.get("domain")?.trim() ?? "";
  const resolvedFilter = url.searchParams.get("resolved");
  const includeResolved = resolvedFilter !== "false";
  const onlyResolved    = resolvedFilter === "true";

  const service = createServiceClient();

  let query = service
    .from("user_misconceptions")
    .select(
      "id, user_id, concept_id, misconception, occurrence_count, last_detected, resolved, concepts!user_misconceptions_concept_id_fkey(name, domain)",
      { count: "exact" }
    )
    .order("last_detected", { ascending: false })
    .limit(5000);

  if (!includeResolved) query = query.eq("resolved", false);
  if (onlyResolved)     query = query.eq("resolved", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = {
    id:               string;
    user_id:          string;
    concept_id:       string;
    misconception:    string;
    occurrence_count: number;
    last_detected:    string | null;
    resolved:         boolean;
    concepts: { name: string | null; domain: string | null } | { name: string | null; domain: string | null }[] | null;
  };

  const rows = (data ?? []) as Row[];

  // Optional domain filter (post-join)
  const filtered = domain
    ? rows.filter((r) => {
        const c = Array.isArray(r.concepts) ? r.concepts[0] : r.concepts;
        return c?.domain === domain;
      })
    : rows;

  // Aggregate by (concept_id, misconception)
  const agg = new Map<string, AggregateRow>();
  for (const r of filtered) {
    const key = `${r.concept_id}::${r.misconception}`;
    const c   = Array.isArray(r.concepts) ? r.concepts[0] : r.concepts;
    if (!agg.has(key)) {
      agg.set(key, {
        concept_id:       r.concept_id,
        concept_name:     c?.name ?? null,
        domain:           c?.domain ?? null,
        misconception:    r.misconception,
        occurrence_count: 0,
        user_count:       0,
        resolved_count:   0,
        last_seen:        null,
        ids:              [],
      });
    }
    const a = agg.get(key)!;
    a.occurrence_count += r.occurrence_count;
    a.user_count       += 1;
    if (r.resolved) a.resolved_count += 1;
    if (r.last_detected && (!a.last_seen || r.last_detected > a.last_seen)) {
      a.last_seen = r.last_detected;
    }
    a.ids.push(r.id);
  }

  // Surface most-active misconceptions first
  const rowsOut = Array.from(agg.values()).sort(
    (a, b) => b.occurrence_count - a.occurrence_count
  );

  // Distinct domains in current result
  const domains = Array.from(
    new Set(rowsOut.map((r) => r.domain).filter(Boolean))
  ) as string[];

  return NextResponse.json({
    rows: rowsOut,
    domains: domains.sort(),
    total_unresolved: rowsOut.reduce((s, r) => s + (r.user_count - r.resolved_count), 0),
    total_resolved:   rowsOut.reduce((s, r) => s + r.resolved_count, 0),
  });
}
