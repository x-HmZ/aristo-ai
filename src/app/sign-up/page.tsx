import Link from "next/link";
import { signUp } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function SignUpPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <div className="min-h-screen bg-aristo-gradient flex items-center justify-center p-4">
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
            Create your account
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            Start your learning journey today
          </p>

          {params.error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
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
                className="bg-background/60"
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
                className="bg-background/60"
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
                className="bg-background/60"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11 rounded-xl shadow-aristo-sm transition-all hover:shadow-aristo hover:-translate-y-0.5"
            >
              Create account
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{" "}
            <Link
              href="/sign-in"
              className="text-primary font-medium hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
