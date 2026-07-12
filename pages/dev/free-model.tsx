import dynamic from "next/dynamic";

// Pages Router is REQUIRED for any R3F surface in this app — see
// CLAUDE.md ("CRITICAL: Pages Router constraint for /learn").  Same
// constraint as /dev/desk-quiz.
const FreeModelPreview = dynamic(
  () => import("@/components/dev/FreeModelPreview"),
  { ssr: false, loading: () => <div style={{ minHeight: "100vh", background: "#FDF0E4" }} /> }
);

export default function DevFreeModelPage() {
  // Hide from production deploys — no auth, dev-only visual harness.
  if (process.env.NODE_ENV === "production") {
    return <div style={{ padding: 40, fontFamily: "system-ui" }}>404</div>;
  }
  return <FreeModelPreview />;
}
