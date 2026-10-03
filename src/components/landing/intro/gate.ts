/**
 * Whether the opening plays (V8.3c), decided before the first paint by `_document`'s inline script so the ink cover is
 * there from the first frame: only on `/`, once per tab (sessionStorage), never under reduced motion or Save-Data,
 * only with WebGL2, and never for the verification's captures (`?probe`, `?still`, `?lite`, `?nointro`). It sets
 * `<html data-intro="on">`; Intro.tsx moves it to "playing" and then "done". A CSS failsafe lifts the cover after a few
 * seconds whatever happens, so a chunk that never loads cannot hide the page; with no JS there is no attribute and no
 * cover.
 */
export const INTRO_KEY = "aristo-intro-seen";
export const INTRO_DONE_EVENT = "aristo:intro-done";

export const INTRO_INIT_SCRIPT = `try{var d=document.documentElement,q=location.search;if(location.pathname==="/"&&!/[?&](probe|still|lite|nointro)\\b/.test(q)&&!sessionStorage.getItem("${INTRO_KEY}")&&!(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches)&&!(navigator.connection&&navigator.connection.saveData)&&window.WebGL2RenderingContext)d.setAttribute("data-intro","on")}catch(e){}`;

/** The intro is on (set before the first paint) or playing. */
export const introPending = (): boolean => {
  const v = typeof document === "undefined" ? null : document.documentElement.dataset.intro;
  return v === "on" || v === "playing";
};
