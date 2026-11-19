import { describe, expect, it } from "vitest";
import {
  buildExport,
  deleteAccount,
  deleteRequestSchema,
  EXPORT_ACCOUNT_TABLES,
  EXPORT_USER_TABLES,
  LEARNER_TABLES_IN_DELETE_ORDER,
  type DeletionStore,
  type ExportStore,
} from "./leaving";

describe("export table list", () => {
  it("covers every table that holds the user's rows", () => {
    const names = [...EXPORT_USER_TABLES, ...EXPORT_ACCOUNT_TABLES].map((t) => t.table);
    for (const t of [
      "profiles", "learner_profiles", "user_concept_mastery", "user_course_progress", "user_misconceptions",
      "session_logs", "quiz_attempts", "consents", "account_members", "usage_events", "accounts", "subscriptions", "usage_counters",
    ]) {
      expect(names).toContain(t);
    }
  });

  it("never reads the audit log (other people's admin data)", () => {
    expect([...EXPORT_USER_TABLES, ...EXPORT_ACCOUNT_TABLES].map((t) => t.table)).not.toContain("admin_audit_log");
  });
});

describe("buildExport", () => {
  function store(overrides: Partial<ExportStore> = {}, log: string[] = []): ExportStore {
    return {
      authUser: async () => ({ email: "a@example.com", created_at: "2026-01-01" }),
      rows: async (table, column, value) => {
        log.push(`${table}:${column}:${value}`);
        return [{ table }];
      },
      ownedAccountIds: async () => ["acc1"],
      ...overrides,
    };
  }

  it("reads only rows of the given user and their own account", async () => {
    const log: string[] = [];
    const out = await buildExport(store({}, log), "u1", new Date("2026-11-16T00:00:00Z"));
    expect(out.user_id).toBe("u1");
    expect(out.email).toBe("a@example.com");
    expect(Object.keys(out.tables)).toContain("quiz_attempts");
    expect(log.filter((l) => l.startsWith("quiz_attempts"))).toEqual(["quiz_attempts:user_id:u1"]);
    expect(log).toContain("subscriptions:account_id:acc1");
    expect(out.unavailable).toEqual([]);
  });

  it("lists a table it could not read instead of failing", async () => {
    const out = await buildExport(
      store({
        rows: async (table) => {
          if (table === "consents") throw new Error("missing");
          return [];
        },
      }),
      "u1",
    );
    expect(out.unavailable).toEqual(["consents"]);
    expect(out.tables.quiz_attempts).toEqual([]);
  });
});

function deletionStore(over: Partial<DeletionStore> = {}, log: string[] = []): DeletionStore {
  const rec = (name: string) => async () => {
    log.push(name);
  };
  return {
    isPlatformAdmin: async () => false,
    activeSubscriptionCount: async () => 0,
    markDeleted: rec("markDeleted"),
    scrubUsageEvents: rec("scrubUsageEvents"),
    scrubAuditLog: rec("scrubAuditLog"),
    deleteConsents: rec("deleteConsents"),
    deleteLearnerRows: async (table) => {
      log.push(`learner:${table}`);
    },
    deleteOwnedFamilyAccountIfAlone: async () => {
      log.push("deleteAccount");
      return true;
    },
    deleteAuthUser: rec("deleteAuthUser"),
    ...over,
  };
}

describe("deleteAccount", () => {
  it("runs in order: marker, scrubs, rows, account, auth user last", async () => {
    const log: string[] = [];
    expect(await deleteAccount(deletionStore({}, log), "u1")).toEqual({ ok: true });
    expect(log).toEqual([
      "markDeleted",
      "scrubUsageEvents",
      "scrubAuditLog",
      "deleteConsents",
      ...LEARNER_TABLES_IN_DELETE_ORDER.map((t) => `learner:${t}`),
      "deleteAccount",
      "deleteAuthUser",
    ]);
  });

  it("tells the owner of an active subscription to cancel billing and deletes nothing", async () => {
    const log: string[] = [];
    const r = await deleteAccount(deletionStore({ activeSubscriptionCount: async () => 1 }, log), "u1");
    expect(r).toMatchObject({ ok: false, code: "active_subscription" });
    expect(log).toEqual([]);
  });

  it("refuses a platform admin and deletes nothing", async () => {
    const log: string[] = [];
    const r = await deleteAccount(deletionStore({ isPlatformAdmin: async () => true }, log), "u1");
    expect(r).toMatchObject({ ok: false, code: "admin" });
    expect(log).toEqual([]);
  });

  it("stops without deleting the auth user when a step fails", async () => {
    const log: string[] = [];
    const r = await deleteAccount(
      deletionStore({ deleteConsents: async () => { throw new Error("boom"); } }, log),
      "u1",
    );
    expect(r).toMatchObject({ ok: false, code: "failed" });
    expect(log).toContain("markDeleted");
    expect(log).not.toContain("deleteAuthUser");
  });

  it("requires the typed confirmation", () => {
    expect(deleteRequestSchema.safeParse({ confirm: "DELETE" }).success).toBe(true);
    expect(deleteRequestSchema.safeParse({ confirm: "delete" }).success).toBe(false);
    expect(deleteRequestSchema.safeParse({}).success).toBe(false);
  });
});
