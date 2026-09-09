import type { Metadata } from "next";
import "./globals.css";
import { fontVariables } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Aristo — Your Personal AI Teacher",
  description:
    "Experience immersive personalized learning with Aristo. An AI teacher that adapts to your style, generates 3D models, and makes learning unforgettable.",
  keywords:
    "AI teacher, personalized learning, interactive education, 3D learning, online courses",
  authors: [{ name: "Aristo Team" }],
  openGraph: {
    title: "Aristo — Your Personal AI Teacher",
    description:
      "Experience immersive personalized learning with Aristo.",
    url: "https://aristo.vercel.app",
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
