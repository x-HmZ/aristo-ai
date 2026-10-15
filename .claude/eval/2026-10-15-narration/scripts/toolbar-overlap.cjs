// Under the display: "Open interactive" (and Continue) must sit in the picture toolbar's row, never on top of it
// (Hmz, 2026-10-15). Steepness on /demo: before the explore segment (widget ready, hidden) and after Hide at the
// explore pause. Checks every visible button and chip under the screen for overlap, and saves a crop. 0 paid calls.
// Usage: node toolbar-overlap.cjs [baseUrl=http://localhost:3000] [outDir]
const path = require("path");
const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
const base = process.argv[2] || "http://localhost:3000";
const OUT = process.argv[3] || path.join(__dirname, "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const problems = [];
const ok = (name, pass, extra = "") => { console.log(pass ? "PASS" : "FAIL", name, extra); if (!pass) problems.push(name); };

// Controls below the screen's bottom edge, with their rectangles, and any pair that overlaps.
const underScreen = (page) => page.evaluate(() => {
  const s = window.__aristoStore?.getState?.().screenRect;
  const els = [...document.querySelectorAll("button, [class*='rounded-full']")].filter((e) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.height < 60 && getComputedStyle(e).visibility !== "hidden" && /\S/.test(e.innerText);
  });
  const boxes = els.map((e) => { const r = e.getBoundingClientRect(); return { t: e.innerText.trim().slice(0, 24), x: r.x, y: r.y, w: r.width, h: r.height, el: e }; });
  const near = boxes.filter((b) => /Open interactive|Expand|zoom|Continue|Show image|View in 3D|Show 3D|reset/.test(b.t));
  const overlaps = [];
  for (let i = 0; i < near.length; i++) for (let j = i + 1; j < near.length; j++) {
    const a = near[i], b = near[j];
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (ix > 1 && iy > 1) overlaps.push(`${a.t} x ${b.t}`);
  }
  return { controls: near.map((b) => `${b.t}@${Math.round(b.x)},${Math.round(b.y)}`), overlaps, screen: s };
});

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] });
  for (const [w, h] of [[1920, 1080], [1600, 900]]) {
    const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
    await page.goto(`${base}/demo`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !document.querySelector('[class*="z-[100]"]') && !!document.querySelector("canvas"), null, { timeout: 180000 });
    await sleep(800);
    await page.getByText("Steepness Is Speed").first().click();
    await page.waitForFunction(() => /activate/i.test(document.body.innerText), null, { timeout: 30000 });
    const segNo = () => page.evaluate(() => +((document.body.innerText.match(/seg (\d+) \/ 15/) || [])[1] || 0));
    // Before the explore segment: a picture on the screen and the ready widget's reopen control.
    for (let i = 0; i < 20 && (await segNo()) < 8; i++) { await page.getByLabel("Next sentence").click().catch(() => {}); await sleep(1200); }
    await page.waitForFunction(() => /Open interactive/.test(document.body.innerText) && /Expand/.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
    await sleep(1200);
    let r = await underScreen(page);
    ok(`${w}x${h} before explore: no overlap`, r.overlaps.length === 0, `${r.controls.join(" | ")} ${r.overlaps.join(", ")}`);
    ok(`${w}x${h} before explore: one Open interactive`, r.controls.filter((c) => c.startsWith("Open interactive")).length === 1);
    await page.screenshot({ path: path.join(OUT, `toolbar-before-${w}.png`), clip: { x: 0, y: Math.round(h * 0.45), width: Math.round(w * 0.8), height: Math.round(h * 0.25) } });
    // The explore pause, then Hide: the picture comes back with Open interactive and Continue in its row.
    for (let i = 0; i < 20 && (await segNo()) < 10; i++) { await page.getByLabel("Next sentence").click().catch(() => {}); await sleep(1200); }
    await page.waitForFunction(() => /Continue/.test(document.body.innerText), null, { timeout: 90000 });
    await sleep(800);
    await page.getByLabel("Hide the interactive").first().click();
    await sleep(1500);
    r = await underScreen(page);
    ok(`${w}x${h} hidden at the pause: no overlap`, r.overlaps.length === 0, `${r.controls.join(" | ")} ${r.overlaps.join(", ")}`);
    ok(`${w}x${h} hidden at the pause: Continue still reachable`, r.controls.some((c) => c.startsWith("Continue")));
    await page.screenshot({ path: path.join(OUT, `toolbar-paused-${w}.png`), clip: { x: 0, y: Math.round(h * 0.45), width: Math.round(w * 0.8), height: Math.round(h * 0.25) } });
    await page.context().close();
  }
  await browser.close();
  console.log(problems.length ? `\n${problems.length} problem(s)` : "\nall pass");
})();
