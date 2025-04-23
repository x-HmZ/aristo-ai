import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Aristo - Your Personal AI Teacher",
  description: "Experience personalized learning with Aristo, your AI-powered teacher that adapts to your learning style. Interactive courses, quizzes, and immersive 3D learning environment.",
  keywords: "AI teacher, personalized learning, interactive education, 3D learning, online courses, AI education",
  authors: [{ name: "Aristo Team" }],
  openGraph: {
    title: "Aristo - Your Personal AI Teacher",
    description: "Experience personalized learning with Aristo, your AI-powered teacher that adapts to your learning style.",
    url: "https://aristo.vercel.app",
    siteName: "Aristo",
    images: [
      {
        url: "/images/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Aristo AI Teacher",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Aristo - Your Personal AI Teacher",
    description: "Experience personalized learning with Aristo, your AI-powered teacher that adapts to your learning style.",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
