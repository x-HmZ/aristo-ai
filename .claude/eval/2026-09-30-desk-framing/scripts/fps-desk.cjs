// fps in the desk framing on /demo (production build): 3 x 8 s of requestAnimationFrame counting per size, with the
// frame-rate limit and vsync lifted so the number measures cost, not the display. node fps-desk.cjs <baseUrl> [sizes]
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi, sceneReady, click, FAKE_SR } = require("./common.cjs");
const [, , base = "http://localhost:3100", sizesArg = "1280x720,390x844"] = process.argv;
const report = { paid: [], api: [] };
(async () => {
  const browser = await chromium.launch({ ...LAUNCH, args: [...LAUNCH.args, "--disable-gpu-vsync", "--disable-frame-rate-limit"] });
  for (const s of sizesArg.split(",")) {
    const [w, h] = s.split("x").map(Number);
    const ctx = await themedContext(browser, "light", { width: w, height: h });
    await ctx.addInitScript(FAKE_SR);
    const page = await ctx.newPage();
    await guardApi(page, report);
    await page.goto(`${base}/demo`, { waitUntil: "domcontentloaded" });
    await sceneReady(page);
    await page.getByText("How Volcanoes Erupt").first().click();
    await page.waitForFunction(() => /activate/i.test(document.body.innerText), null, { timeout: 30000 });
    await sleep(2500);
    await click(page, /^(Next →|Next)$/); await sleep(1500);
    await click(page, /Next sentence/); await sleep(3500);
    if (!(await click(page, /Take (the )?quiz/i))) { console.log(s, "no take-quiz button"); continue; }
    await sleep(6000);
    const runs = [];
    for (let i = 0; i < 3; i++) {
      runs.push(await page.evaluate(() => new Promise((res) => {
        let n = 0; const t0 = performance.now(); const dts = []; let last = t0;
        const tick = (t) => { n++; dts.push(t - last); last = t; if (t - t0 < 8000) requestAnimationFrame(tick); else { dts.sort((a, b) => a - b); res({ fps: +(n / ((t - t0) / 1000)).toFixed(1), p95ms: +dts[Math.floor(dts.length * 0.95)].toFixed(1) }); } };
        requestAnimationFrame(tick);
      })));
    }
    console.log(s, JSON.stringify(runs), "median fps", runs.map((r) => r.fps).sort((a, b) => a - b)[1]);
    await ctx.close();
  }
  await browser.close();
  console.log("paid", report.paid.length, "api at network", report.api.length);
})();
