// The spots' stills (build steps 5 and 10): Jake in each spot's pose on a transparent ground, captured from the live
// stage itself, so a still shows exactly what the canvas would. Each spot is forced to 600 CSS px wide at its aspect
// (1, or the fixed aspect of the volcano and model spots; narrower boxes cover a still by height, Spot.tsx), at 2x. `?still` holds the teacher (no wave). The page
// around the canvas is hidden and the layer's own fade removed: the still carries the same fade in CSS.
// Usage: node stills.cjs <spot,...> [base] [waitMs] [end|start|first]   -> public/images/landing/v3b/<spot>.webp (+ a PNG
// in build/stills). 'start' and 'first' are the section's first frame, taken the moment Jake is live (the canvas shown
// at once, no fade), so the poster is exactly what the canvas then starts from: 'start' to <spot>-start.webp (the
// live path's poster where the lite still is the end), 'first' to <spot>.webp (spots that end at rest: one still).
// Capture aspects mirror spots.ts CAPTURE_ASPECT.
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const sharp = require(path.join(__dirname, "..", "..", "..", "..", "node_modules", "sharp"));
const [, , spots = "hero", base = "http://localhost:3000", waitMs = "2500", which = "end"] = process.argv;
const START = which === "start" || which === "first";
const ROOT = path.join(__dirname, "..", "..", "..", "..");
const PUB = path.join(ROOT, "public", "images", "landing", "v3b");
const RAW = path.join(__dirname, "..", "build", "stills");
fs.mkdirSync(PUB, { recursive: true });
fs.mkdirSync(RAW, { recursive: true });

(async () => {
  const b = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [] };
  for (const spot of spots.split(",")) {
    const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2, colorScheme: "light", reducedMotion: "no-preference" });
    const p = await ctx.newPage();
    await guardApi(p, report);
    // Each spot at its capture size: 600 px wide at its own aspect (the volcano and model spots have fixed ones), so a
    // still covers every box the spot gets.
    const aspect = { model: 1.1, ideas: 1.3, picture: 1.3 }[spot] ?? 1;
    await ctx.addInitScript(([s, h]) => { const st = document.createElement("style"); st.textContent = `[data-spot="${s}"] { width: 600px !important; height: ${h}px !important; max-width: none !important; aspect-ratio: auto !important; }`; document.addEventListener("DOMContentLoaded", () => document.head.appendChild(st)); }, [spot, Math.round(600 / aspect)]);
    // The canvas layer shows at once (no fade), so the frame taken is the first one he is live in.
    if (START) await ctx.addInitScript(() => { const st = document.createElement("style"); st.textContent = "[data-stage-layer] { transition: none !important; }"; document.addEventListener("DOMContentLoaded", () => document.head.appendChild(st)); });
    await p.goto(base + `/?probe&full=1&still=${spot}${START ? "&start" : ""}`, { waitUntil: "load" });
    await p.waitForFunction(() => document.querySelector("[data-spot][data-live]"), null, { timeout: 90000 });
    const y = await p.evaluate((s) => { const r = document.querySelector(`[data-spot="${s}"]`).getBoundingClientRect(); return Math.max(0, r.top + scrollY - (innerHeight - r.height) / 2); }, spot);
    for (let v = 0; v <= y; v += 200) { await p.evaluate((q) => scrollTo(0, q), Math.min(v, y)); await sleep(30); }
    await p.evaluate((q) => scrollTo(0, q), y);
    await p.waitForFunction((s) => document.querySelector(`[data-spot="${s}"][data-live]`), spot, { timeout: 30000 });
    await sleep(START ? 0 : Number(waitMs));
    await p.addStyleTag({ content: `html, body, .landing { background: transparent !important; }
      header, main, footer { visibility: hidden !important; }
      [data-stage-layer] { -webkit-mask-image: none !important; mask-image: none !important; visibility: visible !important; }` });
    await sleep(START ? 30 : 200);
    const r = await p.evaluate((s) => { const q = document.querySelector(`[data-spot="${s}"]`).getBoundingClientRect(); return { x: q.left, y: q.top, width: q.width, height: q.height }; }, spot);
    if (Math.round(r.width) !== 600) throw new Error(`${spot} box is ${r.width} wide, not 600`);
    if (Math.abs(r.width / r.height - aspect) > 0.01) throw new Error(`${spot} box is ${r.width} x ${r.height}, not at aspect ${aspect}`);
    const name = which === "start" ? `${spot}-start` : spot;
    const png = path.join(RAW, `${name}.png`);
    await p.screenshot({ path: png, clip: r, omitBackground: true });
    const out = path.join(PUB, `${name}.webp`);
    // The whole box, never clipped by the viewport (a box past its edge once gave idea.webp the wrong width).
    const m = await sharp(png).metadata();
    if (m.width !== 1200 || Math.abs(m.height - Math.round(1200 / aspect)) > 2) throw new Error(`${name}: captured ${m.width} x ${m.height}, not 1200 x ${Math.round(1200 / aspect)}`);
    await sharp(png).webp({ quality: 82, alphaQuality: 90, effort: 6 }).toFile(out);
    console.log(name, `${Math.round(fs.statSync(out).size / 1024)} kB`);
    await ctx.close();
  }
  console.log(JSON.stringify({ api: report.api.length, paid: report.paid.length }));
  await b.close();
})();
