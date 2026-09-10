import { Geist, Geist_Mono } from "next/font/google";

/**
 * One definition of the app's typefaces, shared by both routers.
 *
 * These were previously declared inline in src/app/layout.tsx, which meant
 * only App Router pages ever got the `--font-geist-*` custom properties.
 * `/demo` and `/learn` are Pages Router (see the R3F constraint in CLAUDE.md)
 * and render through pages/_app.tsx, so on those pages
 * `font-family: var(--font-geist-sans), system-ui, sans-serif` referenced an
 * undefined property. CSS does not fall through to the next family in that
 * case — the declaration is invalid at computed-value time and is dropped, so
 * text inherited the browser default (Times New Roman on Windows Chrome).
 *
 * next/font deduplicates by call site, so importing this module from both
 * entry points serves the same self-hosted files, not two copies.
 */
export const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Convenience for the wrappers that need to declare both. */
export const fontVariables = `${geistSans.variable} ${geistMono.variable}`;
