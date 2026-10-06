import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserApprovalStatus } from "@/lib/auth/approval";
import { notifyAdminOfNewSignup } from "@/lib/email/resend";
import { signOut } from "@/app/auth/actions";
import { PendingView } from "./PendingView";

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  // Belt-and-braces: covers the no-email-confirm Supabase flow where the
  // /auth/callback route never runs. notifyAdminOfNewSignup is idempotent.
  await notifyAdminOfNewSignup(user.id, user.email ?? "(unknown)");

  const status = await getUserApprovalStatus(user.id);

  // Defensive: if the user is already approved (admin auto-approves on
  // approval too), shortcut to /learn — middleware should already have
  // caught this on the previous request.
  if (status === "approved") redirect("/learn");

  return (
    <PendingView
      email={user.email ?? null}
      rejected={status === "rejected"}
      signOut={signOut}
    />
  );
}
