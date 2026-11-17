import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell, LINK_CLASS } from "@/components/account/AuthShell";

export const metadata: Metadata = { title: "Account deleted | Aristo" };

export default function AccountDeletedPage() {
  return (
    <AuthShell title="Your account has been deleted">
      <p className="mb-4 text-sm text-body">
        The account, the learner&apos;s progress and your consent records are gone, and you have been signed out. Anonymous
        cost records that contain no personal information are kept for accounting.
      </p>
      <p className="text-center text-sm text-muted">
        <Link href="/" className={LINK_CLASS}>
          Back to the home page
        </Link>
      </p>
    </AuthShell>
  );
}
