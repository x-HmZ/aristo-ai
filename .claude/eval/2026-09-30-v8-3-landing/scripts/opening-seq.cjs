// The opening in time: frames of the window every 400ms from the moment the stage goes live (the turn, the wave).
// Usage: node opening-seq.cjs <outdir> [base] [WxH]
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , out = "opening-seq", base = "http://localhost:3000", size = "1280x800"] = process.argv;
const [w, h] = size.split("x").map(Number);
const OUT = path.join(__dirname, "..", out);
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [] };
  const ctx = await themedContext(b, "light", { width: w, height: h });
  const p = await ctx.newPage();
  await guardApi(p, report);
  await p.goto(base + "/", { waitUntil: "load" });
  await p.waitForFunction(() => document.documentElement.dataset.stage === "live", null, { timeout: 90000 });
  const box = await p.evaluate(() => { const r = document.querySelector('[data-window="top"]').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
  for (let i = 0; i < 16; i++) {
    await p.screenshot({ path: path.join(OUT, `t${String(i * 400).padStart(4, "0")}.png`), clip: box });
    await sleep(400);
  }
  console.log(JSON.stringify({ api: report.api.length, paid: report.paid.length }));
  await b.close();
})();
