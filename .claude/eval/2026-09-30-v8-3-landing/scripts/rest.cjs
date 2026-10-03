// The opening at rest (no scrolling): once live, the poster has given way and the window shows the live room.
// Also the screen-reader view: headings and the transcript are in the accessibility tree before any scroll.
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , base] = process.argv;
(async () => {
  const b = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [] };
  const ctx = await themedContext(b, "light", { width: 1280, height: 800 });
  const p = await ctx.newPage();
  await guardApi(p, report);
  await p.goto(base + "/", { waitUntil: "load" });
  await p.waitForFunction(() => document.documentElement.dataset.stage === "live", null, { timeout: 90000 });
  await sleep(2500);
  const poster = await p.evaluate(() => getComputedStyle(document.querySelector(".landing-poster")).opacity);
  await p.screenshot({ path: path.join(__dirname, "..", "rest-1280-light.png") });
  // The accessibility tree as Playwright's ARIA snapshot (what a screen reader's virtual cursor can reach).
  const aria = await p.locator("body").ariaSnapshot();
  const headings = aria.split(String.fromCharCode(10)).filter((l) => l.includes("- heading")).map((l) => l.trim());
  const buttons = await p.evaluate(() => [...document.querySelectorAll("button, a")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && getComputedStyle(e).visibility !== "hidden"; }).length);
  console.log(JSON.stringify({ posterOpacity: poster, headings, reachableControls: buttons, api: report.api.length, paid: report.paid.length }, null, 1));
  await b.close();
})();
