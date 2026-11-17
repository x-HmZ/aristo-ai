/**
 * Who may use the learning features: one decision, two modes.
 *
 * ACCESS_MODE (server-side setting, read where the gate runs):
 *   approval (default)  Exactly the manual gate that exists today: profiles.approval_status = 'approved'.
 *   open                Sign-up is public. A user is allowed when their email is confirmed and their consents are
 *                       recorded. 'pending' counts as approved; 'rejected' stays blocked (that is "suspended").
 * In both modes a platform admin (profiles.is_admin) is always allowed, and a profile whose deletion has begun
 * (deleted_at set) is not.
 *
 * Used by requireApproved() (API routes), pages/learn.tsx (SSR gate) and /pending. The middleware does NOT check
 * approval on purpose (Edge Runtime and @supabase/ssr cookie parsing: see the note in src/middleware.ts).
 */

import { requiredConsentKinds } from "@/lib/account/documents";

export type AccessMode = "approval" | "open";

/** Anything but exactly "open" is the manual gate: a typo never opens the door. */
export function getAccessMode(value: string | undefined = process.env.ACCESS_MODE): AccessMode {
  return value?.trim().toLowerCase() === "open" ? "open" : "approval";
}

export interface AccessProfile {
  is_admin?: boolean | null;
  approval_status?: string | null;
  account_holder?: string | null;
  deleted_at?: string | null;
}

export type DenyReason = "no_profile" | "pending" | "rejected" | "deleted" | "email_unconfirmed" | "consent_missing";

export type AccessDecision = { allowed: true } | { allowed: false; reason: DenyReason };

export interface AccessInput {
  mode: AccessMode;
  profile: AccessProfile | null | undefined;
  /** auth.users.email_confirmed_at is set. */
  emailConfirmed: boolean;
  /** The kinds of consent on record for the user (any document version). */
  consentKinds: readonly string[];
}

export function decideAccess(input: AccessInput): AccessDecision {
  const { mode, profile } = input;
  if (!profile) return { allowed: false, reason: "no_profile" };
  if (profile.is_admin) return { allowed: true };
  if (profile.deleted_at) return { allowed: false, reason: "deleted" };

  if (mode === "approval") {
    if (profile.approval_status === "approved") return { allowed: true };
    return { allowed: false, reason: profile.approval_status === "rejected" ? "rejected" : "pending" };
  }

  if (profile.approval_status === "rejected") return { allowed: false, reason: "rejected" };
  if (!input.emailConfirmed) return { allowed: false, reason: "email_unconfirmed" };
  const holder = profile.account_holder === "guardian" ? "guardian" : "self";
  const have = new Set(input.consentKinds);
  if (!requiredConsentKinds(holder).every((k) => have.has(k))) return { allowed: false, reason: "consent_missing" };
  return { allowed: true };
}

interface ReadClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): PromiseLike<{ data: unknown }>;
      } & PromiseLike<{ data: unknown }>;
    };
  };
}

/**
 * Loads what the decision needs and decides. `client` is any Supabase client that can read the user's own rows
 * (the service client, or the request's RLS client: both work). Pass `profile` when the caller already has it.
 * In approval mode no extra query is made. A read failure denies (fail closed).
 */
export async function getAccessForUser(
  client: object,
  user: { id: string; email_confirmed_at?: string | null },
  profile?: AccessProfile | null,
  mode: AccessMode = getAccessMode(),
): Promise<AccessDecision> {
  const db = client as ReadClient;
  try {
    let row = profile;
    if (row === undefined) {
      const res = await db.from("profiles").select("*").eq("id", user.id).maybeSingle();
      row = (res.data as AccessProfile | null) ?? null;
    }
    let consentKinds: string[] = [];
    if (mode === "open" && row && !row.is_admin) {
      const res = await db.from("consents").select("kind").eq("user_id", user.id);
      consentKinds = ((res.data as { kind: string }[] | null) ?? []).map((c) => c.kind);
    }
    return decideAccess({ mode, profile: row, emailConfirmed: Boolean(user.email_confirmed_at), consentKinds });
  } catch {
    return { allowed: false, reason: "no_profile" };
  }
}

/** The text a blocked user is told, by reason. Keeps API responses and /pending in step. */
export const DENY_MESSAGES: Record<DenyReason, string> = {
  no_profile: "Account not found",
  pending: "Account pending approval",
  rejected: "Account suspended",
  deleted: "Account deleted",
  email_unconfirmed: "Please confirm your email address first",
  consent_missing: "Please accept the terms and privacy notice first",
};
