// The reduced-motion stack (or no JS): one full-page screenshot, scaled down. Usage: node stack.cjs <out.png> [base] [WxH] [theme] [js=1]
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , out, base = "http://localhost:3000", size = "1280x800", theme = "light", js = "1"] = process.argv;
const [w, h] = size.split("x").map(Number);
(async () => {
  const b = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [] };
  const ctx = await themedContext(b, theme, { width: w, height: h }, { reducedMotion: js === "1" ? "reduce" : "no-preference", javaScriptEnabled: js === "1" });
  const p = await ctx.newPage();
  await guardApi(p, report);
  await p.goto(base + "/", { waitUntil: "load" });
  for (let y = 0; y < 40000; y += 700) { await p.evaluate((v) => scrollTo(0, v), y); await sleep(60); }
  await p.evaluate(() => scrollTo(0, 0));
  await sleep(1500);
  const info = await p.evaluate(() => ({ height: document.documentElement.scrollHeight, stage: document.documentElement.dataset.stage || null, overflow: document.documentElement.scrollWidth - innerWidth }));
  await p.screenshot({ path: path.join(__dirname, "..", out), fullPage: true, scale: "css" });
  console.log(JSON.stringify({ ...info, api: report.api.length, paid: report.paid.length }));
  await b.close();
})();
