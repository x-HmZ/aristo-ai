// Shared helpers for the V8.4c scripts. Free routes only (/demo, /dev/*). Every /api call is aborted at the
// network layer unless the page mocks it in the browser first (the /dev/learn-shell harness does).
const path = require("path");
const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PAID = /\/api\/(learn\/(challenge|explain-more|lesson|complete|segment-visuals)|generate|tts|quiz\/(generate|submit|lesson)|courses\/generate|chat|teach)/;
const LAUNCH = { headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] };

// Real themes, no meta removal: the OS preference (colorScheme) and, for the stored-* themes, a choice in
// localStorage under the app's key, written before any page script runs.
const THEMES = {
  light: { colorScheme: "light", stored: null },
  dark: { colorScheme: "dark", stored: null },
  "stored-dark": { colorScheme: "light", stored: "dark" },
  "stored-light": { colorScheme: "dark", stored: "light" },
};
async function themedContext(browser, theme, viewport, extra = {}) {
  const t = THEMES[theme];
  if (!t) throw new Error("unknown theme " + theme);
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: t.colorScheme, reducedMotion: process.env.REDUCED ? "reduce" : "no-preference", ...extra });
  // The Next dev overlay (build and runtime issues) is not product UI; keep it out of the shots.
  await ctx.addInitScript(() => {
    const hide = () => document.querySelectorAll("nextjs-portal").forEach((e) => { e.style.setProperty("display", "none", "important"); });
    new MutationObserver(hide).observe(document, { childList: true, subtree: true });
  });
  if (t.stored) await ctx.addInitScript((v) => { try { localStorage.setItem("aristo-theme", v); } catch {} }, t.stored);
  return ctx;
}

// Abort every /api request that reaches the network (the in-page mocks answer before fetch leaves the page),
// and record it. `report.api` must stay empty for the harness; `report.paid` must stay empty everywhere.
async function guardApi(page, report) {
  await page.route("**/api/**", (route) => { report.api.push(route.request().url()); return route.abort(); });
  page.on("request", (r) => { if (PAID.test(r.url())) report.paid.push(r.url()); });
}

async function sceneReady(page) {
  await page.waitForFunction(() => !document.querySelector('[class*="z-[100]"]') && !!document.querySelector("canvas"), null, { timeout: 90000 });
  await sleep(800);
}
const click = (page, re) => page.evaluate(([s, f]) => {
  const r = new RegExp(s, f);
  const b = [...document.querySelectorAll("button, a")].find((x) => r.test(x.innerText.trim()) || r.test(x.getAttribute("aria-label") || "") || r.test(x.getAttribute("title") || ""));
  if (b && !b.disabled) { b.click(); return true; }
  return false;
}, [re.source, re.flags]);

// A SpeechRecognition that never touches the microphone: start() succeeds and stays "listening".
const FAKE_SR = () => {
  class R { start() {} stop() { this.onend && this.onend(); } abort() {} }
  window.SpeechRecognition = R;
  window.webkitSpeechRecognition = R;
};

// Layout facts per state: horizontal overflow, the panel column inside the viewport, the desk card against
// the panel and the strip, the top bar pills inside the viewport.
const LAYOUT = () => {
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); if (!r.width) return null; return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; };
  const hit = (a, b) => !!(a && b && a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]);
  const panel = [...document.querySelectorAll('[class*="w-[400px]"]')].find((e) => getComputedStyle(e).display !== "none" && e.getBoundingClientRect().width > 0 && !e.closest("[data-h]"));
  const card = document.querySelector(".aristo-paper");
  const strip = [...document.querySelectorAll("span")].find((s) => /quiz is on the desk/i.test(s.textContent))?.parentElement;
  const bars = [...document.querySelectorAll('[class*="z-[35]"], [class*="z-[45]"]')].map(box);
  const P = box(panel), C = box(card), S = box(strip);
  return {
    vw: innerWidth, vh: innerHeight, scrollW: document.documentElement.scrollWidth,
    panel: P, panelInside: P ? P[0] >= 0 && P[2] <= innerWidth : null,
    card: C, cardUnderPanel: hit(C, P), cardUnderStrip: hit(C, S),
    bars, barsInside: bars.every((b) => !b || (b[0] >= 0 && b[2] <= innerWidth)),
    theme: document.documentElement.getAttribute("data-theme"), lock: !!document.querySelector('meta[name="aristo-theme-lock"]'),
    bodyBg: getComputedStyle(document.body).backgroundColor,
  };
};

module.exports = { chromium, sleep, PAID, LAUNCH, THEMES, themedContext, guardApi, sceneReady, click, FAKE_SR, LAYOUT };
