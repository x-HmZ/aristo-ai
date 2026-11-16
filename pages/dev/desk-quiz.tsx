import { getDevPageStaticProps } from "@/lib/devPages";
import dynamic from "next/dynamic";

// Pages Router is REQUIRED for any R3F surface in this app — see
// CLAUDE.md ("CRITICAL: Pages Router constraint for /learn").  This dev
// route piggybacks on that same constraint so the live tuning harness
// uses the exact same React/Three setup as production /learn.
const DeskQuizPreview = dynamic(
  () => import("@/components/dev/DeskQuizPreview"),
  { ssr: false, loading: () => <div className="min-h-screen bg-bg" /> }
);

export default function DevDeskQuizPage() {
  return <DeskQuizPreview />;
}

// Real 404 in production builds, unless NEXT_PUBLIC_DEV_PAGES=true (see src/lib/devPages.ts).
export const getStaticProps = getDevPageStaticProps;
