// Reference: where the board image sits in the real shell (/demo, public, 0 API calls).
// Usage: node demo-ref.cjs [baseUrl]
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
const base = process.argv[2] || "http://localhost:3000";
const OUT = path.join(__dirname, "..", "demo-ref");
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function clickText(page, re) {
  return page.evaluate(([src, fl]) => {
    const re = new RegExp(src, fl);
    const b = [...document.querySelectorAll("button")].find((x) => re.test(x.innerText.trim()) || re.test(x.getAttribute("aria-label") || ""));
    if (b && !b.disabled) { b.click(); return true; }
    return false;
  }, [re.source, re.flags]);
}
(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] });
  for (const [w, h] of [[1280, 720], [1024, 768], [1920, 1080], [360, 780]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.goto(`${base}/demo`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !document.querySelector('[class*="z-[100]"]') && !!document.querySelector("canvas"), null, { timeout: 120000 });
    await sleep(800);
    await page.getByText("How Volcanoes Erupt").first().click();
    await page.waitForFunction(() => /activate/i.test(document.body.innerText), null, { timeout: 30000 });
    await sleep(2500);
    await clickText(page, /^(Next →|Next)$/);
    await sleep(1500);
    await clickText(page, /^(Next ⏭|Skip)$|Next sentence|Skip segment/);
    await sleep(3500);
    await page.screenshot({ path: path.join(OUT, `image-${w}x${h}.jpg`), type: "jpeg", quality: 72 });
    await ctx.close();
  }
  await browser.close();
})();
