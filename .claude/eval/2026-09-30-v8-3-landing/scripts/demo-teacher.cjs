// Regression check for the Teacher `signals` prop: /demo's teacher with Math.random seeded, sampled at fixed
// times after the scene is ready, three runs. Reports each run's pixel hash of the canvas and, between runs,
// the share of differing pixels, so run-to-run noise is visible next to any before/after difference.
// Usage: node demo-teacher.cjs <label> [base]
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { chromium, sleep, LAUNCH, themedContext, guardApi, sceneReady } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , label = "before", base = "http://localhost:3100"] = process.argv;
const OUT = path.join(__dirname, "..", "demo-teacher", label);
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const report = { label, api: [], paid: [], runs: [] };
  for (let run = 0; run < 3; run++) {
    const ctx = await themedContext(browser, "light", { width: 1280, height: 800 });
    await ctx.addInitScript(() => {
      let s = 12345; Math.random = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
      try { sessionStorage.clear(); } catch {}
    });
    const page = await ctx.newPage();
    await guardApi(page, report);
    await page.goto(base + "/demo", { waitUntil: "domcontentloaded" });
    await sceneReady(page);
    const shots = [];
    for (const t of [0, 2000, 4000]) {
      if (t) await sleep(2000);
      const buf = await page.locator("canvas").first().screenshot();
      fs.writeFileSync(path.join(OUT, `run${run}-t${t}.png`), buf);
      shots.push(crypto.createHash("sha1").update(buf).digest("hex").slice(0, 12));
    }
    report.runs.push(shots);
    console.log(label, "run", run, shots.join(" "));
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 1));
  console.log("api", report.api.length, "paid", report.paid.length);
})();
