// Capture the landing's poster and lite stills from the live stage itself (V8.3). Free route only; every /api call
// is aborted. The page's DOM (nav, text) is hidden so each still is the room alone (the 3D desk card too: the lite
// path draws its own in the DOM, readable on a phone); the lite path puts the same DOM back over it.
// Usage: node stills.cjs [base] [outdir=public/images/landing/v3]
//   poster.webp        the opening window at 2x, Jake turned to the board (?pose=board), light theme
//   <name>.webp        1280x800 stills, and <name>-640.webp for small screens
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { chromium, sleep, LAUNCH, themedContext, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const sharp = require(path.join(__dirname, "..", "..", "..", "..", "node_modules", "sharp"));
const [, , base = "http://localhost:3000", outArg] = process.argv;
const ROOT = path.join(__dirname, "..", "..", "..", "..");
const OUT = outArg ? path.resolve(outArg) : path.join(ROOT, "public", "images", "landing", "v3");
fs.mkdirSync(OUT, { recursive: true });

const STILLS = [
  ["idea", 1.5], ["how-1", 2.08], ["how-2", 2.22], ["how-3", 2.4], ["how-4", 2.65], ["how-5", 2.88], ["how-6", 2.96],
  ["move-1", 3.1], ["move-2", 3.3], ["move-3", 3.54], ["move-4", 3.74], ["move-5", 3.92],
];
// Every descendant: the beats set `visibility: visible` inline, which would beat an inherited hide.
const HIDE = `header, header *, main, main *, footer, footer * { visibility: hidden !important; } [data-stage-layer] canvas ~ div { visibility: hidden !important; }`;

const yFor = (S) => {
  const ids = ["top", "idea", "how", "moves", "map", "parents", "start"];
  const i = Math.min(ids.length - 1, Math.floor(S));
  const el = document.getElementById(ids[i]);
  const top = el.getBoundingClientRect().top + scrollY;
  const travel = Math.max(1, ids[i] !== "parents" ? el.offsetHeight - innerHeight : el.offsetHeight);
  return Math.round(top + (S - i) * travel);
};
async function goTo(page, S) {
  const y = await page.evaluate(yFor, S);
  const from = await page.evaluate(() => scrollY);
  const steps = Math.max(1, Math.ceil(Math.abs(y - from) / 250));
  for (let i = 1; i <= steps; i++) { await page.evaluate((v) => scrollTo(0, v), Math.round(from + ((y - from) * i) / steps)); await sleep(30); }
}
async function open(browser, query, dsf) {
  const report = { api: [], paid: [] };
  const ctx = await themedContext(browser, "light", { width: 1280, height: 800 }, { deviceScaleFactor: dsf });
  const page = await ctx.newPage();
  await guardApi(page, report);
  await page.goto(`${base}/?full=1${query}`, { waitUntil: "load" });
  await page.waitForFunction(() => document.documentElement.dataset.stage === "live", null, { timeout: 90000 });
  await sleep(3000);
  return { ctx, page, report };
}
const webp = (buf, file, width, quality) => sharp(buf).resize({ width }).webp({ quality, effort: 6 }).toFile(file);

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const sizes = {};

  // The poster: the window at the opening, 2x.
  {
    const { ctx, page, report } = await open(browser, "&pose=board", 2);
    await page.addStyleTag({ content: HIDE });
    await sleep(600);
    const box = await page.evaluate(() => { const r = document.querySelector('[data-window="top"]').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
    const buf = await page.screenshot({ clip: box });
    await webp(buf, path.join(OUT, "poster.webp"), Math.round(box.width * 2), 74);
    sizes.poster = fs.statSync(path.join(OUT, "poster.webp")).size;
    console.log("poster", box, report.api.length, report.paid.length);
    await ctx.close();
  }

  // The stills, in page order, then the close's window.
  {
    const { ctx, page, report } = await open(browser, "", 1);
    await page.addStyleTag({ content: HIDE });
    for (const [name, S] of STILLS) {
      await goTo(page, S);
      await sleep(S >= 2.6 && S < 3 ? 3000 : 2200);
      const buf = await page.screenshot();
      await webp(buf, path.join(OUT, `${name}.webp`), 1280, 72);
      await webp(buf, path.join(OUT, `${name}-640.webp`), 640, 70);
      sizes[name] = [fs.statSync(path.join(OUT, `${name}.webp`)).size, fs.statSync(path.join(OUT, `${name}-640.webp`)).size];
      console.log(name, S, sizes[name]);
    }
    await goTo(page, 6.85);
    await sleep(3500);
    const box = await page.evaluate(() => { const r = document.querySelector('[data-window="start"]').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
    const buf = await page.screenshot({ clip: box });
    await webp(buf, path.join(OUT, "close.webp"), Math.round(box.width), 74);
    sizes.close = fs.statSync(path.join(OUT, "close.webp")).size;
    console.log("close", box, "api", report.api.length, "paid", report.paid.length);
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(__dirname, "..", "stills-sizes.json"), JSON.stringify(sizes, null, 1));
  const total = Object.values(sizes).flat().reduce((a, b) => a + b, 0);
  console.log("total KB", Math.round(total / 1024));
  void execSync;
})();
