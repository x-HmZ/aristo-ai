// Where does the teaching image sit on screen? Captures /dev/free-model's image stage at three sizes.
// Usage: node board-ref.cjs [baseUrl]
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
const base = process.argv[2] || "http://localhost:3000";
const OUT = path.join(__dirname, "..", "board-ref");
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] });
  for (const [w, h] of [[1280, 720], [1024, 768], [1920, 1080]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.goto(`${base}/dev/free-model`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="stage-image"]', { timeout: 90000 });
    await page.click('[data-testid="stage-image"]');
    await sleep(9000); // scene + room + avatar
    await page.screenshot({ path: path.join(OUT, `image-${w}x${h}.jpg`), type: "jpeg", quality: 70 });
    await ctx.close();
  }
  await browser.close();
})();
