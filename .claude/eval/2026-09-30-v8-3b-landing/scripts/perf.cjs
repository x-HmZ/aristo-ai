// Load and frame times on a production build (V8.3b). For each width and theme: LCP (element and time), CLS, the
// time until Jake is live; then frame times (rAF deltas, p50 / p95 / worst, dropped = over 25 ms) in three phases:
//   - idle at the hero while he waves and speaks (4 s);
//   - sitting at the model section while the build plays (7 s);
//   - a steady wheel-like scroll through the whole page (100 px every 16 ms).
// `THROTTLE=4` applies a 4x CPU throttle (the lite path's check). Usage: node perf.cjs <outdir> [base] [widths] [themes]
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , out = "build/perf", base = "http://localhost:3100", widths = "360,768,1024,1280,1440", themes = "light,dark"] = process.argv;
const OUT = path.join(__dirname, "..", out);
fs.mkdirSync(OUT, { recursive: true });

const INIT = () => {
  window.__perf = { lcp: null, cls: 0, frames: [] };
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__perf.lcp = { t: Math.round(e.startTime), el: e.element ? `${e.element.tagName}${e.element.id ? "#" + e.element.id : ""}.${String(e.element.className).slice(0, 40)}` : null, size: e.size }; }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value; }).observe({ type: "layout-shift", buffered: true });
};
const RECORD = (ms) => new Promise((resolve) => {
  const d = []; let last = performance.now(); const end = last + ms;
  const f = (now) => { d.push(now - last); last = now; if (now < end) requestAnimationFrame(f); else resolve(d); };
  requestAnimationFrame(f);
});
const stats = (d) => {
  const s = [...d].sort((a, b) => a - b);
  const q = (k) => +s[Math.min(s.length - 1, Math.floor(s.length * k))].toFixed(1);
  return { n: d.length, p50: q(0.5), p95: q(0.95), worst: +s[s.length - 1].toFixed(0), dropped: +((d.filter((x) => x > 25).length / d.length) * 100).toFixed(1) };
};

(async () => {
  const b = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [], runs: [] };
  for (const theme of themes.split(",")) for (const w of widths.split(",").map(Number)) {
    const ctx = await themedContext(b, theme, { width: w, height: 800 });
    const p = await ctx.newPage();
    await guardApi(p, report);
    await p.addInitScript(INIT);
    if (process.env.THROTTLE) { const c = await ctx.newCDPSession(p); await c.send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.THROTTLE) }); }
    const t0 = Date.now();
    await p.goto(base + "/", { waitUntil: "load" });
    const mode = await p.evaluate(() => new Promise((r) => setTimeout(() => r(document.querySelector(".landing").dataset.mode), 300)));
    let liveMs = null;
    if (mode === "full") { await p.waitForFunction(() => document.querySelector("[data-spot=hero][data-live]"), null, { timeout: 90000 }); liveMs = Date.now() - t0; }
    const hero = stats(await p.evaluate(RECORD, 4000));
    // LCP and CLS before any scroll: a reader's scroll ends LCP, the harness's scrollTo does not.
    const vitals = await p.evaluate(() => ({ lcp: window.__perf.lcp, cls: +window.__perf.cls.toFixed(4) }));
    // The model section, centred, while its build plays.
    const y = await p.evaluate(() => { const r = document.querySelector("[data-spot=model]").getBoundingClientRect(); return r.top + scrollY - (innerHeight - r.height) / 2; });
    for (let v = 0; v <= y; v += 160) { await p.evaluate((q) => scrollTo(0, q), Math.min(v, y)); await sleep(20); }
    if (mode === "full") await p.waitForFunction(() => document.querySelector("[data-spot=model][data-live]"), null, { timeout: 30000 }).catch(() => {});
    const model = stats(await p.evaluate(RECORD, 7000));
    // A steady scroll from the top to the bottom.
    await p.evaluate(() => scrollTo(0, 0)); await sleep(1500);
    const scroll = stats(await p.evaluate(() => new Promise((resolve) => {
      const d = []; let last = performance.now();
      const f = (now) => { d.push(now - last); last = now; if (scrollY + innerHeight < document.documentElement.scrollHeight - 2) requestAnimationFrame(f); else resolve(d); };
      const id = setInterval(() => { scrollBy(0, 100); if (scrollY + innerHeight >= document.documentElement.scrollHeight - 2) clearInterval(id); }, 16);
      requestAnimationFrame(f);
    })));
    const clsAfter = await p.evaluate(() => +window.__perf.cls.toFixed(4));
    const js = await p.evaluate(() => Math.round(performance.getEntriesByType("resource").filter((r) => r.initiatorType === "script").reduce((a, r) => a + r.transferSize, 0) / 1024));
    const row = { theme, w, mode, liveMs, ...vitals, clsAfterScroll: clsAfter, jsKB: js, hero, model, scroll };
    report.runs.push(row);
    console.log(JSON.stringify(row));
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, `report${process.env.THROTTLE ? "-throttle" + process.env.THROTTLE : ""}.json`), JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ api: report.api.length, paid: report.paid.length }));
  await b.close();
})();
