import type { GetServerSideProps } from "next";
import { createServerClient } from "@supabase/ssr";
import dynamic from "next/dynamic";

// Load the full client (including R3F) only in the browser.
// Pages Router uses (pages-browser) webpack layer which does NOT alias
// react to Next.js's compiled React 19 build, so react-reconciler's
// React 18 internals are found correctly.
const LearnClient = dynamic(
  () => import("@/components/learn/LearnClient").then((m) => m.LearnClient),
  { ssr: false, loading: () => <div className="min-h-screen bg-[#fdf6ee]" /> }
);

interface Props {
  userName:      string;
  userId:        string;
  onboardingDone: boolean;
  domain:        string | null;
}

export default function LearnPage({ userName, userId, onboardingDone, domain }: Props) {
  return (
    <LearnClient
      userName={userName}
      userId={userId}
      onboardingDone={onboardingDone}
      domain={domain}
    />
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return Object.entries(req.cookies).map(([name, value]) => ({
            name,
            value: value ?? "",
          }));
        },
        setAll(cookiesToSet: { name: string; value: string; options?: { secure?: boolean } }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.setHeader(
              "Set-Cookie",
              `${name}=${value}; Path=/; HttpOnly; SameSite=Lax${options?.secure ? "; Secure" : ""}`
            );
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { redirect: { destination: "/sign-in", permanent: false } };
  }

  // Fetch profile including approval gate fields. The gate lives here
  // (in Node-runtime getServerSideProps) instead of in middleware because
  // the Edge Runtime has cookie-parsing compatibility issues with
  // @supabase/ssr that silently swallow the redirect.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, goal, is_admin, approval_status")
    .eq("id", user.id)
    .single();

  // Approval gate. Admins are exempt (admin implies approved).
  if (!profile?.is_admin && profile?.approval_status !== "approved") {
    return { redirect: { destination: "/pending", permanent: false } };
  }

  // Check whether the user has started a course (onboarding sets this)
  const { data: progress } = await supabase
    .from("user_course_progress")
    .select("domain")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  return {
    props: {
      userName:       profile?.full_name?.split(" ")[0] ?? "learner",
      userId:         user.id,
      onboardingDone: !!profile?.goal,          // goal set = onboarding complete
      domain:         progress?.domain ?? null,
    },
  };
};
