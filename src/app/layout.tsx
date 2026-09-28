import type { Metadata } from "next";
import "./globals.css";
import { fontVariables } from "@/lib/fonts";
import { THEME_INIT_SCRIPT } from "@/components/theme/theme";

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
      <head>
        {/* Runs before the body is parsed, so a stored theme choice is in
            place for the first paint on every App Router page. See theme.ts.
            suppressHydrationWarning above covers the attribute it sets. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${fontVariables} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
