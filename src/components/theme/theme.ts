/**
 * App-wide theme plumbing shared by the pre-paint script (rendered in the
 * <head> of src/app/layout.tsx) and ThemeToggle (a client leaf).
 *
 * The OS preference is the default and needs no JS at all: globals.css reads
 * prefers-color-scheme. An explicit choice is stored in localStorage and
 * mirrored onto <html> as `data-theme`, which the CSS lets win over the media
 * query. Only "light" and "dark" are ever accepted from storage; anything
 * else is treated as no choice.
 *
 * Surfaces not yet on the design system render
 * <meta name={THEME_LOCK_META} content="light">, and globals.css keeps them
 * light whatever the choice (see .claude/docs/brand-system.md).
 */

export const THEME_STORAGE_KEY = "aristo-theme";
export const THEME_ATTRIBUTE = "data-theme";
export const THEME_LOCK_META = "aristo-theme-lock";

/** The landing-only key used before V8.2. Read once, then removed. */
export const LEGACY_THEME_STORAGE_KEY = "aristo-landing-theme";

export type Theme = "light" | "dark";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/**
 * Applies a stored choice before the page markup is parsed, so a visitor who
 * picked dark never sees a light first paint. It is inline and synchronous
 * for exactly that reason. A choice saved under the old landing-only key is
 * carried over to the new key the first time, then the old key is deleted.
 * Storage access is wrapped because it throws in some privacy modes; the
 * fallback is simply the OS preference.
 */
export const THEME_INIT_SCRIPT = `try{var s=localStorage,t=s.getItem("${THEME_STORAGE_KEY}"),o=s.getItem("${LEGACY_THEME_STORAGE_KEY}"),r=document.documentElement;if(o!==null){if(t===null&&(o==="light"||o==="dark")){s.setItem("${THEME_STORAGE_KEY}",o);t=o}s.removeItem("${LEGACY_THEME_STORAGE_KEY}")}if(t==="light"||t==="dark")r.setAttribute("${THEME_ATTRIBUTE}",t);else r.removeAttribute("${THEME_ATTRIBUTE}")}catch(e){}`;
