// Cold-load timing of /demo (same classroom bundle as /learn), fresh context per run = empty cache.
const path = require("path");
const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
const [, , base = "http://localhost:3100", runs = "5"] = process.argv;
(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] });
  const rows = [];
  for (let i = 0; i < Number(runs); i++) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    await page.goto(`${base}/demo`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !document.querySelector('[class*="z-[100]"]') && !!document.querySelector("canvas"), null, { timeout: 90000, polling: 50 });
    const m = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      const fcp = performance.getEntriesByType("paint").find((p) => p.name === "first-contentful-paint");
      const res = performance.getEntriesByType("resource");
      const js = res.filter((r) => r.name.endsWith(".js"));
      const css = res.filter((r) => r.name.endsWith(".css"));
      return {
        sceneReady: Math.round(performance.now()),
        fcp: Math.round(fcp ? fcp.startTime : -1),
        dcl: Math.round(nav.domContentLoadedEventEnd),
        jsKB: +(js.reduce((a, r) => a + r.encodedBodySize, 0) / 1024).toFixed(1),
        cssKB: +(css.reduce((a, r) => a + r.encodedBodySize, 0) / 1024).toFixed(1),
      };
    });
    rows.push(m);
    await ctx.close();
  }
  await browser.close();
  const med = (k) => { const v = rows.map((r) => r[k]).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
  console.log(JSON.stringify(rows));
  console.log("median", JSON.stringify({ sceneReady: med("sceneReady"), fcp: med("fcp"), dcl: med("dcl"), jsKB: med("jsKB"), cssKB: med("cssKB") }));
})();
