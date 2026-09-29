import Link from "next/link";
import { signIn } from "@/app/auth/actions";
import { AristoMark } from "@/components/brand/AristoMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PageProps {
  searchParams: Promise<{ error?: string; message?: string }>;
}

export default async function SignInPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <div className="min-h-screen bg-bg text-ink flex items-center justify-center p-4">
      {/* Prefetch the default /learn GLBs while the user is still typing their
          credentials, so returning users hit a warm HTTP cache instead of a cold
          Suspense wait. React 19 hoists these into <head> automatically wherever
          they're rendered.

          These must stay in sync with DEFAULT_TEACHER in useAristoStore.ts —
          currently jake, whose scene and base clips are one GLB; his clip pack
          loads after the scene and is not prefetched. Prefetching the wrong avatar is worse than
          prefetching none: it spends the user's bandwidth on a file /learn
          never opens. */}
      <link rel="prefetch" href="/models/Teacher_Jake.glb" as="fetch" crossOrigin="anonymous" />
      <link rel="prefetch" href="/models/classroom_default.glb" as="fetch" crossOrigin="anonymous" />

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
            Welcome back
          </h2>
          <p className="text-muted text-sm mb-6">
            Sign in to continue learning
          </p>

          {/* Error / Message */}
          {params.error && (
            <div className="mb-4 p-3 rounded-[10px] bg-danger/10 border border-danger/25 text-danger text-sm">
              {decodeURIComponent(params.error)}
            </div>
          )}
          {params.message && (
            <div className="mb-4 p-3 rounded-[10px] bg-tint border border-tint-line text-ink text-sm">
              {params.message}
            </div>
          )}

          <form action={signIn} className="space-y-4">
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
                placeholder="••••••••"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
            >
              Sign in
            </Button>
          </form>

          <p className="text-center text-sm text-muted mt-6">
            Don&apos;t have an account?{" "}
            <Link
              href="/sign-up"
              className="text-accent-text font-semibold underline-offset-4 hover:underline"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
