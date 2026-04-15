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
  userName: string;
  savedStyle: string;
  savedFlow: string;
  styleAssessmentDone: boolean;
  userId: string;
}

export default function LearnPage({
  userName,
  savedStyle,
  savedFlow,
  styleAssessmentDone,
  userId,
}: Props) {
  return (
    <LearnClient
      userName={userName}
      savedStyle={savedStyle}
      savedFlow={savedFlow}
      styleAssessmentDone={styleAssessmentDone}
      userId={userId}
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { redirect: { destination: "/sign-in", permanent: false } };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, learning_style, teaching_flow, style_locked")
    .eq("id", user.id)
    .single();

  return {
    props: {
      userName: profile?.full_name?.split(" ")[0] ?? "learner",
      savedStyle: profile?.learning_style ?? "visual",
      savedFlow: profile?.teaching_flow ?? "structured",
      styleAssessmentDone: profile?.style_locked ?? false,
      userId: user.id,
    },
  };
};
