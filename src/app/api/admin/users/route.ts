/**
 * GET /api/admin/users
 *
 * Admin-only. Lists profiles joined with their dynamic learner profile.
 * Supports search by email + filter by expertise + pagination.
 *
 * Query: ?search=&expertise=&page=1&limit=50
 * Returns: { users, total, page, limit }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient }       from "@/lib/supabase/server";
import { verifyAdmin }               from "@/lib/admin/auth";

export interface AdminUserRow {
  id:                  string;
  email:               string | null;
  full_name:           string | null;
  goal:                string | null;
  daily_time_minutes:  number | null;
  is_admin:            boolean;
  approval_status:     "pending" | "approved" | "rejected";
  approved_at:         string | null;
  created_at:          string;
  expertise_level:     string | null;
  pace:                string | null;
  engagement_pattern:  string | null;
  /** A summary of activity, joined client-side from quiz_attempts. */
  last_quiz_at?:       string | null;
  quiz_attempt_count?: number;
}

export async function GET(req: NextRequest) {
  const user = await verifyAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url       = new URL(req.url);
  const search    = url.searchParams.get("search")?.trim().toLowerCase() ?? "";
  const expertise = url.searchParams.get("expertise") ?? "";
  const status    = url.searchParams.get("status") ?? "";
  const page      = Math.max(1, parseInt(url.searchParams.get("page")  ?? "1", 10));
  const limit     = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10)));
  const offset    = (page - 1) * limit;

  const service = createServiceClient();

  // If a search term is provided, we need to find matching IDs by email FIRST
  // (auth.users.email isn't reachable from public.profiles) so we can include
  // email matches alongside full_name matches in a single profile query.
  let emailMatchIds: string[] = [];
  if (search) {
    const { data: authList } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    emailMatchIds = (authList?.users ?? [])
      .filter((u) => (u.email ?? "").toLowerCase().includes(search))
      .map((u) => u.id);
  }

  // Profiles base query (full table, sortable, paginated).
  let profileQuery = service
    .from("profiles")
    .select(
      "id, full_name, goal, daily_time_minutes, is_admin, approval_status, approved_at, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (status === "pending" || status === "approved" || status === "rejected") {
    profileQuery = profileQuery.eq("approval_status", status);
  }

  if (search) {
    // OR clause: name ILIKE %term% OR id IN (email-matching ids).
    // PostgREST .or() syntax requires comma-separated filters, with `in` taking a
    // parenthesized list. If no emails match, fall back to name-only ilike.
    if (emailMatchIds.length > 0) {
      const idList = emailMatchIds.map((id) => `"${id}"`).join(",");
      profileQuery = profileQuery.or(`full_name.ilike.%${search}%,id.in.(${idList})`);
    } else {
      profileQuery = profileQuery.ilike("full_name", `%${search}%`);
    }
  }

  const { data: profiles, count, error } = await profileQuery.range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (profiles ?? []).map((p) => p.id);

  // Parallel fetches for the joined info
  const [
    { data: learnerProfiles },
    { data: authUsers },
    { data: quizCounts },
  ] = await Promise.all([
    service
      .from("learner_profiles")
      .select("user_id, expertise_level, pace, engagement_pattern")
      .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    // We need email; in supabase-js v2 admin API lets us list users.
    // For a small page (limit ≤ 200) this is fine; for huge pages, switch to
    // an RPC join.
    service.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    service
      .from("quiz_attempts")
      .select("user_id, created_at")
      .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false }),
  ]);

  const learnerMap = new Map<string, { expertise_level: string | null; pace: string | null; engagement_pattern: string | null }>();
  for (const lp of (learnerProfiles ?? []) as Array<{
    user_id: string;
    expertise_level: string | null;
    pace: string | null;
    engagement_pattern: string | null;
  }>) {
    learnerMap.set(lp.user_id, lp);
  }

  const emailMap = new Map<string, string | null>();
  for (const u of (authUsers?.users ?? [])) {
    emailMap.set(u.id, u.email ?? null);
  }

  const quizSummary = new Map<string, { last_quiz_at: string; count: number }>();
  for (const qa of (quizCounts ?? []) as Array<{ user_id: string; created_at: string }>) {
    const cur = quizSummary.get(qa.user_id);
    if (!cur) {
      quizSummary.set(qa.user_id, { last_quiz_at: qa.created_at, count: 1 });
    } else {
      cur.count += 1;
    }
  }

  let rows: AdminUserRow[] = (profiles ?? []).map((p) => {
    const lp = learnerMap.get(p.id);
    const qs = quizSummary.get(p.id);
    return {
      id:                 p.id,
      email:              emailMap.get(p.id) ?? null,
      full_name:          p.full_name,
      goal:               p.goal,
      daily_time_minutes: p.daily_time_minutes,
      is_admin:           p.is_admin,
      approval_status:    (p.approval_status ?? "pending") as AdminUserRow["approval_status"],
      approved_at:        p.approved_at ?? null,
      created_at:         p.created_at,
      expertise_level:    lp?.expertise_level     ?? null,
      pace:               lp?.pace                ?? null,
      engagement_pattern: lp?.engagement_pattern  ?? null,
      last_quiz_at:       qs?.last_quiz_at        ?? null,
      quiz_attempt_count: qs?.count               ?? 0,
    };
  });

  // Post-filter by expertise + email-substring search (search applied to
  // both full_name above and email here so users without a full_name still
  // match by email).
  if (search) {
    rows = rows.filter((r) =>
      (r.full_name ?? "").toLowerCase().includes(search) ||
      (r.email     ?? "").toLowerCase().includes(search)
    );
  }
  if (expertise) {
    rows = rows.filter((r) => r.expertise_level === expertise);
  }

  return NextResponse.json({
    users: rows,
    total: count ?? rows.length,
    page,
    limit,
  });
}
