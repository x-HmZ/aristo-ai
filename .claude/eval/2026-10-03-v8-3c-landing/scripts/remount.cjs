// What a spot change costs (V8.3b, session 3): with Jake live at the hero, profile the scroll to the idea spot until
// he is live there (the canvas moves and he remounts), and print the heaviest functions by self and by total time.
// `SCROLL=1`: profile a steady scroll through the whole page instead. Usage: node remount.cjs [base] [width]
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , base = "http://localhost:3000", width = "1440"] = process.argv;
function tops(profile, n = Number(process.env.TOP || 16)) {
  const byId = new Map(profile.nodes.map((x) => [x.id, x]));
  const parent = new Map();
  for (const x of profile.nodes) for (const c of x.children || []) parent.set(c, x.id);
  const name = (x) => `${x.callFrame.functionName || "(anon)"} ${x.callFrame.url.replace(/^.*\/node_modules\//, "").replace(/^.*\/src\//, "src/")}:${x.callFrame.lineNumber}`;
  const self = new Map(), total = new Map();
  profile.samples.forEach((id, i) => {
    const dt = (profile.timeDeltas[i] || 0) / 1000;
    const x = byId.get(id);
    self.set(name(x), (self.get(name(x)) || 0) + dt);
    const seen = new Set();
    for (let k = id; k !== undefined; k = parent.get(k)) { const nm = name(byId.get(k)); if (!seen.has(nm)) { seen.add(nm); total.set(nm, (total.get(nm) || 0) + dt); } }
  });
  const fmt = (m) => [...m.entries()].filter(([k]) => !/^\((idle|program|root)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${v.toFixed(0).padStart(6)} ms  ${k}`).join("\n");
  return "-- self\n" + fmt(self) + "\n-- total\n" + fmt(total);
}
(async () => {
  const b = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [] };
  const ctx = await themedContext(b, "light", { width: Number(width), height: 800 });
  const p = await ctx.newPage();
  await guardApi(p, report);
  await p.goto(base + "/", { waitUntil: "load" });
  await p.waitForFunction(() => document.querySelector("[data-spot=hero][data-live]"), null, { timeout: 120000 });
  await sleep(4000);
  const cdp = await ctx.newCDPSession(p);
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 100 });
  await cdp.send("Profiler.start");
  if (process.env.SCROLL) {
    // The whole page in a steady wheel-like scroll (100 px every 16 ms), as perf.cjs does.
    await p.evaluate(() => new Promise((resolve) => {
      const id = setInterval(() => { scrollBy(0, 100); if (scrollY + innerHeight >= document.documentElement.scrollHeight - 2) { clearInterval(id); resolve(); } }, 16);
    }));
    await sleep(1500);
  } else {
    const y = await p.evaluate(() => { const r = document.querySelector("[data-spot=idea]").getBoundingClientRect(); return r.top + scrollY - (innerHeight - r.height) / 2; });
    await p.evaluate((q) => scrollTo(0, q), y);
    await p.waitForFunction(() => document.querySelector("[data-spot=idea][data-live]"), null, { timeout: 60000 });
    await sleep(300);
  }
  const { profile } = await cdp.send("Profiler.stop");
  console.log(tops(profile));
  console.log(JSON.stringify({ api: report.api.length, paid: report.paid.length }));
  await b.close();
})();
