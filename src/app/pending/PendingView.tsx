import Link from "next/link";
import { AristoMark } from "@/components/brand/AristoMark";
import { Button } from "@/components/ui/button";
import { GUARDIAN_DECLARATION_TEXT, PRIVACY_PATH, TERMS_PATH } from "@/lib/account/documents";
import type { DenyReason } from "@/lib/auth/access";

interface PendingViewProps {
  email:    string | null;
  rejected: boolean;
  /** The sign-out server action; a prop so the view stays presentational. */
  signOut:  (formData: FormData) => void | Promise<void>;
  /** Why access is closed. Set only for the reasons ACCESS_MODE=open adds (email, consents) or a suspension. */
  reason?:  DenyReason;
  /** Records the consents of an existing user (ACCESS_MODE=open, consent_missing). */
  acceptAction?: (formData: FormData) => void | Promise<void>;
  guardianHeld?: boolean;
}

/** What a blocked account sees: awaiting review, a missing step, or not granted. */
export function PendingView({ email, rejected, signOut, reason, acceptAction, guardianHeld }: PendingViewProps) {
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
          {reason === "email_unconfirmed" ? (
            <>
              <h2 className="type-h2 font-semibold text-ink mb-3">Confirm your email</h2>
              <p className="text-muted text-sm mb-6" role="status">
                We sent a link to {email}. Open it to confirm your address, then come back and sign in again.
              </p>
            </>
          ) : reason === "consent_missing" && acceptAction ? (
            <form action={acceptAction} className="mb-6 space-y-4 text-left">
              <h2 className="type-h2 font-semibold text-ink text-center">One more step</h2>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-sm text-ink">
                <input type="checkbox" name="accept" required className="mt-0.5 size-5 shrink-0 accent-accent" />
                <span>
                  I accept the{" "}
                  <Link href={TERMS_PATH} target="_blank" className="text-accent-text font-semibold underline-offset-4 hover:underline">terms of use</Link>{" "}
                  and have read the{" "}
                  <Link href={PRIVACY_PATH} target="_blank" className="text-accent-text font-semibold underline-offset-4 hover:underline">privacy notice</Link>.
                </span>
              </label>
              {guardianHeld && (
                <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-sm text-ink">
                  <input type="checkbox" name="guardianDeclaration" required className="mt-0.5 size-5 shrink-0 accent-accent" />
                  <span>{GUARDIAN_DECLARATION_TEXT}</span>
                </label>
              )}
              <Button type="submit" className="w-full">Continue</Button>
            </form>
          ) : rejected ? (
            <>
              <h2 className="type-h2 font-semibold text-ink mb-3">
                {reason === "rejected" ? "Account suspended" : "Access not granted"}
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
