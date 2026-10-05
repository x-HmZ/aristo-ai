// The opening on a production build, unseeked (2026-10-05): a frame mid-play and frames as the lights come on, so
// Skip can be seen on ink and gone from the lit page. Usage: node shots.cjs [base] [widths] [themes]
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , base = "http://localhost:3000", widths = "360,1280", themes = "light,dark"] = process.argv;
const OUT = path.join(__dirname, "..", "shots");
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [] };
  for (const theme of themes.split(",")) for (const w of widths.split(",").map(Number)) {
    const ctx = await themedContext(b, theme, { width: w, height: 800 });
    const p = await ctx.newPage();
    await guardApi(p, report);
    await p.goto(base + "/", { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => document.documentElement.dataset.intro === "playing", null, { timeout: 20000 });
    await sleep(1800);
    await p.screenshot({ path: path.join(OUT, `${theme}-${w}-1-playing.png`) });
    await p.waitForFunction(() => document.documentElement.dataset.intro === "lifting", null, { timeout: 20000, polling: "raf" });
    await p.screenshot({ path: path.join(OUT, `${theme}-${w}-2-lifting.png`) });
    await sleep(250);
    await p.screenshot({ path: path.join(OUT, `${theme}-${w}-3-lifting-250ms.png`) });
    await ctx.close();
  }
  console.log(JSON.stringify({ api: report.api.length, paid: report.paid.length, out: OUT }));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
