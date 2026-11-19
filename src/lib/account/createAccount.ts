/**
 * Writes what sign-up decides, with the service role: the learner fields on the profile and the consent rows.
 * The browser never sets these (migration 025 makes account_holder and learner_age_band read-only to end users).
 */

import { consentRowsFor } from "./documents";
import type { AgeBand, Grade } from "./signup";

/** The slice of the Supabase client this module uses, so tests can pass a small fake. */
export interface AccountWriteClient {
  from(table: string): {
    update(values: Record<string, unknown>): {
      eq(column: string, value: string): { select(columns: string): PromiseLike<{ data: unknown[] | null; error: { code?: string } | null }> };
    };
    upsert(
      rows: Record<string, unknown>[],
      options: { onConflict: string; ignoreDuplicates: boolean },
    ): PromiseLike<{ error: { code?: string } | null }>;
  };
}

export interface NewAccountInput {
  userId: string;
  holder: "self" | "guardian";
  band: AgeBand;
  nickname: string;
  grade: Grade | null;
}

/** The profile columns for a new account. The nickname is also the display name (full_name). */
export function profileValuesFor(input: NewAccountInput): Record<string, unknown> {
  const guardian = input.holder === "guardian";
  return {
    full_name: input.nickname,
    account_holder: input.holder,
    learner_nickname: input.nickname,
    learner_grade: input.grade,
    learner_age_band: input.band,
    // Off for a guardian-held account until the guardian turns each on; on for a self-held 16+ account.
    allow_voice_input: !guardian,
    allow_free_chat: !guardian,
    allow_custom_teacher: !guardian,
  };
}

/** Returns an error code string, or null on success. */
export async function writeNewAccount(client: AccountWriteClient, input: NewAccountInput): Promise<string | null> {
  const updated = await client.from("profiles").update(profileValuesFor(input)).eq("id", input.userId).select("id");
  if (updated.error) return updated.error.code ?? "profile_update_failed";
  if (!updated.data || updated.data.length !== 1) return "profile_missing";

  const rows = consentRowsFor(input.holder).map((r) => ({
    user_id: input.userId,
    kind: r.kind,
    document_version: r.document_version,
  }));
  const consents = await client
    .from("consents")
    .upsert(rows, { onConflict: "user_id,kind,document_version", ignoreDuplicates: true });
  if (consents.error) return consents.error.code ?? "consent_insert_failed";
  return null;
}
