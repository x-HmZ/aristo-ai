// V8.3c: the switch's timing, read in the page each frame (no screenshots to stall it): the dissolve value, the frame
// time, the GL program count before and after. Usage: node switch-timing.cjs [base]
const { chromium, sleep, LAUNCH, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , base = "http://localhost:3000"] = process.argv;
(async () => {
  const b = await chromium.launch(LAUNCH);
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });
  await ctx.addInitScript(() => { try { sessionStorage.setItem("aristo-intro-seen", "1"); } catch {} });
  const p = await ctx.newPage();
  await guardApi(p, { api: [], paid: [] });
  await p.goto(base + "/?full=1&probe", { waitUntil: "load" });
  await p.waitForFunction(() => document.querySelector('[data-spot="hero"][data-live]') && window.__landing, null, { timeout: 120000 });
  await sleep(3000);
  for (const to of ["MJ", "Jake"]) {
    const btn = p.getByRole("button", { name: to, exact: true });
    await btn.hover();
    await sleep(5000);
    const before = await p.evaluate(() => window.__landing.gl().programs);
    await p.evaluate(() => {
      window.__log = [];
      let last = performance.now();
      const t0 = last;
      const tick = (now) => { window.__log.push([Math.round(now - t0), Math.round(now - last), +window.__landing.dissolve().toFixed(2)]); last = now; if (now - t0 < 3000) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    await btn.click();
    await sleep(3300);
    const log = await p.evaluate(() => window.__log);
    const after = await p.evaluate(() => window.__landing.gl().programs);
    const gone = log.find((r) => r[2] >= 1), back = log.findLast((r) => r[2] > 0);
    const longest = log.reduce((m, r) => Math.max(m, r[1]), 0);
    console.log(JSON.stringify({ to, programsBefore: before, programsAfter: after, fullyOutAt: gone?.[0], formedAt: back ? back[0] + 16 : null, longestFrameMs: longest, frames: log.length }));
    console.log(log.filter((_, i) => i % 6 === 0).map((r) => r.join(":")).join(" "));
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
