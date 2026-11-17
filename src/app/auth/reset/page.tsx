import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { setNewPassword } from "@/app/auth/actions";
import { AuthShell, FormError } from "@/components/account/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Set a new password | Aristo" };

/** Where the email link lands (through /auth/callback?next=/auth/reset): the link has signed the user in. */
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user) redirect("/auth/forgot?error=" + encodeURIComponent("That link has expired. Please ask for a new one."));

  return (
    <AuthShell title="Set a new password">
      <FormError message={params.error} />
      <form action={setNewPassword} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Repeat the new password</Label>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
        </div>
        <Button type="submit" className="w-full">Save password</Button>
      </form>
    </AuthShell>
  );
}
