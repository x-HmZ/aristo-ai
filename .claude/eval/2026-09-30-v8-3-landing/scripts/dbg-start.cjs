// Long animation frames from navigation until 4s after the stage goes live (no scrolling): the stage's start-up cost.
const { chromium, sleep, LAUNCH, themedContext } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , base, size = "1280x800"] = process.argv;
const [w, h] = size.split("x").map(Number);
(async () => {
  const b = await chromium.launch(LAUNCH);
  for (let run = 0; run < 3; run++) {
    const ctx = await themedContext(b, "light", { width: w, height: h });
    await ctx.addInitScript(() => { window.__l = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.duration > 50) window.__l.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: "long-animation-frame", buffered: true }); });
    const p = await ctx.newPage();
    await p.goto(base + "/", { waitUntil: "load" });
    await p.waitForFunction(() => document.documentElement.dataset.stage === "live", null, { timeout: 60000 });
    const liveAt = await p.evaluate(() => Math.round(performance.now()));
    await sleep(4000);
    const l = await p.evaluate(() => window.__l);
    console.log(JSON.stringify({ liveAt, longFrames: l, max: Math.max(0, ...l.map((x) => x[1])) }));
    await ctx.close();
  }
  await b.close();
})();
