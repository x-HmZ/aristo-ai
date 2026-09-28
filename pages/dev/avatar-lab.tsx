import dynamic from "next/dynamic";
import { BRAND_HEX } from "@/lib/brandColors";

// Pages Router is REQUIRED for any R3F surface in this app — see
// CLAUDE.md ("CRITICAL: Pages Router constraint for /learn").  Same
// constraint as /dev/desk-quiz and /dev/free-model.
const AvatarLab = dynamic(() => import("@/components/dev/AvatarLab"), {
  ssr: false,
  loading: () => <div style={{ minHeight: "100vh", background: BRAND_HEX.backdrop }} />,
});

export default function DevAvatarLabPage() {
  // Hide from production deploys — no auth, dev-only visual harness.
  if (process.env.NODE_ENV === "production") {
    return <div style={{ padding: 40, fontFamily: "system-ui" }}>404</div>;
  }
  return <AvatarLab />;
}
