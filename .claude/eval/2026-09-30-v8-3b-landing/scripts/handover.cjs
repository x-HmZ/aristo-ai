// The poster against the first live frame, per spot (Hmz: a section's poster must be its first frame, or going live
// jumps). For each spot: scroll it to the middle, the moment it goes live screenshot its box (the canvas, Jake at
// rest), then put the poster back over it (the canvas layer hidden, the spot's live-path poster shown) and screenshot
// the same box. Writes the pair and their difference side by side, and per spot: the mean difference, and Jake's
// silhouette box in each (pixels far from the box's own background), so a shift or a scale change is a number.
// Usage: node handover.cjs <outdir> [base] [theme] [width] [spots]
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const sharp = require(path.join(__dirname, "..", "..", "..", "..", "node_modules", "sharp"));
const [, , out = "build/handover", base = "http://localhost:3000", theme = "light", width = "1280", spots = "hero,idea,ideas,picture,model,moves,close"] = process.argv;
const OUT = path.join(__dirname, "..", out, `${theme}-${width}`);
fs.mkdirSync(OUT, { recursive: true });

async function silhouette(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  // The background: the box's top corners (page colour, outside the pool).
  const px = (x, y) => { const i = (y * w + x) * 3; return [data[i], data[i + 1], data[i + 2]]; };
  const bg = px(4, 4);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < Math.floor(h * 0.6); y++) for (let x = 0; x < w; x++) {
    const p = px(x, y);
    if (Math.abs(p[0] - bg[0]) + Math.abs(p[1] - bg[1]) + Math.abs(p[2] - bg[2]) > 90) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

(async () => {
  const b = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [], spots: [] };
  for (const spot of spots.split(",")) {
    const ctx = await themedContext(b, theme, { width: Number(width), height: 900 });
    const p = await ctx.newPage();
    await guardApi(p, report);
    await p.goto(base + "/", { waitUntil: "load" });
    await p.waitForFunction(() => document.querySelector("[data-spot=hero][data-live]"), null, { timeout: 120000 });
    if (spot !== "hero") {
      const y = await p.evaluate((s) => { const r = document.querySelector(`[data-spot="${s}"]`).getBoundingClientRect(); return Math.max(0, r.top + scrollY - (innerHeight - r.height) / 2); }, spot);
      for (let v = 0; v <= y; v += 160) { await p.evaluate((q) => scrollTo(0, q), Math.min(v, y)); await sleep(30); }
      await p.evaluate((q) => scrollTo(0, q), y);
      await p.waitForFunction((s) => document.querySelector(`[data-spot="${s}"][data-live]`), spot, { timeout: 60000 });
    }
    // Let the layer's 200 ms fade finish (nothing moves before the section's first cue).
    await sleep(260);
    const clip = await p.evaluate((s) => { const r = document.querySelector(`[data-spot="${s}"]`).getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; }, spot);
    const live = path.join(OUT, `${spot}-live.png`), poster = path.join(OUT, `${spot}-poster.png`);
    await p.screenshot({ path: live, clip });
    // The poster back: the canvas hidden, and the still the live path shows before Jake is live.
    await p.addStyleTag({ content: `[data-stage-layer] { visibility: hidden !important; } [data-spot="${spot}"] .landing-spot-still { opacity: 1 !important; transition: none !important; }` });
    await p.evaluate((s) => document.querySelector(`[data-spot="${s}"]`).removeAttribute("data-live"), spot);
    await sleep(300);
    await p.screenshot({ path: poster, clip });
    const a = await sharp(live).removeAlpha().raw().toBuffer(), c = await sharp(poster).removeAlpha().raw().toBuffer();
    let sum = 0;
    const diff = Buffer.alloc(a.length);
    for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - c[i]); sum += d; diff[i] = Math.min(255, d * 4); }
    const meta = await sharp(live).metadata();
    const dfile = path.join(OUT, `${spot}-diff.png`);
    await sharp(diff, { raw: { width: meta.width, height: meta.height, channels: 3 } }).png().toFile(dfile);
    const sl = await silhouette(live), sp = await silhouette(poster);
    const row = { spot, box: [Math.round(clip.width), Math.round(clip.height)], meanDiff: +(sum / a.length).toFixed(2), live: sl, poster: sp,
      shift: sl && sp ? { x0: sp.x0 - sl.x0, y0: sp.y0 - sl.y0, w: sp.w - sl.w, h: sp.h - sl.h } : null };
    report.spots.push(row);
    console.log(JSON.stringify(row));
    const tw = 300;
    const tiles = await Promise.all([poster, live, dfile].map((f) => sharp(f).resize({ width: tw }).toBuffer()));
    const th = (await sharp(tiles[0]).metadata()).height;
    await sharp({ create: { width: tw * 3, height: th, channels: 3, background: "#888" } }).composite(tiles.map((t, k) => ({ input: t, left: k * tw, top: 0 }))).png().toFile(path.join(OUT, `${spot}-pair.png`));
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, "handover.json"), JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ api: report.api.length, paid: report.paid.length }));
  await b.close();
})();
