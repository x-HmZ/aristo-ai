import Link from "next/link";
import { signUp } from "@/app/auth/actions";
import { AristoMark } from "@/components/brand/AristoMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function SignUpPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <div className="min-h-screen bg-bg text-ink flex items-center justify-center p-4">
      <div className="relative w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <h1 className="mb-3 flex justify-center">
            <AristoMark decorative={false} className="h-6 text-ink" litClassName="text-accent" />
          </h1>
          <p className="text-body">Your personal AI teacher</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-line bg-surface p-8 shadow-e1">
          <h2 className="type-h2 font-semibold text-ink mb-1">
            Create your account
          </h2>
          <p className="text-muted text-sm mb-6">
            Start your learning journey today
          </p>

          {params.error && (
            <div className="mb-4 p-3 rounded-[10px] bg-danger/10 border border-danger/25 text-danger text-sm">
              {decodeURIComponent(params.error)}
            </div>
          )}

          <form action={signUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="Alex Johnson"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Min. 8 characters"
                minLength={8}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
            >
              Create account
            </Button>
          </form>

          <p className="text-center text-sm text-muted mt-6">
            Already have an account?{" "}
            <Link
              href="/sign-in"
              className="text-accent-text font-semibold underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
