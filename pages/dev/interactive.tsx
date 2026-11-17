import { getDevPageStaticProps } from "@/lib/devPages";
import dynamic from "next/dynamic";

// Pages Router, like the other /dev harnesses: the room view added in V10 uses
// R3F (see CLAUDE.md, "CRITICAL: Pages Router constraint for /learn").
const InteractivePreview = dynamic(
  () => import("@/components/dev/InteractivePreview"),
  { ssr: false, loading: () => <div className="min-h-screen bg-bg" /> }
);

export default function DevInteractivePage() {
  return <InteractivePreview />;
}

// Real 404 in production builds, unless NEXT_PUBLIC_DEV_PAGES=true (see src/lib/devPages.ts).
export const getStaticProps = getDevPageStaticProps;
