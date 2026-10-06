// V8.7 step 2: /dev/avatar-lab, /dev/desk-quiz and /dev/free-model (dev tools, desktop only) in both real themes at
// 1280x800: a screenshot, the AA check, and a click on the page's own test-id'd control (handlers intact).
//   node devpages.cjs <label> [baseUrl]
const fs = require("fs");
const path = require("path");
const { sleep, LAUNCH, chromium, themedContext, guardApi } = require("./common.cjs");
const { AA } = require("./check.cjs");

const label = process.argv[2] || "after";
const base = process.argv[3] || "http://localhost:3000";
const OUT = path.join(__dirname, "..", label);
fs.mkdirSync(OUT, { recursive: true });
const PAGES = [
  ["avatar-lab", "/dev/avatar-lab", 'aside button'],
  ["desk-quiz", "/dev/desk-quiz", '[data-testid="toggle-quiz"]'],
  ["free-model", "/dev/free-model", '[data-testid="stage-image"]'],
];

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [], shots: {} };
  for (const theme of ["light", "dark"]) for (const [name, url, ctl] of PAGES) {
    if (process.env.ONLY && !process.env.ONLY.split(",").includes(name)) continue;
    const key = `${name}-1280-${theme}`;
    const ctx = await themedContext(browser, theme, { width: 1280, height: 800 });
    const page = await ctx.newPage();
    await guardApi(page, report);
    try {
      await page.goto(base + url, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("canvas", { timeout: 90000 });
      await sleep(4000);
      await page.screenshot({ path: path.join(OUT, `${key}.jpg`), type: "jpeg", quality: 78 });
      await page.evaluate(() => { window.__occl = true; });
      const aa = await page.evaluate(AA, "");
      const clicked = await page.evaluate((sel) => { const b = document.querySelector(sel); if (!b) return false; b.click(); return true; }, ctl);
      report.shots[key] = { n: aa.length, min: aa.length ? Math.min(...aa.map((r) => r.ratio)) : null, fails: aa.filter((r) => r.ratio < r.need).map((r) => `${r.t} | ${r.ratio} | ${r.fg} on ${r.bg} | ${r.size}px`), clicked };
      console.log(`${key}: n=${aa.length} min=${report.shots[key].min} fails=${report.shots[key].fails.length} clicked=${clicked}`);
    } catch (e) { report.shots[key] = { error: String(e.message || e) }; console.log(`${key}: ERROR ${e.message}`); }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "report-devpages.json"), JSON.stringify(report, null, 1));
  console.log(`api at network: ${report.api.length}, paid: ${report.paid.length}`);
})();
