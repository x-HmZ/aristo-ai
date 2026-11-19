import { describe, expect, it } from "vitest";
import { decideAccess, getAccessForUser, getAccessMode, type AccessInput } from "./access";

const base: AccessInput = {
  mode: "approval",
  profile: { is_admin: false, approval_status: "pending", account_holder: "self" },
  emailConfirmed: true,
  consentKinds: [],
};

describe("getAccessMode", () => {
  it("is approval unless exactly open", () => {
    expect(getAccessMode(undefined)).toBe("approval");
    expect(getAccessMode("")).toBe("approval");
    expect(getAccessMode("opn")).toBe("approval");
    expect(getAccessMode("true")).toBe("approval");
    expect(getAccessMode("open")).toBe("open");
    expect(getAccessMode(" OPEN ")).toBe("open");
  });
});

describe("approval mode (as today)", () => {
  it("allows approved, blocks pending and rejected", () => {
    expect(decideAccess({ ...base, profile: { approval_status: "approved" } })).toEqual({ allowed: true });
    expect(decideAccess(base)).toEqual({ allowed: false, reason: "pending" });
    expect(decideAccess({ ...base, profile: { approval_status: "rejected" } })).toEqual({ allowed: false, reason: "rejected" });
  });

  it("ignores email confirmation and consents", () => {
    const r = decideAccess({ ...base, profile: { approval_status: "approved" }, emailConfirmed: false, consentKinds: [] });
    expect(r).toEqual({ allowed: true });
  });

  it("always allows an admin and denies a missing profile", () => {
    expect(decideAccess({ ...base, profile: { is_admin: true, approval_status: "pending" } })).toEqual({ allowed: true });
    expect(decideAccess({ ...base, profile: null })).toEqual({ allowed: false, reason: "no_profile" });
  });
});

describe("open mode", () => {
  const open = { ...base, mode: "open" as const };
  const consents = ["terms", "privacy"];

  it("treats a pending user with a confirmed email and consents as approved", () => {
    expect(decideAccess({ ...open, consentKinds: consents })).toEqual({ allowed: true });
  });

  it("keeps a rejected (suspended) user blocked", () => {
    const r = decideAccess({ ...open, profile: { approval_status: "rejected" }, consentKinds: consents });
    expect(r).toEqual({ allowed: false, reason: "rejected" });
  });

  it("requires a confirmed email", () => {
    expect(decideAccess({ ...open, emailConfirmed: false, consentKinds: consents })).toEqual({
      allowed: false,
      reason: "email_unconfirmed",
    });
  });

  it("requires terms and privacy on record", () => {
    expect(decideAccess(open)).toEqual({ allowed: false, reason: "consent_missing" });
    expect(decideAccess({ ...open, consentKinds: ["terms"] })).toEqual({ allowed: false, reason: "consent_missing" });
  });

  it("requires the guardian declaration for a guardian-held account", () => {
    const guardian = { ...open, profile: { approval_status: "pending", account_holder: "guardian" } };
    expect(decideAccess({ ...guardian, consentKinds: consents })).toEqual({ allowed: false, reason: "consent_missing" });
    expect(decideAccess({ ...guardian, consentKinds: [...consents, "guardian_declaration"] })).toEqual({ allowed: true });
  });

  it("leaves admins unchanged and blocks an account being deleted", () => {
    expect(decideAccess({ ...open, profile: { is_admin: true }, emailConfirmed: false })).toEqual({ allowed: true });
    expect(decideAccess({ ...open, profile: { deleted_at: "2026-11-16T00:00:00Z" }, consentKinds: consents })).toEqual({
      allowed: false,
      reason: "deleted",
    });
  });
});

describe("getAccessForUser", () => {
  function fakeClient(tables: Record<string, unknown>, log: string[] = []) {
    return {
      from(table: string) {
        return {
          select() {
            return {
              eq() {
                log.push(table);
                const result = Promise.resolve({ data: tables[table] });
                return Object.assign(result, { maybeSingle: () => Promise.resolve({ data: tables[table] }) });
              },
            };
          },
        };
      },
    };
  }

  it("makes no consents query in approval mode", async () => {
    const log: string[] = [];
    const client = fakeClient({ profiles: { approval_status: "approved" } }, log);
    expect(await getAccessForUser(client, { id: "u" }, undefined, "approval")).toEqual({ allowed: true });
    expect(log).toEqual(["profiles"]);
  });

  it("reads consents in open mode", async () => {
    const client = fakeClient({
      profiles: { approval_status: "pending", account_holder: "self" },
      consents: [{ kind: "terms" }, { kind: "privacy" }],
    });
    expect(await getAccessForUser(client, { id: "u", email_confirmed_at: "2026-01-01" }, undefined, "open")).toEqual({ allowed: true });
    expect(await getAccessForUser(client, { id: "u", email_confirmed_at: null }, undefined, "open")).toEqual({
      allowed: false,
      reason: "email_unconfirmed",
    });
  });

  it("fails closed when a read throws", async () => {
    const broken = {
      from() {
        throw new Error("down");
      },
    };
    expect(await getAccessForUser(broken, { id: "u" }, undefined, "approval")).toEqual({ allowed: false, reason: "no_profile" });
  });
});
