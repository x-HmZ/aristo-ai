// The callout chips over the board diagram: /demo, brain lesson, the first segment whose chips are up (Explain).
// Captures 1280x720 and 1920x1080 in light and dark, full frame plus a crop of the board, and records where the
// chips sit against the image. 0 API calls. Usage: node callouts.cjs <label> [baseUrl=http://localhost:3000]
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
const label = process.argv[2] || "before";
const base = process.argv[3] || "http://localhost:3000";
const OUT = path.join(__dirname, "..", label);
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clickText = (page, re) => page.evaluate(([src, fl]) => {
  const re = new RegExp(src, fl);
  const b = [...document.querySelectorAll("button")].find((x) => re.test(x.innerText.trim()) || re.test(x.getAttribute("aria-label") || ""));
  if (b && !b.disabled) { b.click(); return true; }
  return false;
}, [re.source, re.flags]);

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] });
  const report = [];
  for (const theme of ["light", "dark"]) for (const [w, h] of [[1280, 720], [1920, 1080]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: theme });
    const page = await ctx.newPage();
    await page.goto(`${base}/demo`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !document.querySelector('[class*="z-[100]"]') && !!document.querySelector("canvas"), null, { timeout: 120000 });
    await sleep(800);
    await page.getByText("How Your Brain Is Organised").first().click();
    await page.waitForFunction(() => /activate/i.test(document.body.innerText), null, { timeout: 30000 });
    let up = false;
    // The lesson plays on its own: the diagram and its chips arrive on seg 4, about 40 s in.
    for (let i = 0; i < 400 && !up; i++) { await sleep(200); up = (await page.locator("[data-callouts]").count()) > 0; }
    await sleep(2500); // let the board image fade in and the Float settle
    await clickText(page, /^Pause$/);
    await sleep(300);
    const box = await page.evaluate(() => {
      const r = document.querySelector("[data-callouts]")?.getBoundingClientRect();
      return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
    });
    const tag = `${theme}-${w}x${h}`;
    await page.screenshot({ path: path.join(OUT, `${tag}.jpg`), type: "jpeg", quality: 85 });
    if (box) {
      const cx = box.x + box.width / 2;
      const clip = { x: Math.max(0, cx - w * 0.2), y: Math.max(0, box.y - h * 0.05), width: w * 0.4, height: h * 0.55 };
      await page.screenshot({ path: path.join(OUT, `${tag}-board.png`), clip });
    }
    report.push({ tag, chips: box && { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) } });
    console.log(tag, JSON.stringify(box));
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(2); });
