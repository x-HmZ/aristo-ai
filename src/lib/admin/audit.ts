/**
 * Admin audit logger.
 *
 * Every mutating /api/admin/* route should call `logAdminAction()` after
 * a successful write. Writes are fire-and-forget — failures are logged
 * to the server console but do NOT block the caller's response. The
 * admin_audit_log table has service-role-only RLS policies (migration
 * 012), so we always use the service client.
 *
 * Schema reminder (012_audit_log.sql):
 *   id, actor_id, actor_email, action, target_type, target_id,
 *   diff (JSONB), ip, user_agent, created_at
 */

import type { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export interface AuditEntry {
  actorId: string;
  actorEmail?: string | null;
  /** Dot-namespaced action, e.g. "course.publish" | "user.promote_admin" */
  action: string;
  /** Logical target type. Examples: "course" | "user" | "concept" | "chunk" */
  targetType?: string;
  /** Stringified target id. Concept ids aren't UUIDs, so TEXT in the DB. */
  targetId?: string | number | null;
  /** Free-form diff. Convention: { before, after } for updates, { params } for actions. */
  diff?: Record<string, unknown>;
  /** Optional request used to capture IP + user-agent. */
  request?: NextRequest | Request;
}

export async function logAdminAction(entry: AuditEntry): Promise<void> {
  try {
    const service = createServiceClient();

    let ip: string | null = null;
    let userAgent: string | null = null;
    if (entry.request) {
      const headers = entry.request.headers;
      ip =
        headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        headers.get("x-real-ip") ??
        null;
      userAgent = headers.get("user-agent");
    }

    await service.from("admin_audit_log").insert({
      actor_id: entry.actorId,
      actor_email: entry.actorEmail ?? null,
      action: entry.action,
      target_type: entry.targetType ?? null,
      target_id:
        entry.targetId === undefined || entry.targetId === null
          ? null
          : String(entry.targetId),
      diff: entry.diff ?? {},
      ip,
      user_agent: userAgent,
    });
  } catch (err) {
    // Never throw — auditing must not break the underlying request.
    console.error("[audit] failed to write audit entry", err);
  }
}
