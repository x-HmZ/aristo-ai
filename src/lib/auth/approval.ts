/**
 * Approved-users-only gate.
 *
 * Mirrors the verifyAdmin() pattern in src/lib/admin/auth.ts. Used by
 * learner API routes as defence-in-depth alongside the middleware
 * redirect to /pending. Admins are always treated as approved.
 */

import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface ApprovedUser extends User {
  email: string;
}

/**
 * Returns the authenticated user iff their profile is approved (or admin).
 * Returns null for anon, unauthenticated, pending, or rejected.
 */
export async function verifyApproved(): Promise<ApprovedUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("approval_status, is_admin")
    .eq("id", user.id)
    .single();

  if (!profile) return null;
  if (profile.is_admin) return user as ApprovedUser;
  if (profile.approval_status !== "approved") return null;
  return user as ApprovedUser;
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

  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("approval_status, is_admin")
    .eq("id", user.id)
    .single();

  if (profile?.is_admin || profile?.approval_status === "approved") {
    return { user: user as ApprovedUser, error: null };
  }

  return {
    user: null,
    error: NextResponse.json(
      { error: "Account pending approval" },
      { status: 403 }
    ),
  };
}

/**
 * Read-only helper — returns the raw status string. Use this when the
 * caller needs to branch on pending vs rejected (e.g. the /pending page).
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
