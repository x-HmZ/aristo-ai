/**
 * Canonical admin authentication helper.
 *
 * Every /api/admin/* route and every admin-gated route (e.g. /api/kg/*
 * mutations) should call `verifyAdmin()` and bail with a 403 when it
 * returns null. This is the single source of truth — do not re-implement
 * the profile.is_admin lookup elsewhere.
 */

import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export interface AdminUser extends User {
  email: string;
}

/**
 * Returns the authenticated user iff their profile row has
 * `is_admin = true`. Returns `null` otherwise (anon, unauthenticated, or
 * authenticated-but-not-admin).
 *
 * The is_admin lookup uses the service-role client to bypass RLS, which
 * is safe because we've already authenticated the caller against the
 * anon-key session before doing the lookup.
 */
export async function verifyAdmin(): Promise<AdminUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) return null;
  return user as AdminUser;
}

/**
 * Convenience: returns a 403 response if the caller is not an admin.
 * Usage:
 *   const guard = await requireAdmin();
 *   if (guard.error) return guard.error;
 *   const { user } = guard;
 */
export async function requireAdmin(): Promise<
  { user: AdminUser; error: null } | { user: null; error: NextResponse }
> {
  const user = await verifyAdmin();
  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { user, error: null };
}
