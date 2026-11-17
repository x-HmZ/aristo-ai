import { getDevPageStaticProps } from "@/lib/devPages";
import dynamic from "next/dynamic";

// Pages Router is REQUIRED for any R3F surface in this app — see
// CLAUDE.md ("CRITICAL: Pages Router constraint for /learn").  Same
// constraint as /dev/desk-quiz and /dev/free-model.
const AvatarLab = dynamic(() => import("@/components/dev/AvatarLab"), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-bg" />,
});

export default function DevAvatarLabPage() {
  return <AvatarLab />;
}

// Real 404 in production builds, unless NEXT_PUBLIC_DEV_PAGES=true (see src/lib/devPages.ts).
export const getStaticProps = getDevPageStaticProps;
