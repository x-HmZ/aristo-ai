// A section over time (V8.3b): scroll its spot to the middle of the viewport, wait until Jake is live there, then a
// viewport screenshot every `every` ms for `secs` seconds, and a contact sheet of them.
// Usage: node section.cjs <spot> <outdir> [base] [theme] [width] [secs] [every]
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const sharp = require(path.join(__dirname, "..", "..", "..", "..", "node_modules", "sharp"));
const [, , spot = "idea", out = "build/section", base = "http://localhost:3000", theme = "light", width = "1280", secs = "8", every = "500"] = process.argv;
const W = Number(width);
const OUT = path.join(__dirname, "..", out, `${spot}-${theme}-${W}`);
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const b = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [] };
  const ctx = await themedContext(b, theme, { width: W, height: 800 });
  const p = await ctx.newPage();
  await guardApi(p, report);
  await p.goto(base + "/", { waitUntil: "load" });
  const mode = await p.evaluate(() => new Promise((r) => setTimeout(() => r(document.querySelector(".landing").dataset.mode), 300)));
  if (mode === "full") await p.waitForFunction(() => document.querySelector("[data-spot=hero][data-live]"), null, { timeout: 90000 });
  const y = await p.evaluate((s) => { const r = document.querySelector(`[data-spot="${s}"]`).getBoundingClientRect(); return Math.max(0, r.top + scrollY - (innerHeight - r.height) / 2); }, spot);
  for (let v = 0; v <= y; v += 160) { await p.evaluate((q) => scrollTo(0, q), Math.min(v, y)); await sleep(30); }
  await p.evaluate((q) => scrollTo(0, q), y);
  if (mode === "full") await p.waitForFunction((s) => document.querySelector(`[data-spot="${s}"][data-live]`), spot, { timeout: 30000 });
  const files = [];
  const t0 = Date.now();
  while (Date.now() - t0 < Number(secs) * 1000) {
    const f = path.join(OUT, `t${String(files.length).padStart(2, "0")}.png`);
    await p.screenshot({ path: f });
    files.push(f);
    await sleep(Math.max(0, Number(every) - 120));
  }
  const tw = 400, th = 250, cols = 4;
  const tiles = await Promise.all(files.map((f) => sharp(f).resize({ width: tw, height: th, fit: "cover", position: "top" }).toBuffer()));
  await sharp({ create: { width: tw * cols, height: th * Math.ceil(tiles.length / cols), channels: 3, background: "#222" } })
    .composite(tiles.map((t, k) => ({ input: t, left: (k % cols) * tw, top: Math.floor(k / cols) * th }))).png().toFile(path.join(OUT, "sheet.png"));
  console.log(spot, mode, files.length, "frames", JSON.stringify({ api: report.api.length, paid: report.paid.length }));
  await b.close();
})();
