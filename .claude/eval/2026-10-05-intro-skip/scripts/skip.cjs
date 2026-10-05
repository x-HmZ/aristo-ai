// The opening's Skip button, every frame (2026-10-05). For each theme and width: load / with the opening on, and on
// every animation frame record the opening's state (html[data-intro]), whether Skip is reachable (visible, in the a11y
// tree, takes pointer events) and its AA ratio by check.cjs's method (../../2026-09-29-v8-4c/scripts/check.cjs).
// Then three plays: let it run (it must reach "done"), press Skip from the keyboard (Tab, Enter: it must finish
// sooner, and the next Tab must land on the page's header), and tap the overlay. Usage: node skip.cjs [base] [widths] [themes]
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const { AA } = require("../../2026-09-29-v8-4c/scripts/check.cjs");
const [, , base = "http://localhost:3000", widths = "360,768,1280", themes = "light,dark"] = process.argv;

// Page side: one sample per frame until the opening is done (or 12 s).
const SAMPLER = `window.__skipLog = []; window.__skipT0 = performance.now();
(() => {
  const AA = ${AA.toString()};
  const tick = () => {
    const html = document.documentElement, b = document.querySelector(".landing-intro-skip");
    const row = { ms: Math.round(performance.now() - window.__skipT0), s: html.dataset.intro || "none" };
    if (b) {
      const cs = getComputedStyle(b);
      row.vis = cs.visibility; row.op = +cs.opacity; row.pe = cs.pointerEvents;
      const aa = AA(".landing-intro-skip");
      row.ratio = aa.length ? aa[0].ratio : null; row.bg = aa.length ? aa[0].bg : null;
    }
    window.__skipLog.push(row);
    if (row.s !== "done" && performance.now() - window.__skipT0 < 12000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();`;

async function play(b, theme, w, how, report) {
  const ctx = await themedContext(b, theme, { width: w, height: 800 });
  await ctx.addInitScript({ content: `document.addEventListener("DOMContentLoaded", () => { ${SAMPLER} });` });
  const p = await ctx.newPage();
  await guardApi(p, report);
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  await p.goto(base + "/", { waitUntil: "domcontentloaded" });
  await p.waitForFunction(() => document.documentElement.dataset.intro === "playing", null, { timeout: 20000 }).catch(() => {});
  const startedAt = await p.evaluate(() => Math.round(performance.now() - window.__skipT0));
  let focusAfter = null;
  if (how === "key") {
    await sleep(600);
    // Tab reaches Skip first (the page under the cover is inert) and does not hurry; Enter does.
    await p.keyboard.press("Tab");
    const focused = await p.evaluate(() => document.activeElement && document.activeElement.textContent.trim());
    await p.keyboard.press("Enter");
    await p.waitForFunction(() => document.documentElement.dataset.intro === "done", null, { timeout: 15000 });
    await sleep(200);
    await p.keyboard.press("Tab");
    focusAfter = await p.evaluate((f) => ({ skipFocused: f, next: (document.activeElement.closest("header") ? "header: " : "elsewhere: ") + (document.activeElement.textContent || document.activeElement.tagName).trim().slice(0, 30) }), focused);
  } else if (how === "tap") {
    await sleep(600);
    await p.mouse.click(Math.round(w / 2), 400);
  }
  await p.waitForFunction(() => document.documentElement.dataset.intro === "done", null, { timeout: 15000 });
  await sleep(150); // the sampler's next frame records "done"
  const log = await p.evaluate(() => window.__skipLog);
  await ctx.close();
  const on = log.filter((r) => r.vis === "visible" && r.op > 0);
  const states = [...new Set(log.map((r) => r.s))];
  const doneAt = (log.find((r) => r.s === "done") || {}).ms;
  const liftAt = (log.find((r) => r.s === "lifting") || {}).ms;
  return {
    theme, w, how, frames: log.length, states, startedAt, liftAt, doneAt, playMs: doneAt - startedAt,
    skipShownIn: [...new Set(on.map((r) => r.s))],
    skipMinRatio: on.length ? Math.min(...on.filter((r) => r.ratio !== null).map((r) => r.ratio)) : null,
    skipFails: on.filter((r) => r.ratio !== null && r.ratio < 4.5).length,
    low: on.filter((r) => r.ratio !== null && r.ratio < 4.5).map((r) => ({ ms: r.ms - startedAt, s: r.s, op: r.op, ratio: r.ratio, bg: r.bg })),
    tail: log.slice(-2),
    // Once lifting starts, Skip must be gone on every frame: hidden, transparent and out of pointer reach.
    afterLiftLeaks: log.filter((r) => (r.s === "lifting" || r.s === "done") && r.vis !== undefined && (r.vis !== "hidden" || r.op !== 0 || r.pe !== "none")).length,
    focusAfter, errors,
  };
}

(async () => {
  const b = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [], runs: [] };
  for (const theme of themes.split(",")) for (const w of widths.split(",").map(Number)) for (const how of ["watch", "key", "tap"]) {
    const r = await play(b, theme, w, how, report);
    report.runs.push(r);
    console.log(JSON.stringify(r));
  }
  const out = path.join(__dirname, "..", "skip.json");
  fs.writeFileSync(out, JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ api: report.api.length, paid: report.paid.length, out }));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
