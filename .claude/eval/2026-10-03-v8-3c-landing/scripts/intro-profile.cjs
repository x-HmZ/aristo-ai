// V8.3c: a CPU profile of the opening on a cold load: self time by function, top 25.
const { chromium, sleep, LAUNCH, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , base = "http://localhost:3100"] = process.argv;
(async () => {
  const b = await chromium.launch(LAUNCH);
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await guardApi(p, { api: [], paid: [] });
  const cdp = await ctx.newCDPSession(p);
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 300 });
  await cdp.send("Profiler.start");
  await p.goto(base + "/", { waitUntil: "load" });
  await p.waitForFunction(() => document.documentElement.dataset.intro === "done", null, { timeout: 30000 });
  const { profile } = await cdp.send("Profiler.stop");
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map();
  profile.samples.forEach((id, i) => { const n = byId.get(id); const k = `${n.callFrame.functionName || "(anon)"} ${n.callFrame.url.split("/").pop()}:${n.callFrame.lineNumber}`; self.set(k, (self.get(k) || 0) + (profile.timeDeltas[i] || 0) / 1000); });
  for (const [k, ms] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(ms.toFixed(0).padStart(6), "ms", k.slice(0, 130));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
