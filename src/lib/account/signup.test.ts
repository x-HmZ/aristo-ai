import { describe, expect, it } from "vitest";
import { consentRowsFor, GUARDIAN_DECLARATION_VERSION, PRIVACY_VERSION, TERMS_VERSION } from "./documents";
import { profileValuesFor, writeNewAccount, type AccountWriteClient } from "./createAccount";
import { ageStepSchema, decideAgeStep, guardianSignUpSchema, selfSignUpSchema } from "./signup";

describe("age step", () => {
  it("sends under-16 'Me' to the kind screen", () => {
    expect(decideAgeStep("me", "under_13")).toEqual({ kind: "needs_guardian" });
    expect(decideAgeStep("me", "13_15")).toEqual({ kind: "needs_guardian" });
  });

  it("lets 16 or older learn for themselves", () => {
    expect(decideAgeStep("me", "16_plus")).toEqual({ kind: "self_form" });
  });

  it("sends 'My child' to the guardian form for every band", () => {
    expect(decideAgeStep("child", "under_13")).toEqual({ kind: "guardian_form", band: "under_13" });
    expect(decideAgeStep("child", "13_15")).toEqual({ kind: "guardian_form", band: "13_15" });
    expect(decideAgeStep("child", "16_plus")).toEqual({ kind: "guardian_form", band: "16_plus" });
  });

  it("rejects an answer outside the options", () => {
    expect(ageStepSchema.safeParse({ who: "teacher", band: "16_plus" }).success).toBe(false);
    expect(ageStepSchema.safeParse({ who: "me", band: "adult" }).success).toBe(false);
    expect(ageStepSchema.safeParse({ who: "me" }).success).toBe(false);
  });
});

const selfOk = { band: "16_plus", email: " Ada@Example.com ", password: "longenough1", nickname: " Ada ", accept: "on" };

describe("self sign-up schema", () => {
  it("accepts a valid form and normalises email and nickname", () => {
    const r = selfSignUpSchema.safeParse(selfOk);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe("ada@example.com");
      expect(r.data.nickname).toBe("Ada");
    }
  });

  it("refuses an under-16 band even if posted", () => {
    expect(selfSignUpSchema.safeParse({ ...selfOk, band: "13_15" }).success).toBe(false);
    expect(selfSignUpSchema.safeParse({ ...selfOk, band: "under_13" }).success).toBe(false);
  });

  it("requires the acceptance box", () => {
    expect(selfSignUpSchema.safeParse({ ...selfOk, accept: undefined }).success).toBe(false);
    expect(selfSignUpSchema.safeParse({ ...selfOk, accept: "off" }).success).toBe(false);
  });

  it("enforces password length and a plain nickname", () => {
    expect(selfSignUpSchema.safeParse({ ...selfOk, password: "short" }).success).toBe(false);
    expect(selfSignUpSchema.safeParse({ ...selfOk, password: "x".repeat(73) }).success).toBe(false);
    expect(selfSignUpSchema.safeParse({ ...selfOk, nickname: "me@example.com" }).success).toBe(false);
    expect(selfSignUpSchema.safeParse({ ...selfOk, nickname: "<b>x</b>" }).success).toBe(false);
    expect(selfSignUpSchema.safeParse({ ...selfOk, nickname: "   " }).success).toBe(false);
    expect(selfSignUpSchema.safeParse({ ...selfOk, nickname: "a".repeat(41) }).success).toBe(false);
  });

  it("rejects a malformed email", () => {
    expect(selfSignUpSchema.safeParse({ ...selfOk, email: "not-an-email" }).success).toBe(false);
  });
});

const guardianOk = {
  band: "under_13",
  email: "parent@example.com",
  password: "longenough1",
  nickname: "Sam",
  grade: "6",
  guardianDeclaration: "on",
  accept: "on",
};

describe("guardian sign-up schema", () => {
  it("accepts a valid form", () => {
    expect(guardianSignUpSchema.safeParse(guardianOk).success).toBe(true);
    expect(guardianSignUpSchema.safeParse({ ...guardianOk, band: "16_plus", grade: "other" }).success).toBe(true);
  });

  it("requires the guardian declaration and the acceptance", () => {
    expect(guardianSignUpSchema.safeParse({ ...guardianOk, guardianDeclaration: undefined }).success).toBe(false);
    expect(guardianSignUpSchema.safeParse({ ...guardianOk, accept: undefined }).success).toBe(false);
  });

  it("requires a known grade and band", () => {
    expect(guardianSignUpSchema.safeParse({ ...guardianOk, grade: "" }).success).toBe(false);
    expect(guardianSignUpSchema.safeParse({ ...guardianOk, grade: "12" }).success).toBe(false);
    expect(guardianSignUpSchema.safeParse({ ...guardianOk, band: "adult" }).success).toBe(false);
  });
});

describe("what sign-up stores", () => {
  it("self: switches on, no grade, three consents less the declaration", () => {
    const v = profileValuesFor({ userId: "u", holder: "self", band: "16_plus", nickname: "Ada", grade: null });
    expect(v).toMatchObject({
      account_holder: "self",
      learner_age_band: "16_plus",
      learner_nickname: "Ada",
      learner_grade: null,
      full_name: "Ada",
      allow_voice_input: true,
      allow_free_chat: true,
      allow_custom_teacher: true,
    });
    expect(consentRowsFor("self")).toEqual([
      { kind: "terms", document_version: TERMS_VERSION },
      { kind: "privacy", document_version: PRIVACY_VERSION },
    ]);
  });

  it("guardian: switches off, grade stored, declaration recorded", () => {
    const v = profileValuesFor({ userId: "u", holder: "guardian", band: "13_15", nickname: "Sam", grade: "7" });
    expect(v).toMatchObject({
      account_holder: "guardian",
      learner_age_band: "13_15",
      learner_grade: "7",
      allow_voice_input: false,
      allow_free_chat: false,
      allow_custom_teacher: false,
    });
    expect(consentRowsFor("guardian")).toContainEqual({ kind: "guardian_declaration", document_version: GUARDIAN_DECLARATION_VERSION });
  });

  it("never stores a date of birth or an IP address", () => {
    const keys = Object.keys(profileValuesFor({ userId: "u", holder: "guardian", band: "under_13", nickname: "S", grade: "6" }));
    expect(keys.join(" ")).not.toMatch(/birth|dob|ip|address/);
  });
});

function fakeClient(opts: { rows?: unknown[]; profileError?: boolean; consentError?: boolean }) {
  const calls: string[] = [];
  const client: AccountWriteClient = {
    from(table) {
      return {
        update() {
          return {
            eq() {
              return {
                select: async () => {
                  calls.push(`update:${table}`);
                  return { data: opts.rows ?? [{ id: "u" }], error: opts.profileError ? { code: "X1" } : null };
                },
              };
            },
          };
        },
        upsert: async (rows) => {
          calls.push(`upsert:${table}:${rows.length}`);
          return { error: opts.consentError ? { code: "X2" } : null };
        },
      };
    },
  };
  return { client, calls };
}

describe("writeNewAccount", () => {
  const input = { userId: "u", holder: "guardian" as const, band: "under_13" as const, nickname: "Sam", grade: "6" as const };

  it("updates the profile then writes the consent rows", async () => {
    const { client, calls } = fakeClient({});
    expect(await writeNewAccount(client, input)).toBeNull();
    expect(calls).toEqual(["update:profiles", "upsert:consents:3"]);
  });

  it("reports a missing profile row without writing consents", async () => {
    const { client, calls } = fakeClient({ rows: [] });
    expect(await writeNewAccount(client, input)).toBe("profile_missing");
    expect(calls).toEqual(["update:profiles"]);
  });

  it("reports a failed profile update or consent insert", async () => {
    expect(await writeNewAccount(fakeClient({ profileError: true }).client, input)).toBe("X1");
    expect(await writeNewAccount(fakeClient({ consentError: true }).client, input)).toBe("X2");
  });
});
