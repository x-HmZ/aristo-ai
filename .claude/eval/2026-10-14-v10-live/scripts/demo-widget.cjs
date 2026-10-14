// /demo's frozen-widget path: pick "Python Loops with range()", skip to the explore segment, and check the frozen
// widget shows on the board and pauses the lesson, with no /api request at all. 0 paid calls.
// Usage: node demo-widget.cjs [baseUrl=http://localhost:3000]
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
const base = process.argv[2] || "http://localhost:3000";
const OUT = path.join(__dirname, "..", "python-for-range");
const report = { checks: [], problems: [] };
const ok = (name, pass, extra = "") => { report.checks.push({ name, pass, extra }); if (!pass) report.problems.push(`${name} ${extra}`); console.log(pass ? "PASS" : "FAIL", name, extra); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clickText = (page, re) => page.evaluate(([src, fl]) => {
  const re = new RegExp(src, fl);
  const b = [...document.querySelectorAll("button")].find((x) => re.test(x.innerText.trim()) || re.test(x.getAttribute("aria-label") || ""));
  if (b && !b.disabled) { b.click(); return true; }
  return false;
}, [re.source, re.flags]);

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] });
  for (const [w, h] of [[1280, 720], [390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    const api = [];
    page.on("request", (r) => { if (new URL(r.url()).pathname.startsWith("/api/")) api.push(r.url()); });
    await page.goto(`${base}/demo`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !document.querySelector('[class*="z-[100]"]') && !!document.querySelector("canvas"), null, { timeout: 120000 });
    await sleep(800);
    await page.getByText("Python Loops with range()").first().click();
    await page.waitForFunction(() => /activate/i.test(document.body.innerText), null, { timeout: 30000 });
    let card = false;
    // One step at a time, watching closely: the narration mp3s are not rendered yet, so segments end fast.
    const cardUp = () => page.locator('[data-testid="interactive-card"]').isVisible().catch(() => false);
    for (let i = 0; i < 40 && !card; i++) {
      for (let t = 0; t < 25 && !card; t++) { await sleep(150); card = await cardUp(); }
      if (!card) await clickText(page, /^(Next →|Next)$|^(Next ⏭|Skip)$|Next sentence|Skip segment/);
    }
    ok(`${w}x${h}: the frozen widget is on screen at the explore segment`, card);
    const frame = page.frames().find((f) => f.parentFrame() && f.url() === "about:srcdoc");
    const status = await page.locator("[data-widget-status]").first().getAttribute("data-widget-status").catch(() => null);
    ok(`${w}x${h}: the widget ran (ready)`, status === "ready", String(status));
    if (frame) {
      await frame.evaluate(() => { const r = document.querySelector("input[type=range]"); r.value = String(+r.max); r.dispatchEvent(new Event("input", { bubbles: true })); });
      await sleep(300);
    }
    const paused = await page.evaluate(() => /Continue/.test(document.body.innerText));
    ok(`${w}x${h}: the lesson waits with a Continue`, paused);
    await page.screenshot({ path: path.join(OUT, `demo-explore-${w}x${h}.jpg`), type: "jpeg", quality: 75 });
    ok(`${w}x${h}: no /api request`, api.length === 0, api.join(" "));
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "demo-widget-report.json"), JSON.stringify(report, null, 2));
  console.log(report.problems.length ? `\n${report.problems.length} PROBLEMS` : "\nALL PASS");
})().catch((e) => { console.error(e); process.exit(2); });
