import type { AppProps } from "next/app";
import "@/app/globals.css";
import { geistSans, geistMono } from "@/lib/fonts";

/**
 * The Pages Router entry (/learn, /demo, /dev/*).
 *
 * The only job of the style block is to define the `--font-geist-*` custom
 * properties. The App Router's root layout sets them on <body>, but these
 * pages never render that file — they are Pages Router because of the R3F
 * constraint in CLAUDE.md. Without them, Tailwind's preflight rule
 * `html { font-family: var(--font-geist-sans), system-ui, sans-serif }`
 * references an undefined property, which makes the whole declaration invalid
 * at computed-value time (CSS does not fall through to the next family), so
 * every page here rendered in the browser's default serif.
 *
 * Two details worth keeping:
 *   - It has to be declared from here, not from a _document.tsx. next/font is
 *     only wired up for Pages Router from _app or a page; used in _document it
 *     hands back a class name whose CSS is never emitted, which looks like it
 *     works and does not.
 *   - It targets `:root` rather than a wrapper element so that content
 *     portalled to document.body inherits it too — Radix (dialog, select,
 *     tooltip, dropdown) portals there by default, and a wrapper would leave
 *     all of it rendering in Times New Roman.
 */
export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <style jsx global>{`
        :root {
          --font-geist-sans: ${geistSans.style.fontFamily};
          --font-geist-mono: ${geistMono.style.fontFamily};
        }
      `}</style>
      <Component {...pageProps} />
    </>
  );
}
