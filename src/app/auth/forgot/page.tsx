import Link from "next/link";
import type { Metadata } from "next";
import { requestPasswordReset } from "@/app/auth/actions";
import { AuthShell, FormError, FormNotice, LINK_CLASS } from "@/components/account/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = { title: "Reset password | Aristo" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we will send you a link.">
      <FormError message={params.error} />
      <FormNotice message={params.message} />
      <form action={requestPasswordReset} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
        </div>
        <Button type="submit" className="w-full">Send the link</Button>
      </form>
      <p className="text-center text-sm text-muted mt-6">
        <Link href="/sign-in" className={LINK_CLASS}>Back to sign in</Link>
      </p>
    </AuthShell>
  );
}
