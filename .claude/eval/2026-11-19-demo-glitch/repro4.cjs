// Does the desk paper's CSS 3D transform keep changing after the camera has landed?
const path = require("path"); const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
const [, , base = "https://aristo-ai-ten.vercel.app", vp = "1440x900"] = process.argv;
const [W, H] = vp.split("x").map(Number); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] });
  const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
  await page.route("**/api/**", (r) => r.abort());
  await page.goto(`${base}/demo`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.querySelector('[class*="z-[100]"]') && !!document.querySelector("canvas"), null, { timeout: 90000 });
  await sleep(1000); await page.getByText("How Volcanoes Erupt").first().click(); await sleep(2500);
  if (process.argv[4] === "1") { await page.mouse.move(400, 400); await page.mouse.down(); for (let i = 1; i <= 15; i++) { await page.mouse.move(400 + i * 20, 400 + i * 6); await sleep(30); } await page.mouse.up(); await sleep(300); }
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Take the quiz/i.test(b.innerText))?.click());
  for (const wait of [2000, 4000, 4000, 6000]) {
    await sleep(wait);
    const r = await page.evaluate(async () => {
      const p = document.querySelector(".aristo-paper"); const els = []; let e = p; for (let k = 0; k < 4 && e; k++) { e = e.parentElement; els.push(e); }
      const seen = els.map(() => new Set()); let frames = 0; const zs = new Set();
      await new Promise((res) => { const t0 = performance.now(); (function f() { els.forEach((el, i) => seen[i].add(el.style.transform + "|" + el.style.zIndex)); frames++; if (performance.now() - t0 < 1500) requestAnimationFrame(f); else res(); })(); });
      return { frames, distinctPerLevel: seen.map((s) => s.size), sample: [...seen[1]].slice(0, 2).map((s) => s.slice(0, 160)) };
    });
    console.log(vp, "after", wait, JSON.stringify(r));
  }
  await browser.close();
})();
