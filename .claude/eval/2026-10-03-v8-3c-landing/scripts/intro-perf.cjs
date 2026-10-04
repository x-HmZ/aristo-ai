// V8.3c: the opening on a cold load, measured in the page: every frame's time while it plays, the LCP and CLS, when
// it ends, when the teacher is live after it; plus the same load with `?nointro` for the LCP it replaces.
// Usage: node intro-perf.cjs [base] [width] [height] [runs]
const { chromium, sleep, LAUNCH, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , base = "http://localhost:3100", W = "1440", H = "900", runs = "3"] = process.argv;
(async () => {
  const b = await chromium.launch(LAUNCH);
  const out = [];
  for (let i = 0; i < +runs; i++) for (const q of ["/", "/?nointro"]) {
    const ctx = await b.newContext({ viewport: { width: +W, height: +H }, colorScheme: i % 2 ? "dark" : "light" });
    await ctx.addInitScript(() => {
      window.__m = { frames: [], lcp: 0, cls: 0, introAt: null, doneAt: null };
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value; }).observe({ type: "layout-shift", buffered: true });
      let last = 0;
      const tick = (t) => { const d = document.documentElement.dataset.intro; if (d === "playing" || d === "lifting") { if (window.__m.introAt === null) window.__m.introAt = t; if (last) { window.__m.frames.push(t - last); if (t - last > 50) (window.__m.long ??= []).push([Math.round(last - window.__m.introAt), Math.round(t - last)]); } } else if (d === "done" && window.__m.doneAt === null) window.__m.doneAt = t; last = t; requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    const p = await ctx.newPage();
    await guardApi(p, { api: [], paid: [] });
    await p.goto(base + q, { waitUntil: "load" });
    await p.waitForFunction(() => document.querySelector('[data-spot="hero"][data-live]'), null, { timeout: 60000 });
    const liveAt = await p.evaluate(() => performance.now());
    await sleep(500);
    const m = await p.evaluate(() => window.__m);
    if (process.env.ITIMES) console.log(JSON.stringify(await p.evaluate(() => window.__iT)));
    const f = m.frames.slice().sort((a, b) => a - b);
    const p95 = f.length ? f[Math.floor(f.length * 0.95)] : null;
    out.push({ q, theme: i % 2 ? "dark" : "light", lcp: Math.round(m.lcp), cls: +m.cls.toFixed(3), introStart: m.introAt && Math.round(m.introAt), introEnd: m.doneAt && Math.round(m.doneAt), heroLiveBy: Math.round(liveAt), frames: f.length, p95: p95 && +p95.toFixed(1), worst: f.length ? +f[f.length - 1].toFixed(1) : null, over50: f.filter((x) => x > 50).length, long: m.long });
    await ctx.close();
  }
  for (const r of out) console.log(JSON.stringify(r));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
