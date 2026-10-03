// The close's goodbye (V8.3b, session 3): Jake waves each time the close comes into view, 8 s cool-down (plan note
// 6). Arrive; scroll up part way (a tenth of the close's box showing, the close still the active spot) and come back
// after the cool-down, then within it; then go up to the room (the canvas moves) and come back after the cool-down.
// Each visit samples his hands (`?probe`) for 3.5 s: a wave (Talking6M with his left hand, Talking6 with his right:
// the close allows both) lifts that wrist to about y 0.3 (at rest about -0.45).
// Usage: node close-wave.cjs <outdir> [base] [width]
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , out = "build/close-wave", base = "http://localhost:3000", width = "1280"] = process.argv;
const OUT = path.join(__dirname, "..", out);
fs.mkdirSync(OUT, { recursive: true });
const WAVE_Y = 0.0;

(async () => {
  const b = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [], visits: [] };
  const ctx = await themedContext(b, "light", { width: Number(width), height: 800 });
  const p = await ctx.newPage();
  await guardApi(p, report);
  await p.goto(base + "/?probe", { waitUntil: "load" });
  await p.waitForFunction(() => document.querySelector("[data-spot=hero][data-live]"), null, { timeout: 120000 });
  const geo = await p.evaluate(() => { const r = document.querySelector("[data-spot=close]").getBoundingClientRect(); return { top: r.top + scrollY, h: r.height, page: document.documentElement.scrollHeight, vh: innerHeight }; });
  const centre = Math.max(0, geo.top - (geo.vh - geo.h) / 2);
  // Away, part way: scrolled up until a tenth of the close's box shows (it stays the active spot); away, to the room:
  // Step Into the Classroom centred (the canvas moves there).
  const partWay = geo.top + 0.1 * geo.h - geo.vh;
  const room = await p.evaluate(() => { const r = document.querySelector("[data-spot=room]").getBoundingClientRect(); return r.top + scrollY - (innerHeight - r.height) / 2; });
  const glide = async (to) => { const from = await p.evaluate(() => scrollY); const n = Math.max(1, Math.ceil(Math.abs(to - from) / 120)); for (let i = 1; i <= n; i++) { await p.evaluate((q) => scrollTo(0, q), from + ((to - from) * i) / n); await sleep(16); } };
  const visit = async (name, i) => {
    await glide(centre);
    await p.waitForFunction(() => document.querySelector("[data-spot=close][data-live]") && window.__landing?.spot === "close", null, { timeout: 60000 });
    let top = -9;
    const t0 = Date.now();
    let hand = "";
    while (Date.now() - t0 < 3500) {
      const [l, r] = await p.evaluate(() => { const b = window.__landing.bones(); return [b.CC_Base_L_Hand[1], b.CC_Base_R_Hand[1]]; });
      if (Math.max(l, r) > top) { top = Math.max(l, r); hand = l >= r ? "left" : "right"; }
      await sleep(60);
    }
    await p.screenshot({ path: path.join(OUT, `${i}-${name}.png`) });
    const v = { visit: name, wristTop: +top.toFixed(2), hand, waved: top > WAVE_Y };
    report.visits.push(v);
    console.log(JSON.stringify(v));
  };
  const leave = async (to, ms) => {
    await glide(to);
    await sleep(300);
    const at = await p.evaluate(() => ({ active: window.__landing?.spot, shown: (() => { const r = document.querySelector("[data-spot=close]").getBoundingClientRect(); return +(Math.max(0, Math.min(innerHeight, r.bottom) - Math.max(0, r.top)) / r.height).toFixed(2); })() }));
    report.visits.push({ away: to === room ? "room" : "part way", ...at });
    console.log(JSON.stringify({ away: to === room ? "room" : "part way", ...at }));
    await sleep(ms);
  };
  // His gesture clips load after he is live at the hero; a wave waits for them, so give them time first.
  await sleep(5000);
  await glide(centre - 2000);
  await visit("arrive", 0);
  await leave(partWay, 9000);
  await visit("back from part way after 9 s", 1);
  await leave(partWay, 2000);
  await visit("back from part way within the cool-down", 2);
  await leave(room, 9000);
  await visit("back from the room after 9 s", 3);
  fs.writeFileSync(path.join(OUT, "close-wave.json"), JSON.stringify({ ...report, geo }, null, 1));
  console.log(JSON.stringify({ api: report.api.length, paid: report.paid.length }));
  await b.close();
})();
