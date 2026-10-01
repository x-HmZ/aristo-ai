// AA, 44px targets and horizontal overflow on the built sections, with a screenshot at each stop (V8.3b). For each
// width and theme: load /, then stop at each section with its spot (or its middle) centred, wait for its graphic to
// settle, and check every visible text node against its composited background (over the canvas, white and black
// are both tried and the lower ratio counts; ../../2026-09-29-v8-4c/scripts/check.cjs). Hidden disabled controls
// are exempt. Usage: node check.cjs <outdir> [base] [widths] [themes]
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const { AA, TARGETS } = require("../../2026-09-29-v8-4c/scripts/check.cjs");
const [, , out = "build/check", base = "http://localhost:3000", widths = "360,768,1024,1280,1440", themes = "light,dark"] = process.argv;
const OUT = path.join(__dirname, "..", out);
fs.mkdirSync(OUT, { recursive: true });
// Each stop: the section, what to centre, how long its graphic takes to settle once centred.
const STOPS = [["top", "[data-spot=hero]", 1500], ["idea", "#idea", 8000], ["how", "#how", 7000], ["picture", "[data-spot=picture]", 7000], ["model", "[data-spot=model]", 7500], ["moves", "#moves", 14500], ["parents", "#parents", 900], ["start", "[data-spot=close]", 2500], ["footer", "footer", 300]];

(async () => {
  const b = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [], runs: [] };
  for (const theme of themes.split(",")) for (const w of widths.split(",").map(Number)) {
    const ctx = await themedContext(b, theme, { width: w, height: 800 });
    const p = await ctx.newPage();
    await guardApi(p, report);
    await p.goto(base + "/", { waitUntil: "load" });
    const mode = await p.evaluate(() => new Promise((r) => setTimeout(() => r(document.querySelector(".landing").dataset.mode), 300)));
    if (mode === "full") await p.waitForFunction(() => document.querySelector("[data-spot=hero][data-live]"), null, { timeout: 90000 });
    const row = { theme, w, mode, stops: [] };
    for (const [name, sel, settle] of STOPS) {
      const y = await p.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return Math.max(0, Math.min(document.documentElement.scrollHeight - innerHeight, r.top + scrollY - Math.max(0, (innerHeight - r.height) / 2))); }, sel);
      const from = await p.evaluate(() => scrollY);
      const steps = Math.max(1, Math.ceil(Math.abs(y - from) / 160));
      for (let i = 1; i <= steps; i++) { await p.evaluate((v) => scrollTo(0, v), Math.round(from + ((y - from) * i) / steps)); await sleep(25); }
      await sleep(settle);
      const aa = await p.evaluate(AA, "");
      const t = await p.evaluate(TARGETS, "");
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      const fails = aa.filter((x) => x.ratio < x.need);
      const min = aa.length ? Math.min(...aa.map((x) => x.ratio)) : null;
      if ([360, 768, 1280].includes(w)) await p.screenshot({ path: path.join(OUT, `${theme}-${w}-${name}.png`) });
      row.stops.push({ name, nodes: aa.length, min, fails, small: t.s, overflow });
    }
    report.runs.push(row);
    const all = row.stops;
    console.log(theme, w, mode, "nodes", all.reduce((a, s) => a + s.nodes, 0), "fails", all.reduce((a, s) => a + s.fails.length, 0),
      "min", Math.min(...all.filter((s) => s.min !== null).map((s) => s.min)).toFixed(2), "small", all.reduce((a, s) => a + s.small.length, 0), "overflow", Math.max(...all.map((s) => s.overflow)));
    for (const s of all) if (s.fails.length || s.small.length || s.overflow > 0) console.log("  ", s.name, JSON.stringify(s.fails.slice(0, 3)), s.small.join("; "), "overflow", s.overflow);
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ api: report.api.length, paid: report.paid.length }));
  await b.close();
})();
