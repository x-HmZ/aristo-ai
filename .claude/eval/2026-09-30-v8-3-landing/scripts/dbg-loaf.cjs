// Where the long frames are: Long Animation Frame entries with their script attribution and the scroll position.
const { chromium, sleep, LAUNCH, themedContext } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , base, size = "1280x800", q = ""] = process.argv;
const [w, h] = size.split("x").map(Number);
(async () => {
  const b = await chromium.launch(LAUNCH);
  const ctx = await themedContext(b, "light", { width: w, height: h });
  const p = await ctx.newPage();
  if (process.env.THROTTLE) { const cdp = await ctx.newCDPSession(p); await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.THROTTLE) }); }
  await p.goto(base + "/" + q, { waitUntil: "load" });
  await p.waitForFunction(() => document.documentElement.dataset.stage && document.documentElement.dataset.stage !== "loading", null, { timeout: 60000 });
  await sleep(2000);
  await p.evaluate(() => {
    window.__l = [];
    const ids = ["top", "idea", "how", "moves", "map", "parents", "start"];
    const S = () => { for (let i = ids.length - 1; i >= 0; i--) { const el = document.getElementById(ids[i]); const r = el.getBoundingClientRect(); if (r.top <= 0) { const tr = ids[i] === "parents" ? el.offsetHeight : el.offsetHeight - innerHeight; return (i + Math.min(1, -r.top / tr)).toFixed(2); } } return "0"; };
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.duration > 45) window.__l.push({ d: Math.round(e.duration), S: S(), s: (e.scripts || []).map((s) => `${s.invoker} ${s.sourceFunctionName} ${Math.round(s.duration)}`).slice(0, 4), r: Math.round(e.renderStart ? e.startTime + e.duration - e.renderStart : 0), st: Math.round(e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0) }); }).observe({ type: "long-animation-frame" });
  });
  const total = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  await p.mouse.move(w / 2, h / 2);
  while ((await p.evaluate(() => scrollY)) < total - 2) { await p.mouse.wheel(0, 100); await sleep(16); }
  await sleep(1000);
  console.log(JSON.stringify(await p.evaluate(() => window.__l), null, 1));
  await b.close();
})();
