// The stage on its spots (build step 4): live at the hero, then the canvas moving to the close and back, frames in
// each, the layer's box against the spot's, and when the teacher went live there. Usage:
// node stage.cjs <outdir> [base] [theme] [width]
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , out = "build/stage", base = "http://localhost:3000", theme = "light", width = "1280"] = process.argv;
const OUT = path.join(__dirname, "..", out);
fs.mkdirSync(OUT, { recursive: true });
const W = Number(width);

const STATE = () => {
  const layer = document.querySelector("[data-stage-layer]").getBoundingClientRect();
  const live = document.querySelector("[data-spot][data-live]");
  const spot = live?.getBoundingClientRect();
  return {
    stage: document.documentElement.dataset.stage, live: live?.dataset.spot ?? null,
    layer: [layer.left, layer.top, layer.width, layer.height].map(Math.round),
    spot: spot ? [spot.left, spot.top, spot.width, spot.height].map(Math.round) : null,
    opacity: document.querySelector("[data-stage-layer]").style.opacity,
  };
};

(async () => {
  const b = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [], steps: [] };
  const ctx = await themedContext(b, theme, { width: W, height: 800 });
  const p = await ctx.newPage();
  await guardApi(p, report);
  const t0 = Date.now();
  await p.goto(base + "/?probe", { waitUntil: "load" });
  await p.waitForFunction(() => document.querySelector("[data-spot][data-live]"), null, { timeout: 90000 });
  report.liveAfterMs = Date.now() - t0;
  const shot = async (name) => { await p.screenshot({ path: path.join(OUT, `${theme}-${W}-${name}.png`) }); report.steps.push({ name, ...(await p.evaluate(STATE)) }); };
  await sleep(300); await shot("hero-live");
  await sleep(2500); await shot("hero-3s");
  const scrollTo = async (sel) => {
    const y = await p.evaluate((s) => Math.max(0, document.querySelector(s).getBoundingClientRect().top + scrollY - 120), sel);
    const from = await p.evaluate(() => scrollY);
    const steps = Math.max(1, Math.ceil(Math.abs(y - from) / 200));
    for (let i = 1; i <= steps; i++) { await p.evaluate((v) => scrollTo(0, v), Math.round(from + ((y - from) * i) / steps)); await sleep(30); }
  };
  await scrollTo("[data-spot=close]");
  const tMove = Date.now();
  await p.waitForFunction(() => document.querySelector("[data-spot=close][data-live]"), null, { timeout: 20000 });
  report.closeLiveMs = Date.now() - tMove;
  await sleep(200); await shot("close-live");
  await sleep(2500); await shot("close-3s");
  await scrollTo("[data-spot=hero]");
  await p.waitForFunction(() => document.querySelector("[data-spot=hero][data-live]"), null, { timeout: 20000 });
  await sleep(1500); await shot("hero-back");
  fs.writeFileSync(path.join(OUT, `${theme}-${W}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ liveAfterMs: report.liveAfterMs, closeLiveMs: report.closeLiveMs, steps: report.steps }, null, 1));
  console.log(JSON.stringify({ api: report.api.length, paid: report.paid.length }));
  await b.close();
})();
