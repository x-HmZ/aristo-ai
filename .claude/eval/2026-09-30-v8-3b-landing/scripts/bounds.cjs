// Does Jake stay inside his box through every gesture? (Hmz: his right side went out of bounds.) For each spot, the
// page loads with `?probe&wide=M`: the canvas layer reaches M of the box's width past each side and M of its height
// above, and the view grows to match, so the box shows exactly what it does live and anything of him that would be
// cut off is drawn as well. Through the spot's whole timeline (the hero: its arrival wave, the offer on Try a lesson,
// and a tap), the page is hidden around the canvas and the layer is screenshotted with a transparent ground; every
// frame's opaque pixels are compared with the box. Reports, per spot, the worst overflow past the left, right and top
// edges (px, 0 = never out) and the least clearance inside them, with the frame that set it.
// Usage: node bounds.cjs <outdir> [base] [width] [spots]
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const sharp = require(path.join(__dirname, "..", "..", "..", "..", "node_modules", "sharp"));
const [, , out = "build/bounds", base = "http://localhost:3000", width = "1280", spots = "hero,idea,ideas,picture,model,moves,close"] = process.argv;
const OUT = path.join(__dirname, "..", out, width);
fs.mkdirSync(OUT, { recursive: true });
const M = 0.25;
const SECS = { hero: 10, idea: 8.5, ideas: 7, picture: 7, model: 6, moves: 24.5, close: 5 };

async function opaqueBox(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  // Only above the fade (the box's lower part fades him out; a hand there is never cut by an edge that shows).
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

(async () => {
  const b = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [], width: Number(width), spots: [] };
  for (const spot of spots.split(",")) {
    const ctx = await themedContext(b, "light", { width: Number(width), height: 900 });
    const p = await ctx.newPage();
    await guardApi(p, report);
    await p.goto(base + `/?probe&wide=${M}`, { waitUntil: "load" });
    await p.waitForFunction(() => document.querySelector("[data-spot=hero][data-live]"), null, { timeout: 120000 });
    if (spot !== "hero") {
      const y = await p.evaluate((s) => { const r = document.querySelector(`[data-spot="${s}"]`).getBoundingClientRect(); return Math.max(0, r.top + scrollY - (innerHeight - r.height) / 2); }, spot);
      for (let v = 0; v <= y; v += 160) { await p.evaluate((q) => scrollTo(0, q), Math.min(v, y)); await sleep(30); }
      await p.evaluate((q) => scrollTo(0, q), y);
      await p.waitForFunction((s) => document.querySelector(`[data-spot="${s}"][data-live]`), spot, { timeout: 60000 });
    }
    // The hero's interactions are driven before the page is hidden (hidden elements take no pointer).
    const box = await p.evaluate((s) => { const r = document.querySelector(`[data-spot="${s}"]`).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, spot);
    await p.addStyleTag({ content: `html, body, .landing { background: transparent !important; }
      main, header, footer { opacity: 0 !important; }
      [data-stage-layer] { -webkit-mask-image: none !important; mask-image: none !important; opacity: 1 !important; transition: none !important; }` });
    const vw = await p.evaluate(() => innerWidth);
    const cx = Math.max(0, box.x - M * box.w), cy = Math.max(0, box.y - M * box.h);
    const clip = { x: cx, y: cy, width: Math.min(vw, box.x + box.w * (1 + M)) - cx, height: box.y + box.h - cy };
    // The box inside the clip; only the part above the fade matters (the mask fades him from 62% down).
    const inner = { x0: box.x - clip.x, x1: box.x - clip.x + box.w, y0: box.y - clip.y, fade: box.y - clip.y + 0.62 * box.h };
    // How far past each edge could be seen (the window cuts the layer for a box near its edge).
    const seen = { left: Math.round(inner.x0), right: Math.round(clip.width - inner.x1), top: Math.round(inner.y0) };
    const row = { spot, box: [Math.round(box.w), Math.round(box.h)], seen, out: { left: 0, right: 0, top: 0 }, clear: { left: Infinity, right: Infinity, top: Infinity }, frames: 0, worst: null };
    const t0 = Date.now();
    let i = 0, hovered = false, tapped = false;
    while (Date.now() - t0 < SECS[spot] * 1000) {
      const ms = Date.now() - t0;
      if (spot === "hero" && !hovered && ms > 3000) {
        hovered = true;
        await p.evaluate(() => { const b = [...document.querySelectorAll("a, button")].find((x) => /Try a lesson/.test(x.textContent) && x.closest("#top")); b?.dispatchEvent(new PointerEvent("pointerenter", { bubbles: false })); });
      }
      if (spot === "hero" && !tapped && ms > 6500) {
        tapped = true;
        await p.evaluate(() => { const b = [...document.querySelectorAll("a, button")].find((x) => /Try a lesson/.test(x.textContent) && x.closest("#top")); b?.dispatchEvent(new PointerEvent("pointerleave", { bubbles: false })); document.querySelector('[aria-label="Say hi to Jake"]')?.click(); });
      }
      const file = path.join(OUT, `${spot}-${String(i).padStart(3, "0")}.png`);
      await p.screenshot({ path: file, clip, omitBackground: true });
      // Only what is above the fade: crop to it.
      const above = path.join(OUT, `${spot}-a.png`);
      await sharp(file).extract({ left: 0, top: 0, width: (await sharp(file).metadata()).width, height: Math.floor(Math.min(clip.height, inner.fade)) }).png().toFile(above);
      const o = await opaqueBox(above);
      if (o) {
        const out = { left: Math.max(0, inner.x0 - o.x0), right: Math.max(0, o.x1 - inner.x1), top: Math.max(0, inner.y0 - o.y0) };
        const clear = { left: o.x0 - inner.x0, right: inner.x1 - o.x1, top: o.y0 - inner.y0 };
        for (const k of ["left", "right", "top"]) {
          if (out[k] > row.out[k]) { row.out[k] = out[k]; row.worst = { side: k, ms, file: path.basename(file) }; fs.copyFileSync(file, path.join(OUT, `${spot}-worst-${k}.png`)); }
          if (clear[k] < row.clear[k]) row.clear[k] = clear[k];
        }
      }
      if (!row.worst || !row.worst.file.endsWith(path.basename(file))) fs.unlinkSync(file);
      row.frames = ++i;
    }
    for (const k of ["left", "right", "top"]) row.clear[k] = Math.round(row.clear[k]);
    report.spots.push(row);
    console.log(JSON.stringify(row));
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, "bounds.json"), JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ api: report.api.length, paid: report.paid.length }));
  await b.close();
})();
