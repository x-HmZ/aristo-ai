import Head from "next/head";
import { LandingRoot } from "@/components/landing/LandingRoot";

// `/` is a Pages Router page since V8.3, for the same reason as /learn and /demo: its 3D stage needs R3F,
// which cannot run under the App Router's React 19 alias (CLAUDE.md). It has no getServerSideProps, so it is
// prerendered as static HTML. The App Router's metadata never reaches Pages Router pages, so the tags are
// written out here, absolute, as pages/demo.tsx does; /opengraph-image is still the App Router's image route.
const SITE_URL = "https://aristo-ai-ten.vercel.app";
const TITLE = "Aristo | One teacher. One student. Every kid.";
const DESCRIPTION =
  "Your own AI teacher for grades 6 to 8. It explains out loud in a 3D classroom, shows it on the board, then checks that it stuck.";

export default function HomePage() {
  return (
    <>
      <Head>
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <meta name="keywords" content="AI tutor, grades 6 to 8, middle school, 3D classroom, mastery learning" />
        <link rel="canonical" href={SITE_URL} />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content="Your own AI teacher for grades 6 to 8, in a 3D classroom." />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:site_name" content="Aristo" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={`${SITE_URL}/opengraph-image`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Aristo. One teacher. One student. Every kid." />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={TITLE} />
        <meta name="twitter:description" content={DESCRIPTION} />
        <meta name="twitter:image" content={`${SITE_URL}/opengraph-image`} />
      </Head>
      <LandingRoot />
    </>
  );
}
