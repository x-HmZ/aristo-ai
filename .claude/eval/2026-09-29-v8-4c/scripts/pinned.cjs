// The V8.6 surfaces on /learn (onboarding, dashboard, course map) are pinned light with .theme-paper now that the
// lock is gone: shoot them under OS light and OS dark and run the AA check on them. Harness only, /api mocked in page.
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi, sceneReady, click } = require("./common.cjs");
const { AA } = require("./check.cjs");
const base = process.argv[2] || "http://localhost:3000";
const OUT = path.join(__dirname, "..", "after-pinned");
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [], aa: {} };
  for (const theme of ["light", "dark"]) {
    const ctx = await themedContext(browser, theme, { width: 1280, height: 720 });
    const page = await ctx.newPage();
    await guardApi(page, report);
    const snap = async (name) => { await page.screenshot({ path: path.join(OUT, `${name}-${theme}.jpg`), type: "jpeg", quality: 72 }); const a = await page.evaluate(AA, ".theme-paper"); report.aa[`${name}-${theme}`] = { n: a.length, fails: a.filter((r) => r.ratio < r.need).map((r) => `${r.t} ${r.ratio}`), min: Math.min(...a.map((r) => r.ratio)) }; };
    await page.goto(`${base}/dev/learn-shell?onboarded=0`, { waitUntil: "domcontentloaded" }); await sceneReady(page).catch(() => {}); await sleep(1500);
    await snap("onboarding");
    await page.goto(`${base}/dev/learn-shell`, { waitUntil: "domcontentloaded" }); await sceneReady(page); await sleep(1000);
    await click(page, /^Earth Science/); await sleep(2000);
    await snap("course-map");
    await page.goto(`${base}/dev/learn-shell`, { waitUntil: "domcontentloaded" }); await sceneReady(page); await sleep(1000);
    await click(page, /Explore [Ff]reely/); await sleep(600);
    await click(page, /Progress/); await sleep(1500);
    await snap("dashboard");
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "report-pinned.json"), JSON.stringify(report, null, 1));
  for (const [k, v] of Object.entries(report.aa)) console.log(k, "nodes", v.n, "min", v.min.toFixed ? v.min.toFixed(2) : v.min, "fails", v.fails.length, v.fails.slice(0, 6).join(" | "));
  console.log("paid", report.paid.length, "api at network", report.api.length);
})();
