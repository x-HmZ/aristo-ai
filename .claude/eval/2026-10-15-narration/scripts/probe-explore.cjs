const path = require("path"); const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] });
  const page = await (await browser.newContext({ viewport: { width: +process.argv[2] || 1280, height: +process.argv[3] || 720 } })).newPage();
  await page.goto("http://localhost:3000/demo", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.querySelector('[class*="z-[100]"]') && !!document.querySelector("canvas"), null, { timeout: 120000 });
  await page.getByText("Steepness Is Speed").first().click();
  await page.waitForFunction(() => /activate/i.test(document.body.innerText), null, { timeout: 30000 });
  const state = () => page.evaluate(() => ({ seg: (document.body.innerText.match(/seg (\d+) \/ 15/) || [])[1], card: !!document.querySelector('[data-testid="interactive-card"]'), strip: !!document.querySelector('[data-testid="interactive-strip"]'), cont: /Continue/.test(document.body.innerText), frame: document.querySelectorAll("iframe").length, status: document.querySelector("[data-widget-status]")?.getAttribute("data-widget-status") }));
  for (let i = 0; i < 60; i++) { await sleep(2000); const s = await state(); console.log(i * 2, JSON.stringify(s)); if (s.seg && +s.seg < 10) await page.getByLabel("Next sentence").click().catch(() => {}); if (s.cont) { await sleep(1500); await page.screenshot({ path: path.join(__dirname, "..", `explore-${process.argv[2]}x${process.argv[3]}.png`) }); const vis = await page.evaluate(() => [...document.querySelectorAll("[data-testid]")].map((e) => e.dataset.testid + ":" + (e.getBoundingClientRect().width > 0))); console.log("VISIBLE", JSON.stringify(vis)); break; } }
  await browser.close();
})();
