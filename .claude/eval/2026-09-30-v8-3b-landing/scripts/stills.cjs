// The spots' stills (build steps 5 and 10): Jake in each spot's pose on a transparent ground, captured from the live
// stage itself, so a still shows exactly what the canvas would. The viewport makes the spot 600 x 600 CSS px (its
// widest box; smaller boxes cover it by height, Spot.tsx), at 2x. `?still` holds the teacher (no wave). The page
// around the canvas is hidden and the layer's own fade removed: the still carries the same fade in CSS.
// Usage: node stills.cjs <spot,...> [base] [waitMs]   -> public/images/landing/v3b/<spot>.webp (+ a PNG in build/stills)
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const sharp = require(path.join(__dirname, "..", "..", "..", "..", "node_modules", "sharp"));
const [, , spots = "hero", base = "http://localhost:3000", waitMs = "2500"] = process.argv;
const ROOT = path.join(__dirname, "..", "..", "..", "..");
const PUB = path.join(ROOT, "public", "images", "landing", "v3b");
const RAW = path.join(__dirname, "..", "build", "stills");
fs.mkdirSync(PUB, { recursive: true });
fs.mkdirSync(RAW, { recursive: true });

(async () => {
  const b = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [] };
  for (const spot of spots.split(",")) {
    const ctx = await b.newContext({ viewport: { width: 700, height: 900 }, deviceScaleFactor: 2, colorScheme: "light", reducedMotion: "no-preference" });
    const p = await ctx.newPage();
    await guardApi(p, report);
    await p.goto(base + `/?probe&full=1&still=${spot}`, { waitUntil: "load" });
    await p.waitForFunction(() => document.querySelector("[data-spot][data-live]"), null, { timeout: 90000 });
    const y = await p.evaluate((s) => { const r = document.querySelector(`[data-spot="${s}"]`).getBoundingClientRect(); return Math.max(0, r.top + scrollY - (innerHeight - r.height) / 2); }, spot);
    for (let v = 0; v <= y; v += 200) { await p.evaluate((q) => scrollTo(0, q), Math.min(v, y)); await sleep(30); }
    await p.evaluate((q) => scrollTo(0, q), y);
    await p.waitForFunction((s) => document.querySelector(`[data-spot="${s}"][data-live]`), spot, { timeout: 30000 });
    await sleep(Number(waitMs));
    await p.addStyleTag({ content: `html, body, .landing { background: transparent !important; }
      header, main, footer { visibility: hidden !important; }
      [data-stage-layer] { -webkit-mask-image: none !important; mask-image: none !important; visibility: visible !important; }` });
    await sleep(200);
    const r = await p.evaluate((s) => { const q = document.querySelector(`[data-spot="${s}"]`).getBoundingClientRect(); return { x: q.left, y: q.top, width: q.width, height: q.height }; }, spot);
    if (Math.round(r.width) !== 600 || Math.round(r.height) !== 600) throw new Error(`${spot} box is ${r.width} x ${r.height}, not 600 x 600`);
    const png = path.join(RAW, `${spot}.png`);
    await p.screenshot({ path: png, clip: r, omitBackground: true });
    const out = path.join(PUB, `${spot}.webp`);
    await sharp(png).webp({ quality: 82, alphaQuality: 90, effort: 6 }).toFile(out);
    console.log(spot, `${Math.round(fs.statSync(out).size / 1024)} kB`);
    await ctx.close();
  }
  console.log(JSON.stringify({ api: report.api.length, paid: report.paid.length }));
  await b.close();
})();
