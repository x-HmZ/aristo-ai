import dynamic from "next/dynamic";
import Head from "next/head";
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

// /demo is where every "Try a lesson" button lands, so it is the URL most likely
// to be pasted into a chat. Pages Router pages get no App Router metadata, and
// have no metadataBase either, so the preview tags are written out absolute.
const SITE_URL = "https://aristo-ai-ten.vercel.app";
const TITLE = "Aristo | Try a lesson";
const DESCRIPTION =
  "Watch a live lesson from your own AI teacher: explained out loud in a 3D classroom, shown on the board, then quizzed at your desk. No account needed.";

export default function DemoPage() {
  return (
    <>
      <Head>
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content={`${SITE_URL}/demo`} />
        <meta property="og:site_name" content="Aristo" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={`${SITE_URL}/opengraph-image`} />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      <DemoClient />
    </>
  );
}
