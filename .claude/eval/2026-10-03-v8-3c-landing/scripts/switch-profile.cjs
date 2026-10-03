// V8.3c: a CPU profile of the first switch to MJ (CDP Profiler), summarised by self time and by the stage's own
// functions' total time. Usage: node switch-profile.cjs [base]
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
  const btn = p.getByRole("button", { name: "MJ", exact: true });
  await btn.hover();
  await sleep(6000);
  const cdp = await ctx.newCDPSession(p);
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
  await cdp.send("Profiler.start");
  await btn.click();
  await sleep(3000);
  const { profile } = await cdp.send("Profiler.stop");
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map();
  const dt = profile.timeDeltas;
  profile.samples.forEach((id, i) => { const n = byId.get(id); const k = `${n.callFrame.functionName || "(anon)"} ${n.callFrame.url.split("/").pop()}:${n.callFrame.lineNumber}`; self.set(k, (self.get(k) || 0) + (dt[i] || 0) / 1000); });
  const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
  for (const [k, ms] of top) console.log(ms.toFixed(0).padStart(6), "ms", k.slice(0, 140));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
