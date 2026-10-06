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
  // Hide from production deploys — there's no auth or rate limit on this
  // page and the only purpose is local visual iteration.
  if (process.env.NODE_ENV === "production") {
    return <div style={{ padding: 40, fontFamily: "system-ui" }}>404</div>;
  }
  return <DeskQuizPreview />;
}
