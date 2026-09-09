import dynamic from "next/dynamic";
import { LoadingScreenVisual } from "@/components/learn/LoadingScreenVisual";

// Same Pages Router treatment as /learn (see pages/learn.tsx) — R3F needs the
// (pages-browser) webpack layer, which does not alias react to Next's
// compiled React 19 build the way the App Router's client layer does.
//
// Unlike /learn, this page has NO getServerSideProps auth gate: /demo is the
// public, unauthenticated "try it before you sign up" route. It must never
// require a session and must never call an authed API route — see
// DemoClient.tsx and useLessonPlayback's demoMode branch for the guarantees.
const DemoClient = dynamic(
  () => import("@/components/demo/DemoClient").then((m) => m.DemoClient),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-[100]">
        <LoadingScreenVisual progress={0} />
      </div>
    ),
  }
);

export default function DemoPage() {
  return <DemoClient />;
}
