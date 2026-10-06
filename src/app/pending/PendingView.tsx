import Link from "next/link";
import { AristoMark } from "@/components/brand/AristoMark";
import { Button } from "@/components/ui/button";

interface PendingViewProps {
  email:    string | null;
  rejected: boolean;
  /** The sign-out server action; a prop so the view stays presentational. */
  signOut:  (formData: FormData) => void | Promise<void>;
}

/** What an unapproved account sees: awaiting review, or not granted. */
export function PendingView({ email, rejected, signOut }: PendingViewProps) {
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
          {rejected ? (
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
                Thanks for signing up, {email}.
              </p>
              <p className="text-muted text-sm mb-6">
                Your account is being reviewed by an admin. You&apos;ll
                receive an email as soon as you&apos;re cleared to start
                learning.
              </p>
              <Link
                href="/demo"
                className="block mb-6 rounded-[10px] border border-tint-line bg-tint px-4 py-3 text-sm text-ink transition-colors duration-fast hover:border-accent-text/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-text focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
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
