/**
 * Leaving: "Download my data" and "Delete my account".
 *
 * The orchestration is written against small store interfaces so it can be tested without a database; the
 * Supabase-backed stores are at the bottom (service role, server only). Callers must already have checked that
 * the request is from the signed-in user and pass THEIR OWN id and nothing else.
 */

import { z } from "zod";

// ── What the user's own data is, table by table ─────────────────────────────────────────────────────────────
// Source: the data inventory in .claude/plans/launch/findings/compliance.md (3.1) and the migrations.
// Tables keyed by the user id. Rows are exported with select("*").
export const EXPORT_USER_TABLES = [
  { table: "profiles", column: "id" }, // 005, 015, 025: name, goal, flags, learner fields, switches
  { table: "learner_profiles", column: "user_id" }, // 006, 011: behavioural profile, custom teacher URL
  { table: "user_concept_mastery", column: "user_id" }, // 006
  { table: "user_course_progress", column: "user_id" }, // 006
  { table: "user_misconceptions", column: "user_id" }, // 006
  { table: "session_logs", column: "user_id" }, // 006
  { table: "quiz_attempts", column: "user_id" }, // 006: includes free-text answers
  { table: "consents", column: "user_id" }, // 025
  { table: "account_members", column: "user_id" }, // 021
  { table: "usage_events", column: "user_id" }, // 013: LLM calls attributed to the user
] as const;

// Tables keyed by the family account the user owns.
export const EXPORT_ACCOUNT_TABLES = [
  { table: "accounts", column: "id" }, // 021
  { table: "subscriptions", column: "account_id" }, // 021
  { table: "usage_counters", column: "account_id" }, // 021
] as const;

/** Learner tables removed explicitly during deletion (they also cascade from the profile). Child rows first. */
export const LEARNER_TABLES_IN_DELETE_ORDER = [
  "quiz_attempts",
  "session_logs",
  "user_misconceptions",
  "user_concept_mastery",
  "user_course_progress",
  "learner_profiles",
] as const;

export interface ExportStore {
  authUser(userId: string): Promise<{ email: string | null; created_at: string | null } | null>;
  /** Rows of `table` where `column` equals the id. Throws on a database error. */
  rows(table: string, column: string, value: string): Promise<unknown[]>;
  /** Ids of the family accounts the user owns. */
  ownedAccountIds(userId: string): Promise<string[]>;
}

export interface UserExport {
  exported_at: string;
  user_id: string;
  email: string | null;
  account_created_at: string | null;
  tables: Record<string, unknown[]>;
  /** Tables that could not be read (for example a migration not applied). Empty when everything was read. */
  unavailable: string[];
}

export async function buildExport(store: ExportStore, userId: string, now: Date = new Date()): Promise<UserExport> {
  const auth = await store.authUser(userId);
  const tables: Record<string, unknown[]> = {};
  const unavailable: string[] = [];

  async function take(table: string, column: string, value: string) {
    try {
      tables[table] = await store.rows(table, column, value);
    } catch {
      unavailable.push(table);
    }
  }

  for (const t of EXPORT_USER_TABLES) await take(t.table, t.column, userId);

  let accountIds: string[] = [];
  try {
    accountIds = await store.ownedAccountIds(userId);
  } catch {
    unavailable.push("accounts");
  }
  for (const t of EXPORT_ACCOUNT_TABLES) {
    if (accountIds.length === 0) {
      tables[t.table] = [];
      continue;
    }
    const merged: unknown[] = [];
    try {
      for (const id of accountIds) merged.push(...(await store.rows(t.table, t.column, id)));
      tables[t.table] = merged;
    } catch {
      unavailable.push(t.table);
    }
  }

  return {
    exported_at: now.toISOString(),
    user_id: userId,
    email: auth?.email ?? null,
    account_created_at: auth?.created_at ?? null,
    tables,
    unavailable,
  };
}

// ── Deletion ────────────────────────────────────────────────────────────────────────────────────────────────

export interface DeletionStore {
  isPlatformAdmin(userId: string): Promise<boolean>;
  /** Subscriptions of the user's owned accounts that are not canceled. */
  activeSubscriptionCount(userId: string): Promise<number>;
  markDeleted(userId: string, at: Date): Promise<void>;
  /** Free text (metadata) of the user's usage_events is emptied; the anonymous cost columns stay. */
  scrubUsageEvents(userId: string): Promise<void>;
  /** The user's name, ip and user agent are removed from audit rows that name them as the target. */
  scrubAuditLog(userId: string): Promise<void>;
  deleteConsents(userId: string): Promise<void>;
  deleteLearnerRows(table: string, userId: string): Promise<void>;
  /** Deletes the family account the user owns when they are its only member. Returns whether it did. */
  deleteOwnedFamilyAccountIfAlone(userId: string): Promise<boolean>;
  deleteAuthUser(userId: string): Promise<void>;
}

export type DeletionResult =
  | { ok: true }
  | { ok: false; code: "admin" | "active_subscription" | "failed"; message: string };

export async function deleteAccount(store: DeletionStore, userId: string, now: Date = new Date()): Promise<DeletionResult> {
  try {
    if (await store.isPlatformAdmin(userId)) {
      return { ok: false, code: "admin", message: "An administrator account cannot be deleted from here." };
    }
    if ((await store.activeSubscriptionCount(userId)) > 0) {
      return {
        ok: false,
        code: "active_subscription",
        message: "This account has a paid subscription. Cancel billing first, then delete the account.",
      };
    }
    // First write: a marker the access gate respects, so a deletion that stops half-way leaves a locked account.
    await store.markDeleted(userId, now);
    // Scrub before the user row goes: usage_events.user_id is set to NULL on delete, which would orphan the text.
    await store.scrubUsageEvents(userId);
    await store.scrubAuditLog(userId);
    await store.deleteConsents(userId);
    for (const table of LEARNER_TABLES_IN_DELETE_ORDER) await store.deleteLearnerRows(table, userId);
    await store.deleteOwnedFamilyAccountIfAlone(userId);
    await store.deleteAuthUser(userId);
    return { ok: true };
  } catch (e) {
    console.error("[account delete] failed:", e instanceof Error ? e.message : "unknown");
    return { ok: false, code: "failed", message: "We could not finish deleting the account. Please try again, or contact us." };
  }
}

/** Body of the delete request: the user must type DELETE. */
export const deleteRequestSchema = z.object({ confirm: z.literal("DELETE") });

// ── Supabase-backed stores (service role) ───────────────────────────────────────────────────────────────────

type Service = ReturnType<typeof import("@/lib/supabase/server").createServiceClient>;

function check(error: { code?: string; message?: string } | null, what: string): void {
  if (error) throw new Error(`${what}: ${error.code ?? "error"}`);
}

export function supabaseExportStore(service: Service): ExportStore {
  return {
    async authUser(userId) {
      const { data } = await service.auth.admin.getUserById(userId);
      return data.user ? { email: data.user.email ?? null, created_at: data.user.created_at ?? null } : null;
    },
    async rows(table, column, value) {
      const { data, error } = await service.from(table).select("*").eq(column, value);
      check(error, `read ${table}`);
      return data ?? [];
    },
    async ownedAccountIds(userId) {
      const { data, error } = await service.from("accounts").select("id").eq("owner_user_id", userId);
      check(error, "read accounts");
      return (data ?? []).map((r: { id: string }) => r.id);
    },
  };
}

export function supabaseDeletionStore(service: Service): DeletionStore {
  async function ownedAccountIds(userId: string): Promise<string[]> {
    const { data, error } = await service.from("accounts").select("id").eq("owner_user_id", userId);
    check(error, "read accounts");
    return (data ?? []).map((r: { id: string }) => r.id);
  }
  return {
    async isPlatformAdmin(userId) {
      const { data, error } = await service.from("profiles").select("is_admin").eq("id", userId).maybeSingle();
      check(error, "read profile");
      return data?.is_admin === true;
    },
    async activeSubscriptionCount(userId) {
      const ids = await ownedAccountIds(userId);
      if (ids.length === 0) return 0;
      const { data, error } = await service.from("subscriptions").select("id").in("account_id", ids).neq("status", "canceled");
      check(error, "read subscriptions");
      return (data ?? []).length;
    },
    async markDeleted(userId, at) {
      const { error } = await service.from("profiles").update({ deleted_at: at.toISOString() }).eq("id", userId);
      check(error, "mark deleted");
    },
    async scrubUsageEvents(userId) {
      const { error } = await service.from("usage_events").update({ metadata: {} }).eq("user_id", userId);
      check(error, "scrub usage_events");
    },
    async scrubAuditLog(userId) {
      const { error } = await service
        .from("admin_audit_log")
        .update({ diff: {}, ip: null, user_agent: null })
        .eq("target_type", "user")
        .eq("target_id", userId);
      check(error, "scrub audit log");
    },
    async deleteConsents(userId) {
      const { error } = await service.from("consents").delete().eq("user_id", userId);
      check(error, "delete consents");
    },
    async deleteLearnerRows(table, userId) {
      const { error } = await service.from(table).delete().eq("user_id", userId);
      check(error, `delete ${table}`);
    },
    async deleteOwnedFamilyAccountIfAlone(userId) {
      const ids = await ownedAccountIds(userId);
      let deleted = false;
      for (const id of ids) {
        const { data, error } = await service.from("account_members").select("user_id").eq("account_id", id);
        check(error, "read members");
        const others = (data ?? []).filter((m: { user_id: string }) => m.user_id !== userId);
        if (others.length > 0) continue; // someone else is in it: it stays, owner_user_id becomes null
        const { error: delError } = await service.from("accounts").delete().eq("id", id).eq("kind", "family");
        check(delError, "delete account");
        deleted = true;
      }
      return deleted;
    },
    async deleteAuthUser(userId) {
      const { error } = await service.auth.admin.deleteUser(userId);
      check(error, "delete auth user");
    },
  };
}
