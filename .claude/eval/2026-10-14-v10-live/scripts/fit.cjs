// Does each widget fit the board card at 1280x720 without scrolling? Measures every fixture and every saved live
// widget in /dev/interactive at the card's frame size (the card is clamp(340px, 30vw, 460px) wide; at 1280x720 its
// frame is 384 x 375; room.cjs measures the real card for the fixtures). 0 API calls.
// Usage: node fit.cjs [baseUrl=http://localhost:3000] [frameW=384] [frameH=375]
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
const base = process.argv[2] || "http://localhost:3000";
const W = +(process.argv[3] || 384), H = +(process.argv[4] || 375);
const DIR = path.join(__dirname, "..");

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] });
  const items = [["fixture slope-line", null, "slope-line"], ["fixture fraction-bars", null, "fraction-bars"], ["fixture for-loop", null, "for-loop"]];
  for (const d of fs.readdirSync(DIR)) if (fs.existsSync(path.join(DIR, d, "widget.json"))) items.push([d, JSON.parse(fs.readFileSync(path.join(DIR, d, "widget.json"), "utf8")), null]);
  let bad = 0;
  for (const [name, parts, fixture] of items) {
    const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
    await page.goto(`${base}/dev/interactive?theme=dark&w=${W}${fixture ? `&fixture=${fixture}` : ""}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof window.__showWidget === "function", null, { timeout: 60000 });
    if (parts) await page.evaluate((p) => window.__showWidget(p), parts);
    await page.waitForFunction(() => /ready|failed/.test(document.querySelector('[data-testid="status"]')?.textContent || ""), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(400);
    const frame = page.frames().find((f) => f.parentFrame());
    const h = frame ? await frame.evaluate(() => Math.ceil(document.getElementById("app").getBoundingClientRect().bottom + 10)) : -1;
    const fits = h > 0 && h <= H;
    if (!fits) bad++;
    console.log(`${fits ? "FITS" : "OVER"} ${name}: ${h}px tall at ${W}px (frame ${H}px)`);
    await page.close();
  }
  await browser.close();
  console.log(bad ? `\n${bad} over` : "\nALL FIT");
})().catch((e) => { console.error(e); process.exit(2); });
