import type { Metadata } from "next";
import "./globals.css";
import { fontVariables } from "@/lib/fonts";

// The real deployment (Vercel), so link previews and canonical URLs resolve.
// Copy comes from .claude/docs/brand/messaging.md; the OG image is
// opengraph-image.tsx and the icons are icon.svg, favicon.ico and apple-icon.tsx.
const SITE_URL = "https://aristo-ai-ten.vercel.app";
const TITLE = "Aristo | One teacher. One student. Every kid.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description:
    "Your own AI teacher for grades 6 to 8. It explains out loud in a 3D classroom, shows it on the board, then checks that it stuck.",
  keywords:
    "AI tutor, grades 6 to 8, middle school, 3D classroom, mastery learning",
  openGraph: {
    title: TITLE,
    description: "Your own AI teacher for grades 6 to 8, in a 3D classroom.",
    url: SITE_URL,
    siteName: "Aristo",
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${fontVariables} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
