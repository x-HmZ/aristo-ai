// Look at the landing at chosen scene times. Usage: node probe.cjs <outdir> <base> <WxH> <theme> <S,S,...>
// Scene time S (timeline.ts) is turned into a scroll position from the sections' measured offsets.
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , out = "probe", base = "http://localhost:3000", size = "1280x800", theme = "light", times = "0,0.5,1.5,2.1,2.4,2.6,2.8,2.95,3.3,3.5,3.74,3.9,4.6,5.5,6.1,6.8"] = process.argv;
const [w, h] = size.split("x").map(Number);
const OUT = path.join(__dirname, "..", out);
fs.mkdirSync(OUT, { recursive: true });

// Scroll position for scene time S: section i covers [i, i+1); pinned sections progress over height - vh.
const yFor = (S) => {
  const ids = ["top", "idea", "how", "moves", "map", "parents", "start"];
  const i = Math.min(ids.length - 1, Math.floor(S));
  const el = document.getElementById(ids[i]);
  const top = el.getBoundingClientRect().top + scrollY;
  const pinned = ids[i] !== "parents";
  const travel = Math.max(1, pinned ? el.offsetHeight - innerHeight : el.offsetHeight);
  return Math.round(top + (S - i) * travel);
};

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [], errors: [] };
  const ctx = await themedContext(browser, theme, { width: w, height: h }, process.env.REDUCED ? { reducedMotion: "reduce" } : {});
  const page = await ctx.newPage();
  await guardApi(page, report);
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") report.errors.push(m.text().slice(0, 300)); });
  page.on("pageerror", (e) => report.errors.push("PAGEERROR " + e.message.slice(0, 300)));
  await page.goto(base + "/" + (process.env.Q || ""), { waitUntil: "load" });
  const t0 = Date.now();
  await page.waitForFunction(() => document.documentElement.dataset.stage && document.documentElement.dataset.stage !== "loading", null, { timeout: 90000 }).catch(() => {});
  const stage = await page.evaluate(() => document.documentElement.dataset.stage);
  console.log("stage", stage, "after", Date.now() - t0, "ms");
  await sleep(2500);
  for (const S of times.split(",").map(Number)) {
    const y = await page.evaluate(yFor, S);
    const from = await page.evaluate(() => scrollY);
    const steps = Math.max(1, Math.ceil(Math.abs(y - from) / 300));
    for (let i = 1; i <= steps; i++) { await page.evaluate((v) => scrollTo(0, v), Math.round(from + ((y - from) * i) / steps)); await sleep(30); }
    await sleep(S >= 2.6 && S < 3 ? 2600 : 1600);
    await page.screenshot({ path: path.join(OUT, `${theme}-${w}-S${S.toFixed(2)}.png`) });
  }
  console.log(JSON.stringify({ api: report.api.length, paid: report.paid.length }));
  console.log(report.errors.slice(0, 20).join("\n"));
  await browser.close();
})();
