import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getAccessForUser } from "@/lib/auth/access";
import { notifyAdminOfNewSignup } from "@/lib/email/resend";
import { acceptDocuments, signOut } from "@/app/auth/actions";
import { PendingView } from "./PendingView";

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const access = await getAccessForUser(service, user, profile ?? null);

  // Already allowed (approved, or open mode with everything in place): straight to the lessons.
  if (access.allowed) redirect("/learn");

  // Belt-and-braces: covers the no-email-confirm Supabase flow where the /auth/callback route never runs.
  // notifyAdminOfNewSignup is idempotent and only acts on pending profiles.
  await notifyAdminOfNewSignup(user.id, user.email ?? "(unknown)");

  return (
    <PendingView
      email={user.email ?? null}
      rejected={access.reason === "rejected" || access.reason === "deleted"}
      reason={access.reason}
      acceptAction={acceptDocuments}
      guardianHeld={profile?.account_holder === "guardian"}
      signOut={signOut}
    />
  );
}
