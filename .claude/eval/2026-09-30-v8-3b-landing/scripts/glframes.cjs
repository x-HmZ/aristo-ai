// Every frame's time against the renderer's counts (`?probe`: shader programs, geometries, textures), from load
// through the hero going live, then a steady scroll through the page: a long frame where the program count jumps is
// a synchronous shader compile; where the geometry count jumps, an upload. Usage: node glframes.cjs <out.json> [base] [width]
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , out = "build/glframes.json", base = "http://localhost:3100", width = "1440"] = process.argv;
const INIT = () => {
  window.__gf = [];
  let last = performance.now();
  const f = (now) => {
    const g = window.__landing?.gl?.();
    window.__gf.push({ t: Math.round(now), dt: Math.round(now - last), p: g?.programs ?? null, g: g?.geometries ?? null, x: g?.textures ?? null, live: document.querySelector("[data-spot][data-live]")?.getAttribute("data-spot") ?? null, y: Math.round(scrollY) });
    last = now;
    requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
};
(async () => {
  const b = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [] };
  const ctx = await themedContext(b, "light", { width: Number(width), height: 800 });
  const p = await ctx.newPage();
  await guardApi(p, report);
  await p.addInitScript(INIT);
  await p.goto(base + "/?probe", { waitUntil: "load" });
  await p.waitForFunction(() => document.querySelector("[data-spot=hero][data-live]"), null, { timeout: 90000 });
  await sleep(5000);
  await p.evaluate(() => new Promise((resolve) => {
    const id = setInterval(() => { scrollBy(0, 100); if (scrollY + innerHeight >= document.documentElement.scrollHeight - 2) { clearInterval(id); resolve(); } }, 16);
  }));
  await sleep(1500);
  const fr = await p.evaluate(() => window.__gf);
  fs.writeFileSync(path.resolve(__dirname, "..", out), JSON.stringify(fr));
  // The long frames and the count changes around them.
  const rows = [];
  for (let i = 1; i < fr.length; i++) {
    const a = fr[i - 1], c = fr[i];
    if (c.dt > 40 || (a.p !== null && c.p !== a.p) || (a.g !== null && c.g !== a.g)) rows.push(`${c.t}ms dt=${c.dt} programs ${a.p}->${c.p} geometries ${a.g}->${c.g} textures ${a.x}->${c.x} live=${c.live} y=${c.y}`);
  }
  console.log(rows.join("\n"));
  console.log(JSON.stringify({ frames: fr.length, api: report.api.length, paid: report.paid.length }));
  await b.close();
})();
