import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
