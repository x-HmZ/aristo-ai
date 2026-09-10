/**
 * Landing-page theme plumbing shared by the pre-paint script (rendered by the
 * server component in src/app/page.tsx) and ThemeToggle (a client leaf).
 *
 * The OS preference is the default and needs no JS at all: globals.css reads
 * prefers-color-scheme. An explicit choice is stored in localStorage and
 * mirrored onto <html> as `data-landing-theme`, which the CSS lets win over
 * the media query. Only "light" and "dark" are ever accepted from storage;
 * anything else is treated as no choice.
 */

export const THEME_STORAGE_KEY = "aristo-landing-theme";
export const THEME_ATTRIBUTE = "data-landing-theme";

export type LandingTheme = "light" | "dark";

export function isLandingTheme(value: unknown): value is LandingTheme {
  return value === "light" || value === "dark";
}

/**
 * Applies a stored choice before the landing markup below it is parsed, so a
 * visitor who picked dark never sees a light first paint. It is inline and
 * synchronous for exactly that reason. Storage access is wrapped because it
 * throws in some privacy modes; the fallback is simply the OS preference.
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}"),r=document.documentElement;if(t==="light"||t==="dark")r.setAttribute("${THEME_ATTRIBUTE}",t);else r.removeAttribute("${THEME_ATTRIBUTE}")}catch(e){}`;
