import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserApprovalStatus } from "@/lib/auth/approval";
import { notifyAdminOfNewSignup } from "@/lib/email/resend";
import { signOut } from "@/app/auth/actions";
import { AristoMark } from "@/components/brand/AristoMark";
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
    <div className="min-h-screen bg-bg text-ink flex items-center justify-center p-4">
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="mb-3 flex justify-center">
            <AristoMark decorative={false} className="h-6 text-ink" litClassName="text-accent" />
          </h1>
          <p className="text-body">Your personal AI teacher</p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-8 shadow-e1 text-center">
          {isRejected ? (
            <>
              <h2 className="type-h2 font-semibold text-ink mb-3">
                Access not granted
              </h2>
              <p className="text-muted text-sm mb-6">
                Your access request was reviewed and not approved at this
                time. If you believe this is a mistake, please contact
                support.
              </p>
            </>
          ) : (
            <>
              <h2 className="type-h2 font-semibold text-ink mb-3">
                Awaiting approval
              </h2>
              <p className="text-muted text-sm mb-2">
                Thanks for signing up, {user.email}.
              </p>
              <p className="text-muted text-sm mb-6">
                Your account is being reviewed by an admin. You&apos;ll
                receive an email as soon as you&apos;re cleared to start
                learning.
              </p>
              <Link
                href="/demo"
                className="block mb-6 rounded-[10px] border border-tint-line bg-tint px-4 py-3 text-sm text-ink transition-colors duration-fast hover:border-accent-text/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                While you wait, <span className="font-semibold text-accent-text">try a live demo lesson</span> — no approval needed.
              </Link>
            </>
          )}

          <form action={signOut}>
            <Button
              type="submit"
              variant="outline"
              className="w-full"
            >
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
