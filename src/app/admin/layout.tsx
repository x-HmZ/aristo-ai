/**
 * Admin shared layout — server component.
 *
 * Middleware (src/middleware.ts) is the primary auth gate for /admin/*
 * and bounces non-admins to /learn. This layout repeats the check as a
 * defense-in-depth measure and reads the admin profile so the shell can
 * display the signed-in identity in the topbar.
 */

import { redirect }                  from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { AdminShell }                from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in?next=/admin/overview");

  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("is_admin, full_name")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) redirect("/learn");

  return (
    <AdminShell
      admin={{
        email:     user.email ?? null,
        full_name: profile?.full_name ?? null,
      }}
    >
      {children}
    </AdminShell>
  );
}
