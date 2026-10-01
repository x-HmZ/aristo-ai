// A spot's gestures over its whole clock (V8.3b, session 2): from the moment Jake is live at the spot, every sample
// records the section clock, his bones in world space and on the page (`?probe`), the page's marked elements
// (`[data-track]`: what a gesture holds or lands on), and a screenshot of the spot. For placing a section's objects
// from his bones, and for its peak frames.
// Usage: node track.cjs <spot> <outdir> [base] [theme] [width] [seconds] [everyMs]
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , spot = "moves", out = "build/track", base = "http://localhost:3000", theme = "light", width = "1280", secs = "21", every = "100"] = process.argv;
const OUT = path.join(__dirname, "..", out, `${spot}-${theme}-${width}`);
fs.mkdirSync(OUT, { recursive: true });
const W = Number(width);

const READ = () => {
  const L = window.__landing;
  const box = document.querySelector(`[data-spot="${L.spot}"]`).getBoundingClientRect();
  const bones = L.bones();
  const page = Object.fromEntries(Object.entries(bones).map(([k, v]) => [k, L.toPage(v)]));
  const marks = {};
  document.querySelectorAll("[data-track]").forEach((el) => {
    const r = el.getBoundingClientRect();
    const o = +getComputedStyle(el).opacity;
    if (r.width && o > 0.05) marks[el.dataset.track] = { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, o };
  });
  return { t: L.clock(), frame: L.frame, bones, page, marks, box: { x: box.left + scrollX, y: box.top + scrollY, w: box.width, h: box.height } };
};

(async () => {
  const b = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [], samples: [] };
  const ctx = await themedContext(b, theme, { width: W, height: 900 });
  const p = await ctx.newPage();
  await guardApi(p, report);
  await p.goto(base + "/?probe", { waitUntil: "load" });
  await p.waitForFunction(() => document.querySelector("[data-spot=hero][data-live]"), null, { timeout: 120000 });
  const y = await p.evaluate((s) => { const r = document.querySelector(`[data-spot="${s}"]`).getBoundingClientRect(); return Math.max(0, r.top + scrollY - (innerHeight - r.height) / 2); }, spot);
  for (let v = 0; v <= y; v += 160) { await p.evaluate((q) => scrollTo(0, q), Math.min(v, y)); await sleep(30); }
  await p.evaluate((q) => scrollTo(0, q), y);
  await p.waitForFunction((s) => document.querySelector(`[data-spot="${s}"][data-live]`) && window.__landing?.spot === s, spot, { timeout: 60000 });
  const t0 = Date.now();
  let i = 0;
  while (Date.now() - t0 < Number(secs) * 1000) {
    const facts = await p.evaluate(READ);
    const scroll = await p.evaluate(() => scrollY);
    const r = facts.box;
    const clip = { x: Math.round(Math.max(0, r.x - 40)), y: Math.round(Math.max(0, r.y - scroll - 40)), width: Math.floor(Math.min(W - Math.max(0, r.x - 40), r.w + 80)), height: Math.floor(r.h + 80) };
    const file = `f${String(i).padStart(3, "0")}.png`;
    if (!process.env.NOSHOT) await p.screenshot({ path: path.join(OUT, file), clip });
    report.samples.push({ i, ms: Date.now() - t0, file, clip: { ...clip, y: clip.y + scroll }, ...facts });
    i++;
    await sleep(Math.max(0, Number(every) - 60));
  }
  fs.writeFileSync(path.join(OUT, "track.json"), JSON.stringify(report));
  console.log(JSON.stringify({ samples: report.samples.length, api: report.api.length, paid: report.paid.length, out: OUT }));
  await b.close();
})();
