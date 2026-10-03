// Long frames, attributed (V8.3b, session 3): the Long Animation Frames API on a production build. Records every
// frame over 50 ms with its scripts (source, function, invoker, durations), its render and style/layout time, and
// what the page was doing (the active and live spot from the spots' data-live, the scroll position).
// Phases: the start-up at the hero (load until 6 s after Jake is live), then a steady wheel-like scroll through the
// whole page (100 px every 16 ms), as perf.cjs does.
// Usage: node longframes.cjs <outdir> [base] [width] [theme] [runs]
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , out = "build/longframes", base = "http://localhost:3100", width = "1440", theme = "light", runs = "3"] = process.argv;
const OUT = path.join(__dirname, "..", out);
fs.mkdirSync(OUT, { recursive: true });

const INIT = () => {
  window.__lf = { frames: [], phase: "load", marks: [] };
  const live = () => document.querySelector("[data-spot][data-live]")?.getAttribute("data-spot") ?? null;
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      if (e.duration < 50) continue;
      window.__lf.frames.push({
        t: Math.round(e.startTime), dur: Math.round(e.duration), block: Math.round(e.blockingDuration ?? 0),
        render: Math.round(e.renderStart ? e.startTime + e.duration - e.renderStart : 0),
        style: Math.round(e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0),
        phase: window.__lf.phase, live: live(), y: Math.round(scrollY),
        scripts: (e.scripts || []).map((s) => ({ dur: Math.round(s.duration), fwd: Math.round(s.forcedStyleAndLayoutDuration || 0), inv: s.invoker, type: s.invokerType, src: (s.sourceURL || "").replace(/^.*\/_next\//, ""), fn: s.sourceFunctionName, at: s.sourceCharPosition })),
      });
    }
  }).observe({ type: "long-animation-frame", buffered: true });
  // When each spot goes live (the stage mounting Jake there), on the same clock.
  new MutationObserver((ms) => { for (const m of ms) if (m.attributeName === "data-live" && m.target.hasAttribute("data-live")) window.__lf.marks.push({ t: Math.round(performance.now()), live: m.target.getAttribute("data-spot"), y: Math.round(scrollY) }); })
    .observe(document, { attributes: true, subtree: true, attributeFilter: ["data-live"] });
};

(async () => {
  const b = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [], runs: [] };
  for (let r = 0; r < Number(runs); r++) {
    const ctx = await themedContext(b, theme, { width: Number(width), height: 800 });
    const p = await ctx.newPage();
    await guardApi(p, report);
    await p.addInitScript(INIT);
    await p.goto(base + "/", { waitUntil: "load" });
    await p.waitForFunction(() => document.querySelector("[data-spot=hero][data-live]"), null, { timeout: 90000 });
    await sleep(6000);
    await p.evaluate(() => { window.__lf.phase = "settle"; scrollTo(0, 0); });
    await sleep(1500);
    await p.evaluate(() => new Promise((resolve) => {
      window.__lf.phase = "scroll";
      const id = setInterval(() => { scrollBy(0, 100); if (scrollY + innerHeight >= document.documentElement.scrollHeight - 2) { clearInterval(id); resolve(); } }, 16);
    }));
    await sleep(500);
    const lf = await p.evaluate(() => window.__lf);
    report.runs.push(lf);
    console.log(`run ${r}: ${lf.frames.length} long frames:`, lf.frames.map((f) => `${f.phase}@${f.t}ms ${f.dur}ms (render ${f.render}, style ${f.style}) live=${f.live} y=${f.y} | ` + f.scripts.map((s) => `${s.dur}ms ${s.type}:${s.inv} ${s.fn || ""} ${s.src}:${s.at}`).join(" ; ")).join("\n  "));
    console.log("  live marks:", lf.marks.map((m) => `${m.live}@${m.t}`).join(" "));
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, `longframes-${theme}-${width}.json`), JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ api: report.api.length, paid: report.paid.length }));
  await b.close();
})();
