import Link from "next/link";
import { signIn } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PageProps {
  searchParams: Promise<{ error?: string; message?: string }>;
}

export default async function SignInPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <div className="min-h-screen bg-aristo-gradient flex items-center justify-center p-4">
      {/* Prefetch the default /learn GLBs (ryan + classroom) while the user
          is still typing their credentials, so returning users hit a warm
          HTTP cache instead of a cold Suspense wait. React 19 hoists these
          into <head> automatically wherever they're rendered. */}
      <link rel="prefetch" href="/models/Teacher_Ryan.glb" as="fetch" crossOrigin="anonymous" />
      <link rel="prefetch" href="/models/animations_Ryan.glb" as="fetch" crossOrigin="anonymous" />
      <link rel="prefetch" href="/models/classroom_default.glb" as="fetch" crossOrigin="anonymous" />

      {/* Background decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-aristo-orange-pale/40 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-aristo-orange-light/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gradient mb-2">Aristo</h1>
          <p className="text-muted-foreground">Your personal AI teacher</p>
        </div>

        {/* Card */}
        <div className="glass rounded-2xl p-8 shadow-aristo">
          <h2 className="text-2xl font-semibold text-foreground mb-1">
            Welcome back
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            Sign in to continue learning
          </p>

          {/* Error / Message */}
          {params.error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {decodeURIComponent(params.error)}
            </div>
          )}
          {params.message && (
            <div className="mb-4 p-3 rounded-lg bg-accent border border-accent-foreground/10 text-accent-foreground text-sm">
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
                className="bg-background/60"
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
                className="bg-background/60"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11 rounded-xl shadow-aristo-sm transition-all hover:shadow-aristo hover:-translate-y-0.5"
            >
              Sign in
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Don&apos;t have an account?{" "}
            <Link
              href="/sign-up"
              className="text-primary font-medium hover:underline"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
