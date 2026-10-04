// V8.3c: what the main thread does in the opening's long frames: a CPU profile on a cold load, cut into busy runs
// (non-idle samples back to back), each run over 60 ms listed with its top functions (self time) and their files.
const { chromium, LAUNCH, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , base = "http://localhost:3100"] = process.argv;
(async () => {
  const b = await chromium.launch(LAUNCH);
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await guardApi(p, { api: [], paid: [] });
  const cdp = await ctx.newCDPSession(p);
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
  await cdp.send("Profiler.start");
  await p.goto(base + "/", { waitUntil: "load" });
  await p.waitForFunction(() => document.documentElement.dataset.intro === "done", null, { timeout: 30000 });
  const { profile } = await cdp.send("Profiler.stop");
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  let t = profile.startTime, run = null;
  const runs = [];
  profile.samples.forEach((id, i) => {
    t += profile.timeDeltas[i];
    const n = byId.get(id), name = n.callFrame.functionName;
    const idle = name === "(idle)";
    if (!idle) {
      if (!run || t - run.end > 3000) { run = { start: t, end: t, fns: new Map() }; runs.push(run); }
      run.end = t;
      const k = `${name || "(anon)"} ${n.callFrame.url.split("/").pop()}`;
      run.fns.set(k, (run.fns.get(k) || 0) + profile.timeDeltas[i] / 1000);
    }
  });
  for (const r of runs) {
    const ms = (r.end - r.start) / 1000;
    if (ms < 60) continue;
    const top = [...r.fns.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${v.toFixed(0)}ms ${k}`).join(" | ");
    console.log(`at ${((r.start - profile.startTime) / 1000).toFixed(0)}ms for ${ms.toFixed(0)}ms: ${top}`);
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
