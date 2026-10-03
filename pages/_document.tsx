import { Html, Head, Main, NextScript } from "next/document";
import { THEME_INIT_SCRIPT } from "@/components/theme/theme";
import { TEACHER_INIT_SCRIPT } from "@/components/landing/teacher";

/**
 * The Pages Router document (/learn, /demo, /dev/*).
 *
 * Its one job is the theme's pre-paint script, the same one the App Router's
 * root layout renders: a stored choice (localStorage `aristo-theme`) is put on
 * <html> before the first paint, which here is the server-rendered loading
 * screen. Without it these pages would follow only the OS until something
 * re-applied the choice after hydration, and flash the wrong theme.
 *
 * Fonts stay in _app.tsx: next/font does not emit its CSS from a document
 * (see the comment there).
 */
export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* The landing's chosen teacher (V8.3c), for its posters: harmless elsewhere. */}
        <script dangerouslySetInnerHTML={{ __html: TEACHER_INIT_SCRIPT }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
