import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserApprovalStatus } from "@/lib/auth/approval";
import { notifyAdminOfNewSignup } from "@/lib/email/resend";
import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";

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

  const isRejected = status === "rejected";

  return (
    <div className="min-h-screen bg-aristo-gradient flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-aristo-orange-pale/40 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-aristo-orange-light/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gradient mb-2">Aristo</h1>
          <p className="text-muted-foreground">Your personal AI teacher</p>
        </div>

        <div className="glass rounded-2xl p-8 shadow-aristo text-center">
          {isRejected ? (
            <>
              <h2 className="text-2xl font-semibold text-foreground mb-3">
                Access not granted
              </h2>
              <p className="text-muted-foreground text-sm mb-6">
                Your access request was reviewed and not approved at this
                time. If you believe this is a mistake, please contact
                support.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-semibold text-foreground mb-3">
                Awaiting approval
              </h2>
              <p className="text-muted-foreground text-sm mb-2">
                Thanks for signing up, {user.email}.
              </p>
              <p className="text-muted-foreground text-sm mb-6">
                Your account is being reviewed by an admin. You&apos;ll
                receive an email as soon as you&apos;re cleared to start
                learning.
              </p>
              <Link
                href="/demo"
                className="block mb-6 rounded-xl border border-primary/25 bg-accent/60 px-4 py-3 text-sm text-foreground hover:bg-accent transition-colors"
              >
                While you wait, <span className="font-semibold text-primary">try a live demo lesson</span> — no approval needed.
              </Link>
            </>
          )}

          <form action={signOut}>
            <Button
              type="submit"
              variant="outline"
              className="w-full h-11 rounded-xl"
            >
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
