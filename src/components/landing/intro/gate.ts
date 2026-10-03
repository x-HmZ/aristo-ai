/**
 * Whether the opening plays (V8.3c), decided before the first paint by `_document`'s inline script so the ink cover is
 * there from the first frame: only on `/`, once per tab (sessionStorage), never under reduced motion or Save-Data,
 * only with WebGL2, and never for the verification's captures (`?probe`, `?still`, `?lite`, `?nointro`). It sets
 * `<html data-intro="on">`; Intro.tsx moves it to "playing", "lifting" and then "done". If the opening has not started
 * by FAILSAFE_MS (a chunk that never loads, a slow load), the script itself lifts the cover and says so; a late Intro
 * then finishes at once instead of covering a page being read. With no JS there is no attribute and no cover.
 */
export const INTRO_KEY = "aristo-intro-seen";
export const INTRO_DONE_EVENT = "aristo:intro-done";
export const FAILSAFE_MS = 6000;

export const INTRO_INIT_SCRIPT = `try{var d=document.documentElement,q=location.search;if(location.pathname==="/"&&!/[?&](probe|still|lite|nointro)\\b/.test(q)&&!sessionStorage.getItem("${INTRO_KEY}")&&!(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches)&&!(navigator.connection&&navigator.connection.saveData)&&window.WebGL2RenderingContext){d.setAttribute("data-intro","on");setTimeout(function(){if(d.getAttribute("data-intro")==="on"){d.setAttribute("data-intro","done");window.dispatchEvent(new Event("${INTRO_DONE_EVENT}"))}},${FAILSAFE_MS})}}catch(e){}`;

/** The intro is on (set before the first paint), playing or lifting: anything but done. */
export const introPending = (): boolean => {
  const v = typeof document === "undefined" ? null : document.documentElement.dataset.intro;
  return v === "on" || v === "playing" || v === "lifting";
};
