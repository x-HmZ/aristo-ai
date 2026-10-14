import dynamic from "next/dynamic";

// Pages Router, like the other /dev harnesses: the room view added in V10 uses
// R3F (see CLAUDE.md, "CRITICAL: Pages Router constraint for /learn").
const InteractivePreview = dynamic(
  () => import("@/components/dev/InteractivePreview"),
  { ssr: false, loading: () => <div className="min-h-screen bg-bg" /> }
);

export default function DevInteractivePage() {
  // Hide from production deploys: no auth, dev-only visual harness.
  if (process.env.NODE_ENV === "production") {
    return <div style={{ padding: 40, fontFamily: "system-ui" }}>404</div>;
  }
  return <InteractivePreview />;
}
