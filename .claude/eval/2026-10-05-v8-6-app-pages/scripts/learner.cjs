// V8.6: the learner surfaces inside /learn (onboarding, course map, dashboard), through the local-only
// /dev/learn-shell harness (every /api call mocked in the page; the network layer aborts the rest).
//   node learner.cjs <label> [baseUrl]      SIZES=360,768,1280  THEMES=light,dark  ONLY=onb,map,dash
// Writes <label>/<state>-<w>-<theme>.jpg and <label>/report-learner.json.
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi, sceneReady, click } = require("./common.cjs");
const { AA, TARGETS } = require("./check.cjs");

const label = process.argv[2] || "after";
const base = process.argv[3] || "http://localhost:3000";
const OUT = path.join(__dirname, "..", label);
fs.mkdirSync(OUT, { recursive: true });
const H = { 360: 780, 768: 1024, 1280: 800 };
const SIZES = (process.env.SIZES || "360,768,1280").split(",").map(Number);
const THEMES = (process.env.THEMES || "light,dark").split(",");
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;

// Each state: [name, group, query, steps(page)]. Steps only click harness-mocked controls.
const pick = async (page, re) => { if (!(await click(page, re))) throw new Error("no control " + re); await sleep(350); };
const STATES = [
  ["onb-1", "onb", "?onboarded=0", async () => {}],
  ["onb-2", "onb", "?onboarded=0", async (p) => { await pick(p, /^Learn from scratch/); await pick(p, /^Continue/); }],
  ["onb-3", "onb", "?onboarded=0", async (p) => { await pick(p, /^Learn from scratch/); await pick(p, /^Continue/); await pick(p, /^20/); await pick(p, /^Continue/); await pick(p, /Python Programming/); }],
  ["onb-err", "onb", "?onboarded=0", async (p) => { await pick(p, /^Fill in gaps/); await pick(p, /^Continue/); await pick(p, /^45/); await pick(p, /^Continue/); await pick(p, /Middle School Science/); await pick(p, /^Start learning/); await sleep(900); }],
  ["map", "map", "", async (p) => { await pick(p, /^Earth Science/); await sleep(1500); }],
  ["map-empty", "map", "?map=empty", async (p) => { await pick(p, /^Earth Science/); await sleep(1500); }],
  ["map-fail", "map", "?map=fail", async (p) => { await pick(p, /^Earth Science/); await sleep(1500); }],
  ["dash", "dash", "", async (p) => { await pick(p, /Explore [Ff]reely/); await pick(p, /Progress/); await sleep(1200); }],
  ["dash-empty", "dash", "?dash=empty", async (p) => { await pick(p, /Explore [Ff]reely/); await pick(p, /Progress/); await sleep(1200); }],
  ["dash-fail", "dash", "?dash=fail", async (p) => { await pick(p, /Explore [Ff]reely/); await pick(p, /Progress/); await sleep(1200); }],
];

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [], shots: {} };
  for (const theme of THEMES) for (const w of SIZES) {
    const ctx = await themedContext(browser, theme, { width: w, height: H[w] });
    const page = await ctx.newPage();
    await guardApi(page, report);
    for (const [name, group, q, steps] of STATES) {
      if (ONLY && !ONLY.includes(group)) continue;
      const key = `${name}-${w}-${theme}`;
      try {
        await page.goto(`${base}/dev/learn-shell${q}`, { waitUntil: "domcontentloaded" });
        await sceneReady(page).catch(() => {});
        await sleep(900);
        await steps(page);
        await sleep(500);
        await page.screenshot({ path: path.join(OUT, `${key}.jpg`), type: "jpeg", quality: 78 });
        await page.evaluate(() => { window.__occl = true; });
        const aa = await page.evaluate(AA, "");
        const tg = await page.evaluate(TARGETS, "");
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        report.shots[key] = {
          n: aa.length,
          min: aa.length ? Math.min(...aa.map((r) => r.ratio)) : null,
          fails: aa.filter((r) => r.ratio < r.need).map((r) => `${r.t} | ${r.ratio} | ${r.fg} on ${r.bg} | ${r.size}px`),
          small: tg.s,
          overflow,
        };
        const s = report.shots[key];
        console.log(`${key}: n=${s.n} min=${s.min} fails=${s.fails.length} small=${s.small.length} overflow=${overflow}`);
      } catch (e) {
        report.shots[key] = { error: String(e.message || e) };
        console.log(`${key}: ERROR ${e.message}`);
      }
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "report-learner.json"), JSON.stringify(report, null, 1));
  console.log(`api at network: ${report.api.length}, paid: ${report.paid.length}`);
})();
