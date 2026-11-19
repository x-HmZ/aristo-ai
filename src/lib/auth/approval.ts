/**
 * Who-may-learn gate for API routes.
 *
 * Mirrors the verifyAdmin() pattern in src/lib/admin/auth.ts. Used by learner API routes as defence-in-depth
 * alongside the SSR gate in pages/learn.tsx. The decision itself lives in src/lib/auth/access.ts and depends on
 * ACCESS_MODE: the manual approval gate (default) or open sign-up with a confirmed email and recorded consents.
 * Admins are always allowed.
 */

import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { DENY_MESSAGES, getAccessForUser } from "./access";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface ApprovedUser extends User {
  email: string;
}

/**
 * Convenience guard for API routes:
 *   const guard = await requireApproved();
 *   if (guard.error) return guard.error;
 *   const { user } = guard;
 */
export async function requireApproved(): Promise<
  { user: ApprovedUser; error: null } | { user: null; error: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const access = await getAccessForUser(createServiceClient(), user);
  if (access.allowed) return { user: user as ApprovedUser, error: null };

  return {
    user: null,
    error: NextResponse.json({ error: DENY_MESSAGES[access.reason], code: access.reason }, { status: 403 }),
  };
}

/**
 * Read-only helper — returns the raw status string. Use this when the
 * caller needs to branch on pending vs rejected (e.g. the /pending page).
 * It reports the stored status only; for "may this user learn right now" use getAccessForUser().
 */
export async function getUserApprovalStatus(
  userId: string
): Promise<ApprovalStatus | null> {
  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("approval_status, is_admin")
    .eq("id", userId)
    .single();

  if (!profile) return null;
  if (profile.is_admin) return "approved";
  return profile.approval_status as ApprovalStatus;
}
