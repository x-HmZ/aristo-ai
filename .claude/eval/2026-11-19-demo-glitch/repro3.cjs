// Pixel flicker on the settled desk view: 30 screenshots 80 ms apart, mean abs diff between neighbours.
const path = require("path"); const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
const sharp = require(path.join(__dirname, "../../../node_modules/sharp"));
const [, , base = "https://aristo-ai-ten.vercel.app", vp = "1440x900", drag = "0"] = process.argv;
const [W, H] = vp.split("x").map(Number); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] });
  const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
  await page.route("**/api/**", (r) => r.abort());
  await page.goto(`${base}/demo`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.querySelector('[class*="z-[100]"]') && !!document.querySelector("canvas"), null, { timeout: 90000 });
  await sleep(1000); await page.getByText("How Volcanoes Erupt").first().click(); await sleep(2500);
  if (drag === "1") { await page.mouse.move(400, 400); await page.mouse.down(); for (let i = 1; i <= 15; i++) { await page.mouse.move(400 + i * 20, 400); await sleep(30); } await page.mouse.up(); await sleep(800); }
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Take the quiz/i.test(b.innerText))?.click());
  await sleep(4000);
  const bufs = []; for (let i = 0; i < 30; i++) { bufs.push(await page.screenshot({ type: "png" })); await sleep(80); }
  const raws = await Promise.all(bufs.map((b) => sharp(b).removeAlpha().raw().toBuffer()));
  const diffs = []; let worst = { d: 0, i: 0 };
  for (let i = 1; i < raws.length; i++) { const a = raws[i - 1], b = raws[i]; let s = 0, n = 0; for (let k = 0; k < a.length; k += 4) { const d = Math.abs(a[k] - b[k]); s += d; if (d > 40) n++; } diffs.push([+(s / (a.length / 4)).toFixed(3), n]); if (n > worst.d) worst = { d: n, i }; }
  console.log(vp, "drag=" + drag, "mean|changedPx>40 per pair:", JSON.stringify(diffs));
  if (worst.d > 0) { await sharp(bufs[worst.i - 1]).toFile(path.join(__dirname, `flick-${vp}-${drag}-a.png`)); await sharp(bufs[worst.i]).toFile(path.join(__dirname, `flick-${vp}-${drag}-b.png`)); }
  await browser.close();
})();
