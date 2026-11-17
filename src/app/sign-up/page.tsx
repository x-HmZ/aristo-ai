import Link from "next/link";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { signUpGuardian, signUpSelf, startSignUp } from "@/app/auth/actions";
import {
  AuthShell,
  CheckOption,
  FormError,
  LINK_CLASS,
  RadioOption,
  SELECT_CLASS,
} from "@/components/account/AuthShell";
import { TurnstileWidget } from "@/components/account/TurnstileWidget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GUARDIAN_DECLARATION_TEXT, PRIVACY_PATH, TERMS_PATH } from "@/lib/account/documents";
import {
  AGE_BAND_LABELS,
  AGE_BANDS,
  GRADE_LABELS,
  GRADES,
  SIGNUP_BLOCK_COOKIE,
  type AgeBand,
} from "@/lib/account/signup";
import { readTurnstileEnv, turnstileEnabled } from "@/lib/account/turnstile";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Create an account | Aristo", robots: { index: false, follow: false } };

interface PageProps {
  searchParams: Promise<{ error?: string; step?: string; band?: string }>;
}

function AcceptLabel() {
  return (
    <>
      I accept the{" "}
      <Link href={TERMS_PATH} className={LINK_CLASS} target="_blank">
        terms of use
      </Link>{" "}
      and have read the{" "}
      <Link href={PRIVACY_PATH} className={LINK_CLASS} target="_blank">
        privacy notice
      </Link>
      .
    </>
  );
}

export default async function SignUpPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const blocked = (await cookies()).has(SIGNUP_BLOCK_COOKIE);
  const env = readTurnstileEnv();
  const siteKey = turnstileEnabled(env) ? env.siteKey : undefined;

  // Under 16 chose "Me": a kind screen, and no way back to the question in this browser session.
  if (blocked) {
    return (
      <AuthShell title="Thank you for asking">
        <p className="mb-4 text-sm text-body">
          To use Aristo, a parent or guardian needs to create the account. Please ask them to sign up from their own
          device. They will choose the learner&apos;s nickname and grade, and they stay in charge of the account.
        </p>
        <p className="text-sm text-muted">We have not saved anything about you.</p>
        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/" className={LINK_CLASS}>
            Back to the home page
          </Link>
        </p>
      </AuthShell>
    );
  }

  const error = params.error ? decodeURIComponent(params.error) : undefined;
  const signInLink = (
    <p className="text-center text-sm text-muted mt-6">
      Already have an account?{" "}
      <Link href="/sign-in" className={LINK_CLASS}>
        Sign in
      </Link>
    </p>
  );

  // Me, 16 or older.
  if (params.step === "self") {
    return (
      <AuthShell title="Create your account" subtitle="You are 16 or older and learning for yourself.">
        <FormError message={error} />
        <form action={signUpSelf} className="space-y-4">
          <input type="hidden" name="band" value="16_plus" />
          <div className="space-y-2">
            <Label htmlFor="nickname">Display name or nickname</Label>
            <Input id="nickname" name="nickname" type="text" maxLength={40} autoComplete="nickname" required aria-describedby="nickname-hint" />
            <p id="nickname-hint" className="text-xs text-muted">A nickname is fine. You do not need to use your full name.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required aria-describedby="password-hint" />
            <p id="password-hint" className="text-xs text-muted">At least 8 characters.</p>
          </div>
          <CheckOption name="accept">
            <AcceptLabel />
          </CheckOption>
          <TurnstileWidget siteKey={siteKey} />
          <Button type="submit" className="w-full">Create account</Button>
        </form>
        {signInLink}
      </AuthShell>
    );
  }

  // My child: a parent or guardian creates the account.
  if (params.step === "guardian") {
    const band: AgeBand = (AGE_BANDS as readonly string[]).includes(params.band ?? "") ? (params.band as AgeBand) : "under_13";
    return (
      <AuthShell
        title="Create a parent account"
        subtitle="You create and own the account. The learner does not need an email or a password."
      >
        <FormError message={error} />
        <form action={signUpGuardian} className="space-y-4">
          <input type="hidden" name="band" value={band} />
          <div className="space-y-2">
            <Label htmlFor="email">Your email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Your password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required aria-describedby="password-hint" />
            <p id="password-hint" className="text-xs text-muted">At least 8 characters.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nickname">Learner&apos;s nickname</Label>
            <Input id="nickname" name="nickname" type="text" maxLength={40} autoComplete="off" required aria-describedby="nickname-hint" />
            <p id="nickname-hint" className="text-xs text-muted">A nickname, not a full name.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="grade">Learner&apos;s school grade</Label>
            <select id="grade" name="grade" required defaultValue="" className={SELECT_CLASS}>
              <option value="" disabled>Choose a grade</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>{GRADE_LABELS[g]}</option>
              ))}
            </select>
          </div>
          <CheckOption name="guardianDeclaration">{GUARDIAN_DECLARATION_TEXT}</CheckOption>
          <CheckOption name="accept">
            <AcceptLabel />
          </CheckOption>
          <TurnstileWidget siteKey={siteKey} />
          <Button type="submit" className="w-full">Create parent account</Button>
        </form>
        {signInLink}
      </AuthShell>
    );
  }

  // Step 1: the neutral age step. Both questions have the same weight; nothing here hints at a "right" answer.
  return (
    <AuthShell title="Create an account" subtitle="Two quick questions first.">
      <FormError message={error} />
      <form action={startSignUp} className="space-y-6">
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-ink">Who will be learning?</legend>
          <RadioOption name="who" value="me" label="Me" required />
          <RadioOption name="who" value="child" label="My child" required />
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-ink">How old is the learner?</legend>
          {AGE_BANDS.map((b) => (
            <RadioOption key={b} name="band" value={b} label={AGE_BAND_LABELS[b]} required />
          ))}
        </fieldset>
        <Button type="submit" className="w-full">Continue</Button>
      </form>
      {signInLink}
    </AuthShell>
  );
}
