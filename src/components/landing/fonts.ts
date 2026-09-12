import { Archivo } from "next/font/google";

/**
 * The landing page's display face, kept out of src/lib/fonts.ts on purpose.
 *
 * That module is imported by both routers' roots, so anything declared there
 * is preloaded on /learn and /demo as well. Archivo is only ever used by the
 * landing page's `.lp-display` headings, so it lives here and loads only
 * where page.tsx imports it.
 *
 * The `wdth` axis is what `.lp-display` sets to 125 in globals.css. Weight is
 * left variable (no `weight` option) because the axes option requires it.
 */
export const displayFont = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-display",
  display: "swap",
});
