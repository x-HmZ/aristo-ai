import { changePassword } from "@/app/account/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordForm() {
  return (
    <section aria-labelledby="password-heading" className="rounded-2xl border border-line bg-surface p-6 space-y-4">
      <h2 id="password-heading" className="type-h3 font-semibold">Change password</h2>
      <form action={changePassword} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="new-password">New password</Label>
          <Input id="new-password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Repeat the new password</Label>
          <Input id="confirm-password" name="confirm" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
        </div>
        <Button type="submit" variant="outline">Change password</Button>
      </form>
    </section>
  );
}
